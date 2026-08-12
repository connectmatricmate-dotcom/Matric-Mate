/**
 * The content fetch layer: where the app's curriculum data actually comes from.
 *
 * Both apps call `api.getChapter(...)` and always have. What changed is what
 * sits behind it. Until now that was a static object compiled into the bundle;
 * now it is Postgres, with the static object kept as the fallback. No screen
 * changed, because no screen ever knew.
 *
 * THREE RULES THIS FILE EXISTS TO ENFORCE
 *
 * 1. **The app must never show a blank screen because the network blinked.**
 *    Every read falls back: live rows, then whatever we read a moment ago, then
 *    the bundled sample. A student on a bus in Rawalpindi with two bars is the
 *    normal case, not the edge case.
 *
 * 2. **Nothing unreviewed reaches a student.** The database enforces this in
 *    RLS, which is the only place it can be enforced properly. This file does
 *    not filter on review_status at all, deliberately: a client-side filter
 *    would imply the server's could be bypassed.
 *
 * 3. **Medium is app state, not an argument.** A student picks English or Urdu
 *    once, at onboarding. Threading a `medium` parameter through twenty call
 *    sites would mean twenty chances to forget it and quietly serve English to
 *    an Urdu-medium student. It is set once here and every query respects it.
 *
 * `core` deliberately does not depend on @supabase/supabase-js. Each app owns
 * its own client (they authenticate differently and the mobile one needs a
 * React Native storage adapter), and this file only needs the query builder
 * shape, so it takes it structurally.
 */
import { CHAPTERS, SUBJECTS, chapterById, contentFor, primeContent, subjectById } from './content';
import { AudioTrack, Blank, Chapter, ChapterContent, Flashcard, Mcq, Medium, Section, ShortQ, Subject } from './types';

/**
 * The slice of a Supabase client this file uses. Typed loosely on purpose: the
 * real builder is a deeply generic chain, and reproducing it here would couple
 * core to a version of a package it does not depend on.
 */
/*
 * `unknown` rather than a typed builder, and the casts below are the price.
 * PostgREST's builder is a deeply generic chain whose type comes from a package
 * core does not depend on; reproducing it here would be a large lie that goes
 * stale on the next @supabase/supabase-js release. The queries are covered by
 * the round trip in scripts/verify-content.mjs instead, which is where a wrong
 * column name actually shows up.
 */
export type ContentClient = {
  /*
   * `any`, and deliberately, at this one boundary. A real SupabaseClient's
   * `from` is generic over the database schema, and asking TypeScript to check
   * it against the structural type below makes it give up with "type
   * instantiation is excessively deep". Widening here costs nothing, because
   * `table()` immediately narrows it back to TableBuilder and every query in
   * this file is checked against that.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};

/** The client's `from`, narrowed back to the shape this file actually uses. */
const table = (name: string, client: ContentClient): TableBuilder => client.from(name) as TableBuilder;

/**
 * `from()` is not thenable, `select()` is. That distinction is the whole reason
 * these are two types: PostgrestQueryBuilder gains its promise only once you
 * have asked for columns, and collapsing them into one type makes a real
 * Supabase client fail to assign.
 *
 * Method shorthand throughout, not arrow properties: methods compare
 * bivariantly, which is what lets the real client's deeply generic signatures
 * satisfy these loose ones. Written as properties, strictFunctionTypes rejects
 * every one of them.
 */
type TableBuilder = {
  select(columns: string): Filterable;
};

/** The filter methods this file uses. Each returns something still awaitable. */
type Filterable = PromiseLike<{ data: unknown; error: unknown }> & {
  eq(column: string, value: string): Filterable;
  in(column: string, values: readonly string[]): Filterable;
  or(filter: string): Filterable;
  order(column: string): Filterable;
  limit(count: number): Filterable;
};

type Row = { medium: Medium; [column: string]: unknown };

let db: ContentClient | null = null;
let medium: Medium = 'en';

/**
 * Point the content layer at a database. Called once per app at startup.
 * Passing null puts it back on bundled content, which is what the tests and the
 * marketing site's demo want.
 */
export function connectContent(client: ContentClient | null): void {
  db = client;
  cache.clear();
}

/**
 * A chapter a student downloaded for offline use, read back off whatever this
 * app persists it to. Returns null when nothing was saved for that chapter
 * and medium, which this file treats exactly like a cache miss.
 */
export type LocalContentProvider = (chapterId: string, medium: Medium) => Promise<ChapterContent | null>;

let localContent: LocalContentProvider | null = null;

/**
 * Wires the fetch layer to a store of chapters downloaded for offline use.
 *
 * core does not read the filesystem itself, on purpose: this file is shared
 * with the web app, which has no expo-file-system, and that package's own web
 * shim is a no-op that just warns (see its ExpoFileSystem.web.ts). Importing
 * it here would either break the web build or silently do nothing there. So
 * core only defines the extension point; the mobile app is the only caller
 * that ever provides one (see apps/mobile/src/core/downloads.ts), backed by
 * JSON snapshots under expo-file-system's document directory. Passing null
 * (the default) means "no offline copies exist", which is exactly true on
 * the web and in tests.
 */
export function connectLocalContent(provider: LocalContentProvider | null): void {
  localContent = provider;
}

/** Follow the student's chosen medium. Set from the profile after sign-in. */
export function setContentMedium(next: Medium): void {
  if (next === medium) return;
  medium = next;
  cache.clear();
}

export const contentMedium = (): Medium => medium;
export const isLive = (): boolean => db !== null;

/**
 * Last good answer per query key. Not an optimisation: it is what stands
 * between a flaky connection and an empty chapter list. Cleared whenever the
 * client or the medium changes, because both change what a key means.
 */
const cache = new Map<string, unknown>();

/**
 * core has no @types/node and runs in a browser, in Hermes and in Node, so
 * `process` cannot be referenced directly. Read it off globalThis instead.
 */
const isDev = (): boolean =>
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production';

/**
 * Whether the app believes it can reach the server right now.
 *
 * Set by the platform, which is the only layer that can know (mobile watches
 * the OS network state; the web is online by definition or nothing loads).
 * While false, read() skips the live query entirely: a student in airplane
 * mode was paying a full network timeout per screen before their own
 * downloaded chapter appeared, which read as the app being slow when it was
 * actually waiting politely for a network it had been told about.
 */
let contentOnline = true;

export function setContentOnline(next: boolean): void {
  contentOnline = next;
}

/**
 * How long a live query may hold up a screen.
 *
 * Long enough for a slow 3G answer, short enough that a student on flaky
 * signal gets their cached or downloaded copy instead of a spinner. The live
 * request is not cancelled at the deadline: if it lands late, its answer still
 * goes into the session cache, so the next screen gets fresh data for free.
 */
const LIVE_DEADLINE_MS = 4000;

/**
 * Run a query, and if anything at all goes wrong fall back.
 *
 * "Anything at all" is deliberate. A thrown error, a Supabase error object, a
 * null result, an empty array and a request slower than the deadline all mean
 * the same thing to a student staring at a screen, so they are all treated the
 * same: serve the last good answer, or the bundled one. The failure is logged
 * once and never surfaced, because there is nothing the student could do
 * about it.
 */
async function read<T>(
  client: ContentClient | null,
  key: string,
  query: () => Promise<{ data: T | null; error: unknown }>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!client) return fallback();
  if (!contentOnline) return (cache.get(key) as T) ?? fallback();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const live = (async () => {
      const { data, error } = await query();
      if (error || data == null || (Array.isArray(data) && data.length === 0)) throw error ?? new Error('empty');
      cache.set(key, data);
      return data;
    })();
    // A late success still fills the cache above; this stops a late failure
    // from surfacing as an unhandled rejection after the race is over.
    live.catch(() => {});
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('deadline')), LIVE_DEADLINE_MS);
    });
    return await Promise.race([live, deadline]);
  } catch (e) {
    if (isDev()) console.warn(`[content] ${key} fell back:`, e);
    return (cache.get(key) as T) ?? (await fallback());
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ rows */

type SubjectRow = {
  id: string;
  name: string;
  urdu_name: string | null;
  icon: string;
  compulsory: boolean;
  study_group: 'science' | 'arts' | null;
};

type ChapterRow = {
  id: string;
  subject_id: string;
  number: number;
  board_unit: number | null;
  exam_marks: number | null;
  exam_share: number | null;
  title: string;
  urdu_title: string | null;
  blurb: string;
  premium: boolean;
  audio_minutes: number;
};

const toSubject = (r: SubjectRow, chapterCount: number): Subject => ({
  id: r.id,
  name: r.name,
  urduName: r.urdu_name ?? undefined,
  icon: r.icon as Subject['icon'],
  compulsory: r.compulsory,
  group: r.study_group ?? undefined,
  chapterCount,
});

const toChapter = (r: ChapterRow, counts?: { mcqs: number; cards: number; sections: number }): Chapter => ({
  id: r.id,
  subjectId: r.subject_id,
  number: r.number,
  boardUnit: r.board_unit ?? undefined,
  examMarks: r.exam_marks ?? undefined,
  examShare: r.exam_share ?? undefined,
  title: r.title,
  urduTitle: r.urdu_title ?? undefined,
  blurb: r.blurb,
  premium: r.premium,
  audioMinutes: r.audio_minutes,
  mcqCount: counts?.mcqs ?? 0,
  flashcardCount: counts?.cards ?? 0,
  sectionCount: counts?.sections ?? 0,
});

/* --------------------------------------------------------------- queries */

export async function fetchSubjects(ids?: string[], client?: ContentClient): Promise<Subject[]> {
  const at = client ?? db;
  const key = `subjects:${ids?.join(',') ?? 'all'}`;
  const fallback = () => (ids?.length ? SUBJECTS.filter((s) => ids.includes(s.id)) : SUBJECTS);

  return read<Subject[]>(
    at,
    key,
    async () => {
      let q = table('subjects', at!).select('id,name,urdu_name,icon,compulsory,study_group,chapters(count)').order('sort_order');
      if (ids?.length) q = q.in('id', ids);
      const { data, error } = await q;
      const mapped =
        (data as (SubjectRow & { chapters: { count: number }[] })[] | null)?.map((r) =>
          toSubject(r, r.chapters?.[0]?.count ?? 0),
        ) ?? null;
      if (mapped?.length) primeContent({ subjects: mapped });
      return { error, data: mapped };
    },
    fallback,
  );
}

/**
 * Load every subject and chapter once, and prime the synchronous lookups.
 *
 * The live index in content.ts only helps in a runtime where something actually
 * fetched. Server rendering primes the server; the browser and the mobile app
 * then still answer `chapterById` from the bundle, so a heading shows the old
 * chapter name while the page body shows the new content. One query at startup
 * closes that, and one is enough: the whole curriculum is 84 rows.
 *
 * Deliberately not awaited by callers. It is a warm-up, and a screen must never
 * wait on it. Failure is silent because the bundle is already a working answer.
 *
 * THE ROW CAP. PostgREST returns at most 1000 rows unless you page, and it does
 * not tell you it truncated. Class 9 is 94 chapters so this is safe, and every
 * other query in this file is scoped to one subject or one chapter and bounded.
 * Adding Class 10 roughly doubles the chapter count, still under the cap, but
 * anything that starts selecting mcqs or sections unscoped will silently get
 * the first thousand and look fine. Page it, or scope it.
 */
export async function primeAllContent(client?: ContentClient): Promise<void> {
  const at = client ?? db;
  if (!at) return;
  try {
    const { data, error } = await table('chapters', at)
      .select('id,subject_id,number,board_unit,exam_marks,exam_share,title,urdu_title,blurb,premium,audio_minutes')
      .order('number');
    if (error || !data) return;
    const chapters = (data as ChapterRow[]).map((r) => toChapter(r));
    if (chapters.length) primeContent({ chapters });
  } catch {
    /* the bundle stays in place, which is a working answer */
  }
}

export async function fetchSubject(id: string, client?: ContentClient): Promise<Subject | undefined> {
  return (await fetchSubjects([id], client))[0] ?? subjectById(id);
}

export async function fetchChapters(subjectId: string, client?: ContentClient): Promise<Chapter[]> {
  const at = client ?? db;
  return read<Chapter[]>(
    at,
    `chapters:${subjectId}:${medium}`,
    async () => {
      // The counts are part of the row, not an afterthought. A chapter list
      // that says "0 questions" next to a chapter holding twenty of them reads
      // as a broken app, and that is exactly what shipped when this select
      // returned the chapter without them. PostgREST can aggregate the related
      // tables in the same round trip, and the medium filter has to be applied
      // to the embedded resource or English and Urdu are summed together and
      // every count doubles.
      const { data, error } = await table('chapters', at!)
        .select(
          'id,subject_id,number,board_unit,exam_marks,exam_share,title,urdu_title,blurb,premium,audio_minutes,' +
            'mcqs(count),flashcards(count),chapter_sections(count)',
        )
        .eq('subject_id', subjectId)
        .eq('mcqs.medium', medium)
        .eq('flashcards.medium', medium)
        .eq('chapter_sections.medium', medium)
        .order('number');

      type Counted = ChapterRow & {
        mcqs: { count: number }[];
        flashcards: { count: number }[];
        chapter_sections: { count: number }[];
      };

      const mapped =
        (data as Counted[] | null)?.map((r) =>
          toChapter(r, {
            mcqs: r.mcqs?.[0]?.count ?? 0,
            cards: r.flashcards?.[0]?.count ?? 0,
            sections: r.chapter_sections?.[0]?.count ?? 0,
          }),
        ) ?? null;

      // Feed the synchronous lookups in content.ts, so every screen that reads
      // chapterById or chaptersFor gets the real chapter without becoming async.
      if (mapped?.length) primeContent({ chapters: mapped });

      return { error, data: mapped };
    },
    () => CHAPTERS[subjectId] ?? [],
  );
}

export async function fetchChapter(id: string, client?: ContentClient): Promise<Chapter | undefined> {
  const subjectId = id.split('-')[0];
  return (await fetchChapters(subjectId, client)).find((c) => c.id === id) ?? chapterById(id);
}

/**
 * Everything a chapter screen needs, in one round trip.
 *
 * Six separate queries would be six chances to half-load a chapter, and the
 * reader cannot render usefully without all of it anyway. Urdu falls back to
 * English per resource rather than for the chapter as a whole: a translated
 * chapter with untranslated flashcards should still show the translated
 * chapter.
 */
/**
 * The live round trip for one chapter's full content: sections, mcqs,
 * flashcards, short questions and blanks, in the student's current medium.
 * Split out of fetchChapterContent so the download path below can run
 * exactly this query without going anywhere near the fallback chain.
 */
async function queryChapterContent(
  chapterId: string,
  at: ContentClient,
): Promise<{ data: ChapterContent | null; error: unknown }> {
  /**
   * Rows in the student's medium, or the English ones when that medium has
   * nothing yet. Per resource, not per chapter: a translated chapter whose
   * flashcards are not translated yet should still read in Urdu.
   */
  const pick = (rows: unknown): Row[] => {
    const all = (rows as Row[] | null) ?? [];
    const wanted = all.filter((r) => r.medium === medium);
    return wanted.length ? wanted : all.filter((r) => r.medium === 'en');
  };

  const [sections, mcqs, cards, shorts, blanks] = await Promise.all([
    table('chapter_sections', at).select('id,medium,position,title,blocks').eq('chapter_id', chapterId).order('position'),
    table('mcqs', at).select('id,medium,topic,q,options,answer,explanation,difficulty,source').eq('chapter_id', chapterId),
    table('flashcards', at).select('id,medium,front,back').eq('chapter_id', chapterId),
    table('short_questions', at).select('id,medium,marks,q,answer,points').eq('chapter_id', chapterId),
    table('blanks', at).select('id,medium,before_text,after_text,answer,options').eq('chapter_id', chapterId),
  ]);

  const error = sections.error ?? mcqs.error ?? cards.error ?? shorts.error ?? blanks.error;
  if (error) return { error, data: null };

  const s = pick(sections.data);
  // A chapter with no readable text is not a chapter yet. Fall back whole
  // rather than render an empty reader with working flashcards under it.
  if (!s.length) return { error: new Error('no sections'), data: null };

  return {
    error: null,
    data: {
      sections: s.map((r) => ({
        id: r.id,
        title: r.title,
        blocks: r.blocks,
      })) as Section[],
      mcqs: pick(mcqs.data).map((r) => ({
        id: r.id,
        chapterId,
        topic: r.topic,
        q: r.q,
        options: r.options,
        answer: r.answer,
        explanation: r.explanation,
        difficulty: r.difficulty,
        source: r.source === 'human' ? 'human' : 'ai',
      })) as Mcq[],
      flashcards: pick(cards.data).map((r) => ({
        id: r.id,
        chapterId,
        front: r.front,
        back: r.back,
      })) as Flashcard[],
      shortQs: pick(shorts.data).map((r) => ({
        id: r.id,
        chapterId,
        marks: r.marks,
        q: r.q,
        answer: r.answer,
        points: r.points,
      })) as ShortQ[],
      blanks: pick(blanks.data).map((r) => ({
        id: r.id,
        chapterId,
        sentence: [r.before_text, r.after_text],
        answer: r.answer,
        options: r.options,
      })) as Blank[],
      audioTitle: contentFor(chapterId).audioTitle,
    },
  };
}

export async function fetchChapterContent(chapterId: string, client?: ContentClient): Promise<ChapterContent> {
  const at = client ?? db;

  return read<ChapterContent>(
    at,
    `content:${chapterId}:${medium}`,
    () => queryChapterContent(chapterId, at!),
    // Cache (above, inside read) is this session's last good answer. Below
    // that: a chapter the student downloaded on purpose, real content even if
    // it may be a little stale, which is still a better answer than the
    // bundled sample. The bundle is the last resort, not the first fallback.
    async () => (await localContent?.(chapterId, medium)) ?? contentFor(chapterId),
  );
}

/**
 * The live query only, no fallback chain at all. What the download button
 * calls, deliberately not fetchChapterContent: that function's whole job is
 * to always hand back *something*, cache or bundle included, and a download
 * that "succeeds" by writing the bundled sample to disk under a chapter's
 * name would be a silent lie the next time the student opens it offline.
 * Throws on anything short of a genuine live answer, so the caller can tell
 * the student the download failed instead of quietly saving a placeholder.
 */
export async function fetchChapterContentLive(chapterId: string, client: ContentClient): Promise<ChapterContent> {
  const { data, error } = await queryChapterContent(chapterId, client);
  if (error || !data) throw error ?? new Error(`no live content for ${chapterId}`);
  return data;
}

/**
 * The board's learning outcomes for a chapter's subject.
 *
 * This is the one genuinely new thing the database gives a student that the
 * bundle never could: "here is exactly what FBISE examines on this, in their
 * words". There is no bundled fallback because there is no bundled copy, and an
 * empty list is a fine thing to render nothing for.
 */
export type Slo = { code: string; text: string; cognitive: string | null; assessment: string | null; domain: string; title: string | null };

export async function fetchSlos(
  subjectId: string,
  opts?: { examinableOnly?: boolean },
  client?: ContentClient,
): Promise<Slo[]> {
  if (!client && !db) return [];
  try {
    let q = table('curriculum_slos', client ?? db!).select('code,text,cognitive,assessment,domain,title').eq('subject_id', subjectId).order('code');
    // null assessment means the source table merged the column, not that the
    // outcome is unexamined, so it stays in.
    if (opts?.examinableOnly) q = q.or('assessment.eq.summative,assessment.is.null');
    const { data, error } = await q;
    return error ? [] : ((data as Slo[]) ?? []);
  } catch {
    return [];
  }
}

export async function fetchMcqs(
  opts: { chapterIds?: string[]; subjectId?: string; count: number; topics?: string[] },
  client?: ContentClient,
): Promise<Mcq[]> {
  const at = client ?? db;

  /**
   * Downloaded chapters' own MCQs, when the caller asked for specific
   * chapters (a single chapter's practice, or a hand-picked few) rather than
   * "mixed practice" across a whole subject. There is no local record of
   * which chapters exist for a subject the student never opened, so a
   * subject-wide pool with no chapterIds still falls through to the bundle
   * below, same as before this file knew about downloads.
   */
  const localPool = async (): Promise<Mcq[] | null> => {
    if (!localContent || !opts.chapterIds?.length) return null;
    const perChapter = await Promise.all(opts.chapterIds.map((id) => localContent!(id, medium)));
    let mcqs = perChapter.flatMap((c) => c?.mcqs ?? []);
    if (opts.topics?.length) mcqs = mcqs.filter((m) => opts.topics!.includes(m.topic));
    return mcqs.length ? mcqs : null;
  };

  const fallbackPool = async (): Promise<Mcq[]> => {
    const local = await localPool();
    if (local) return local.slice(0, opts.count);
    const chapters = opts.chapterIds?.length
      ? (opts.chapterIds.map(chapterById).filter(Boolean) as Chapter[])
      : Object.values(CHAPTERS)
          .flat()
          .filter((c) => (opts.subjectId ? c.subjectId === opts.subjectId : true));
    return chapters.flatMap((c) => contentFor(c.id).mcqs).slice(0, opts.count);
  };

  return read<Mcq[]>(
    at,
    `mcqs:${opts.subjectId ?? ''}:${opts.chapterIds?.join(',') ?? ''}:${opts.topics?.join(',') ?? ''}:${opts.count}:${medium}`,
    async () => {
      let q = table('mcqs', at!).select('id,chapter_id,medium,topic,q,options,answer,explanation,difficulty,source');
      if (opts.chapterIds?.length) q = q.in('chapter_id', opts.chapterIds);
      else if (opts.subjectId) q = q.eq('subject_id', opts.subjectId);
      if (opts.topics?.length) q = q.in('topic', opts.topics);

      const { data, error } = await q.limit(opts.count * 3);
      if (error) return { error, data: null };

      const rows = (data as Row[]) ?? [];
      const wanted = rows.filter((r) => r.medium === medium);
      const pool = wanted.length >= opts.count ? wanted : rows.filter((r) => r.medium === 'en');

      return {
        error: null,
        data: pool.slice(0, opts.count).map((r) => ({
          id: r.id,
          chapterId: r.chapter_id,
          topic: r.topic,
          q: r.q,
          options: r.options,
          answer: r.answer,
          explanation: r.explanation,
          difficulty: r.difficulty,
          source: r.source === 'human' ? 'human' : 'ai',
        })) as Mcq[],
      };
    },
    fallbackPool,
  );
}

/**
 * The recordings a chapter really has, both mediums.
 *
 * Returns an empty list when there is no row, and the caller is expected to
 * show no audio at all rather than a player pointed at nothing. This used to be
 * a hardcoded map in content.ts naming two demo files bundled into each app, so
 * a chapter had audio only if it was one specific physics chapter, no matter
 * what had actually been recorded and published.
 */
export async function fetchAudioTracks(chapterId: string, client?: ContentClient): Promise<AudioTrack[]> {
  if (!client && !db) return [];
  try {
    const { data, error } = await table('audio_tracks', client ?? db!)
      .select('id,chapter_id,medium,title,storage_path,duration_secs,bytes')
      .eq('chapter_id', chapterId);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      chapterId: String(r.chapter_id),
      medium: r.medium as Medium,
      title: String(r.title),
      storagePath: String(r.storage_path),
      durationSecs: Number(r.duration_secs) || 0,
      bytes: Number(r.bytes) || 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchFlashcards(chapterId: string, client?: ContentClient): Promise<Flashcard[]> {
  return (await fetchChapterContent(chapterId, client)).flashcards;
}
