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
import {
  SUBJECTS,
  bumpContent,
  chapterById,
  chapterIsTheirs,
  chaptersFor,
  contentFor,
  primeContent,
  resetContentIndex,
  setSyllabus,
  subjectById,
} from './content';
import { AudioTrack, Blank, Board, Chapter, ChapterContent, Flashcard, Mcq, Medium, Section, ShortQ, Subject } from './types';

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
  order(column: string, opts?: { ascending?: boolean }): Filterable;
  limit(count: number): Filterable;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
};

type Row = { medium: Medium; [column: string]: unknown };

let db: ContentClient | null = null;
let medium: Medium = 'en';

/**
 * Which "world" a read belongs to. Moves every time the cache is cleared: a
 * new client, a new medium, a new class or board, a sign-out. A read that
 * started in one world and lands in the next is a late answer to a question
 * nobody is asking any more, so it is neither cached nor primed.
 */
let epoch = 0;

/** Drops every cached answer and moves the epoch. */
function forget(): void {
  cache.clear();
  epoch += 1;
  bumpContent();
}

/**
 * Point the content layer at a database. Called once per app at startup.
 * Passing null puts it back on bundled content, which is what the tests and the
 * marketing site's demo want.
 */
export function connectContent(client: ContentClient | null): void {
  db = client;
  forget();
}

/**
 * Forget every answer this process has read, and the chapter index built from
 * them. Call on sign-out and whenever the signed-in account changes, then call
 * primeAllContent again once the next account is signed in.
 *
 * The cache is one per process and its keys carry no account, so without this
 * the next student in the same tab or on the same phone was answered from the
 * last one's reads: their chapters, their counts, their plan's content.
 */
export function clearContentCache(): void {
  forget();
  resetContentIndex();
}

/**
 * A client handed in that is not the one this process connected: the web
 * server's per-request client, built from one student's cookies.
 *
 * Reads through one never touch the shared cache and never fall back to the
 * bundle. Both were shared by every request on the instance, so a read that
 * failed, or came back empty under row level security, was answered with
 * whatever another student's request had cached: a free account opened a
 * subscriber's chapter, and a Class 9 account a Class 10 one. On the server an
 * error is thrown for the page to show, and an empty answer stays empty.
 */
const perRequest = (client?: ContentClient): boolean => !!client && client !== db;

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

/**
 * Follow the student's chosen medium. Set from the profile after sign-in.
 *
 * Ignored in a process with no connected client, the web server, for the
 * reason given at syllabusSaid below: the web store also renders there, and an
 * Urdu request's render left the whole server counting in Urdu.
 */
export function setContentMedium(next: Medium): void {
  if (next === medium || !db) return;
  medium = next;
  forget();
}

export const contentMedium = (): Medium => medium;
export const isLive = (): boolean => db !== null;

/**
 * The student's class and board. The DATABASE does the real filtering (row
 * level security serves each account only its own board's and class's
 * chapters), so neither is a query parameter. They exist so a change can
 * flush every cached answer from the old syllabus, so the synchronous lookups
 * in content.ts can refuse chapters primed before it, and so screens can
 * label what they show.
 *
 * Call them while rendering, not from an effect. The lookups they steer are
 * plain module reads with no subscription, so a value set in an effect lands
 * after the screens below have already read the old one, and nothing makes
 * them read again.
 */
let grade: 9 | 10 = 9;
let board: Board = 'fbise';
/*
 * Whether an app has said whose syllabus this is yet. On a device the first
 * call always reaches setSyllabus, even when it names the defaults: an FBISE
 * Class 9 student's store never changed either value, so the early return
 * below kept the syllabus unset and every syllabus check waved everything
 * through.
 *
 * None of these setters do anything in a process with no connected client,
 * which is the web server. The web store renders there too, once per request,
 * and a server that took one request's render as its syllabus (or medium)
 * would hide every other board's and class's chapters from the pages it
 * renders for everyone else. There is no student there to follow.
 */
let syllabusSaid = false;

export function setContentGrade(next: 9 | 10): void {
  if (!db || (next === grade && syllabusSaid)) return;
  const changed = next !== grade;
  grade = next;
  syllabusSaid = true;
  if (changed) forget();
  setSyllabus({ board, grade });
}

export function setContentBoard(next: Board): void {
  if (!db || (next === board && syllabusSaid)) return;
  const changed = next !== board;
  board = next;
  syllabusSaid = true;
  if (changed) forget();
  setSyllabus({ board, grade });
}

export const contentGrade = (): 9 | 10 => grade;
export const contentBoard = (): Board => board;

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
  /**
   * Set for a per-request client (see perRequest): what an empty answer is.
   * None of the rules above apply there. Nothing is cached, nothing falls
   * back, an error is thrown for the page to show, and an empty answer is the
   * answer: under row level security it is what this student may see.
   */
  own?: { empty: () => T },
  /** Whether a good answer may be cached as this key's last good answer. */
  keep: (data: T) => boolean = () => true,
): Promise<T> {
  if (!client) return fallback();
  if (own) {
    const { data, error } = await query();
    if (error) {
      const message = (error as { message?: string }).message ?? String(error);
      throw new Error(`[content] ${key}: ${message}`);
    }
    return data == null || (Array.isArray(data) && data.length === 0) ? own.empty() : data;
  }
  if (!contentOnline) return (cache.get(key) as T) ?? fallback();
  const started = epoch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const live = (async () => {
      const { data, error } = await query();
      if (error || data == null || (Array.isArray(data) && data.length === 0)) throw error ?? new Error('empty');
      // A late answer from before a switch or a sign-out is not this
      // student's last good answer, whatever its key says.
      if (started === epoch && keep(data)) cache.set(key, data);
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
  grade: number;
  board: Board | null;
  board_unit: number | null;
  exam_marks: number | null;
  exam_share: number | null;
  title: string;
  urdu_title: string | null;
  blurb: string;
  urdu_blurb: string | null;
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
  /* Row level security already serves each account only its own class, so this
     is not a filter. It is what lets a synchronous lookup say which class the
     chapter it just handed back belongs to. */
  grade: Number(r.grade) || 9,
  // Checked by every synchronous lookup against the student's own board, so a
  // row primed before a board change cannot be served after it.
  board: r.board ?? 'fbise',
  boardUnit: r.board_unit ?? undefined,
  examMarks: r.exam_marks ?? undefined,
  examShare: r.exam_share ?? undefined,
  title: r.title,
  urduTitle: r.urdu_title ?? undefined,
  blurb: r.blurb,
  urduBlurb: r.urdu_blurb ?? undefined,
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
  const started = epoch;

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
      if (mapped?.length && started === epoch) primeContent({ subjects: mapped });
      return { error, data: mapped };
    },
    fallback,
    perRequest(client) ? { empty: () => [] } : undefined,
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
 * Call it again whenever the answer changes: after sign-in (the chapters table
 * is readable only by a signed-in account, so a call before it primes
 * nothing), after a class or board switch, and after clearContentCache. Safe
 * to repeat and to overlap: a call that started before a switch lands as
 * nothing, and contentVersion moves only when the index really changed.
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
  const started = epoch;
  try {
    // The counts come along, exactly as fetchChapters reads them. Without
    // them toChapter defaults all three to zero, and because this runs
    // unawaited at startup it could land after a good read and overwrite real
    // counts with zeros. hasStudyMaterial then reports every chapter empty
    // and the whole app tells a paying student there is nothing to study.
    const { data, error } = await table('chapters', at)
      .select(
        'id,subject_id,number,grade,board,board_unit,exam_marks,exam_share,title,urdu_title,blurb,urdu_blurb,premium,audio_minutes,' +
          'mcqs(count),flashcards(count),chapter_sections(count)',
      )
      .eq('mcqs.medium', medium)
      .eq('flashcards.medium', medium)
      .eq('chapter_sections.medium', medium)
      .order('number');
    // Counted in the old medium, or read under the old class or board.
    if (error || !data || started !== epoch) return;
    type Counted = ChapterRow & {
      mcqs: { count: number }[];
      flashcards: { count: number }[];
      chapter_sections: { count: number }[];
    };
    const chapters = (data as Counted[]).map((r) =>
      toChapter(r, {
        mcqs: r.mcqs?.[0]?.count ?? 0,
        cards: r.flashcards?.[0]?.count ?? 0,
        sections: r.chapter_sections?.[0]?.count ?? 0,
      }),
    );
    if (chapters.length) primeContent({ chapters });
  } catch {
    /* the bundle stays in place, which is a working answer */
  }
}

export async function fetchSubject(id: string, client?: ContentClient): Promise<Subject | undefined> {
  const found = (await fetchSubjects([id], client))[0];
  return found ?? (perRequest(client) ? undefined : subjectById(id));
}

export async function fetchChapters(subjectId: string, client?: ContentClient): Promise<Chapter[]> {
  const at = client ?? db;
  const started = epoch;
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
          'id,subject_id,number,grade,board,board_unit,exam_marks,exam_share,title,urdu_title,blurb,urdu_blurb,premium,audio_minutes,' +
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
      // Not when a switch happened while this was in flight: that answer is
      // for a question nobody is asking any more.
      if (mapped?.length && started === epoch) primeContent({ chapters: mapped });

      return { error, data: mapped };
    },
    // The live index before the bundle: offline or past the deadline, it
    // still holds what the last good read primed, counts and all. The bundle's
    // counts are all zero, so every chapter read as empty and could not be
    // opened.
    () => chaptersFor(subjectId),
    perRequest(client) ? { empty: () => [] } : undefined,
    /* Not kept as this syllabus's last good answer when none of it is this
       syllabus: row level security was still answering for the account as it
       was before a board or class switch reached the server. Still returned,
       because the server is the authority on what the account can read. */
    (rows) => rows.some(chapterIsTheirs),
  );
}

export async function fetchChapter(id: string, client?: ContentClient): Promise<Chapter | undefined> {
  const subjectId = id.split('-')[0];
  const found = (await fetchChapters(subjectId, client)).find((c) => c.id === id);
  // On the server the index is shared by every request, primed by other
  // students' reads, so it cannot vouch for a chapter this one may not see.
  return found ?? (perRequest(client) ? undefined : chapterById(id));
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
  /**
   * The medium to read in. Defaults to the module setting, which is right on
   * a device where one student owns the process. A server must pass it: the
   * module value is shared by every request there, so it is always 'en' and
   * every Urdu student was served English notes on server-rendered pages.
   */
  want: Medium = medium,
): Promise<{ data: ChapterContent | null; error: unknown }> {
  /**
   * Rows in the student's medium, or the English ones when that medium has
   * nothing yet. Per resource, not per chapter: a translated chapter whose
   * flashcards are not translated yet should still read in Urdu.
   */
  const pick = (rows: unknown): Row[] => {
    const all = (rows as Row[] | null) ?? [];
    const wanted = all.filter((r) => r.medium === want);
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
  // An empty answer, not an error: under row level security it can also mean
  // this student may not read it, and a server has to be able to tell the two
  // apart (see read()).
  if (!s.length) return { error: null, data: null };

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

export async function fetchChapterContent(
  chapterId: string,
  client?: ContentClient,
  /** Server callers must pass the student's medium; see queryChapterContent. */
  want: Medium = medium,
): Promise<ChapterContent> {
  const at = client ?? db;

  return read<ChapterContent>(
    at,
    `content:${chapterId}:${want}`,
    () => queryChapterContent(chapterId, at!, want),
    // Cache (above, inside read) is this session's last good answer. Below
    // that: a chapter the student downloaded on purpose, real content even if
    // it may be a little stale, which is still a better answer than the
    // bundled sample. The bundle is the last resort, not the first fallback,
    // and contentFor only offers it to the syllabus it was written for.
    async () => (await localContent?.(chapterId, want)) ?? contentFor(chapterId),
    perRequest(client) ? { empty: () => ({ sections: [], mcqs: [], flashcards: [], shortQs: [], blanks: [], audioTitle: '' }) } : undefined,
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
export async function fetchChapterContentLive(
  chapterId: string,
  client: ContentClient,
  /** The medium to save, so a download need not switch the whole app's medium (and clear its cache) to get it. */
  want: Medium = medium,
): Promise<ChapterContent> {
  const { data, error } = await queryChapterContent(chapterId, client, want);
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
  opts?: { examinableOnly?: boolean; board?: Board; grade?: 9 | 10 },
  client?: ContentClient,
): Promise<Slo[]> {
  if (!client && !db) return [];
  try {
    /*
     * One board's and one class's outcomes. The table holds both boards, and
     * a subject id alone returned FBISE's Class 9 list to a Punjab or Class 10
     * student. FBISE's rows are not tied to chapters, and are all Class 9
     * today; Punjab's name their chapter, whose id carries the class.
     */
    const b = opts?.board ?? board;
    const g = opts?.grade ?? grade;
    let q = table('curriculum_slos', client ?? db!)
      .select('code,text,cognitive,assessment,domain,title')
      .eq('subject_id', subjectId)
      .eq('board', b)
      .order('code');
    if (b === 'punjab') q = q.or(`chapter_id.like.*-pj-${g}-*`);
    else q = g === 10 ? q.or('chapter_id.like.*-10-*') : q.or('chapter_id.is.null,chapter_id.not.like.*-10-*');
    // null assessment means the source table merged the column, not that the
    // outcome is unexamined, so it stays in.
    if (opts?.examinableOnly) q = q.or('assessment.eq.summative,assessment.is.null');
    const { data, error } = await q;
    return error ? [] : ((data as Slo[]) ?? []);
  } catch {
    return [];
  }
}

/** Up to `n` items drawn at random, in random order. */
function draw<T>(items: T[], n: number): T[] {
  const pool = items.slice();
  const take = Math.min(Math.max(n, 0), pool.length);
  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}

const MCQ_COLUMNS = 'id,chapter_id,medium,topic,q,options,answer,explanation,difficulty,source';

const toMcq = (r: Row): Mcq =>
  ({
    id: r.id,
    chapterId: r.chapter_id,
    topic: r.topic,
    q: r.q,
    options: r.options,
    answer: r.answer,
    explanation: r.explanation,
    difficulty: r.difficulty,
    source: r.source === 'human' ? 'human' : 'ai',
  }) as Mcq;

/**
 * A question set for practice or an exam, drawn at random from the pool the
 * options describe, in the student's medium.
 *
 * Three things this used to get wrong. It read `count * 3` rows with no medium
 * filter and no order, then used the Urdu ones only if there were enough of
 * them, so any Urdu shortfall served the whole set in English. With no order
 * and no draw, every "mixed" set was the same first rows, usually from one
 * chapter. And an Urdu set that could not be filled switched language rather
 * than coming back short.
 *
 * Now the medium is in the query, and English is only the answer when the
 * student's medium has no questions at all for that pool: a short set in
 * their own language beats a full one in the other. A pool of a few chapters
 * is read whole and drawn from; anything wider (a subject, a hand-picked
 * dozen) reads ids first and then only the drawn rows, which keeps a student's
 * data allowance out of it. Options are not shuffled here.
 */
export async function fetchMcqs(
  opts: {
    chapterIds?: string[];
    subjectId?: string;
    count: number;
    topics?: string[];
    /** Server callers pass the student's medium; the device's own setting otherwise. */
    medium?: Medium;
  },
  client?: ContentClient,
): Promise<Mcq[]> {
  const at = client ?? db;
  const want = opts.medium ?? medium;

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
    const perChapter = await Promise.all(opts.chapterIds.map((id) => localContent!(id, want)));
    let mcqs = perChapter.flatMap((c) => c?.mcqs ?? []);
    if (opts.topics?.length) mcqs = mcqs.filter((m) => opts.topics!.includes(m.topic));
    return mcqs.length ? mcqs : null;
  };

  /**
   * Offline means the chapters the student actually downloaded, and nothing
   * else. The bundled sample questions used to backfill this pool, and every
   * one of them was answered, scored and synced to Postgres as a real attempt
   * against phy-3, so a slow connection quietly poisoned the student's weak
   * topics with questions their syllabus never set. An empty pool is honest:
   * the practice screens already say when a chapter has no questions.
   */
  const fallbackPool = async (): Promise<Mcq[]> => {
    const local = await localPool();
    return local ? draw(local, opts.count) : [];
  };

  /** The pool's filters, the same for the id read and the whole-row read. */
  const scoped = (q: Filterable, m: Medium): Filterable => {
    let s = q.eq('medium', m);
    if (opts.chapterIds?.length) s = s.in('chapter_id', opts.chapterIds);
    else if (opts.subjectId) s = s.eq('subject_id', opts.subjectId);
    if (opts.topics?.length) s = s.in('topic', opts.topics);
    return s;
  };

  const drawIn = async (m: Medium): Promise<{ data: Mcq[] | null; error: unknown }> => {
    // Twenty-odd questions a chapter: a few chapters are cheaper read whole.
    if (opts.chapterIds?.length && opts.chapterIds.length <= 3) {
      const { data, error } = await scoped(table('mcqs', at!).select(MCQ_COLUMNS), m);
      if (error) return { error, data: null };
      return { error: null, data: draw((data as Row[]) ?? [], opts.count).map(toMcq) };
    }
    const ids = await scoped(table('mcqs', at!).select('id'), m);
    if (ids.error) return { error: ids.error, data: null };
    const picked = draw(((ids.data as { id: string }[]) ?? []).map((r) => r.id), opts.count);
    if (!picked.length) return { error: null, data: [] };
    const rows = await table('mcqs', at!).select(MCQ_COLUMNS).in('id', picked);
    if (rows.error) return { error: rows.error, data: null };
    const byId = new Map(((rows.data as Row[]) ?? []).map((r) => [String(r.id), r]));
    // Back in the drawn order: `in` answers in whatever order the table has.
    return { error: null, data: picked.flatMap((id) => (byId.has(id) ? [toMcq(byId.get(id)!)] : [])) };
  };

  return read<Mcq[]>(
    at,
    `mcqs:${opts.subjectId ?? ''}:${opts.chapterIds?.join(',') ?? ''}:${opts.topics?.join(',') ?? ''}:${opts.count}:${want}`,
    async () => {
      const own = await drawIn(want);
      if (own.error || own.data?.length || want === 'en') return own;
      return drawIn('en');
    },
    fallbackPool,
    perRequest(client) ? { empty: () => [] } : undefined,
  );
}

/**
 * Approved AI-drafted questions, for the test generator.
 *
 * These live in generated_mcqs, a separate table from the curated bank, and
 * RLS only serves rows a human has flipped to published. No cache and no
 * bundled fallback on purpose: an empty answer just means the generator draws
 * everything from the bank, which is never wrong, only less varied.
 */
export async function fetchGeneratedMcqs(
  opts: {
    count: number;
    topics?: string[];
    /** Only this subject's questions. Without it an empty topic list meant any subject at all. */
    subjectId?: string;
    medium?: Medium;
  },
  client?: ContentClient,
): Promise<Mcq[]> {
  const at = client ?? db;
  if (!at) return [];
  try {
    let q = table('generated_mcqs', at).select('id,topic,medium,q,options,answer,explanation,difficulty');
    if (opts.topics?.length) q = q.in('topic', opts.topics);
    if (opts.subjectId) q = q.eq('subject_id', opts.subjectId);
    const { data, error } = await q.eq('medium', opts.medium ?? medium).limit(opts.count);
    if (error) return [];
    return ((data as Row[]) ?? []).map((r) => ({
      id: r.id,
      chapterId: '',
      topic: r.topic,
      q: r.q,
      options: r.options,
      answer: r.answer,
      explanation: r.explanation ?? '',
      difficulty: r.difficulty ?? 'medium',
      source: 'ai',
    })) as Mcq[];
  } catch {
    return [];
  }
}

/**
 * One AI-generated practice set, read back under the student's own RLS.
 *
 * No cache and no bundled fallback: these sets are personal, created online
 * moments before they are opened, and an id that fails to load should say
 * so rather than show someone else's practice.
 */
export type AiSessionRow = {
  id: string;
  kind: 'mcq' | 'flashcards' | 'blanks' | 'shortq' | 'paper';
  title: string;
  subjectId: string | null;
  chapterId: string | null;
  topic: string | null;
  medium: string;
  items: unknown;
  createdAt: string;
};

/** Row to AiSessionRow. One mapper, so the two readers cannot drift. */
function toAiSessionRow(r: Row): AiSessionRow {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    subjectId: r.subject_id,
    chapterId: r.chapter_id,
    topic: r.topic,
    medium: r.medium,
    items: r.items,
    createdAt: r.created_at,
  } as AiSessionRow;
}

/**
 * One saved AI set, and whether the read worked.
 *
 * `fetchAiSession` below collapses four different outcomes into `null`: no
 * such row, a refusal, a network failure, and no client connected. The screens
 * then render all four as "Couldn't load this", which is what made a real
 * report of a broken mock paper impossible to diagnose. Every layer knew
 * something and none of them said it.
 *
 * `missing` is a paper that is genuinely not there, which retrying will not
 * fix. `failed` is anything else, which retrying might.
 */
export type AiSessionRead =
  | { ok: true; row: AiSessionRow }
  | { ok: false; reason: 'missing' | 'failed'; detail?: string };

export async function readAiSession(id: string, client?: ContentClient): Promise<AiSessionRead> {
  const at = client ?? db;
  if (!at) return { ok: false, reason: 'failed', detail: 'no content client' };
  try {
    const { data, error } = await table('ai_sessions', at)
      .select('id,kind,title,subject_id,chapter_id,topic,medium,items,created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, reason: 'failed', detail: String((error as { message?: string }).message ?? error) };
    if (!data) return { ok: false, reason: 'missing' };
    const row = toAiSessionRow(data as Row);
    // A paper with no items is a row that was written wrong, not a row that is
    // absent. Worth retrying, and worth being able to tell apart in a report.
    if (!row.items) return { ok: false, reason: 'failed', detail: 'row has no items' };
    return { ok: true, row };
  } catch (e) {
    return { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) };
  }
}

/** The older shape, kept because several screens still read it. Prefer
 *  `readAiSession`, which can say why it failed. */
export async function fetchAiSession(id: string, client?: ContentClient): Promise<AiSessionRow | null> {
  const res = await readAiSession(id, client);
  return res.ok ? res.row : null;
}

/** The student's saved AI sets, newest first, for the builder's shelf. */
export async function fetchAiSessions(client?: ContentClient): Promise<AiSessionRow[]> {
  const at = client ?? db;
  if (!at) return [];
  try {
    const { data, error } = await table('ai_sessions', at)
      .select('id,kind,title,subject_id,chapter_id,topic,medium,items,created_at')
      .order('created_at', { ascending: false })
      .limit(12);
    if (error) return [];
    return ((data as Row[]) ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      subjectId: r.subject_id,
      chapterId: r.chapter_id,
      topic: r.topic,
      medium: r.medium,
      items: r.items,
      createdAt: r.created_at,
    })) as AiSessionRow[];
  } catch {
    return [];
  }
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

export async function fetchFlashcards(
  chapterId: string,
  client?: ContentClient,
  want: Medium = medium,
): Promise<Flashcard[]> {
  return (await fetchChapterContent(chapterId, client, want)).flashcards;
}

/**
 * Just the section headings of one chapter, for the tutor's chapter picker.
 *
 * The third level of subject, chapter, topic. `queryChapterContent` above
 * would answer the same question, but it drags every MCQ, flashcard, short
 * question and blank for the chapter down the wire with it, which is a lot of
 * a student's data allowance to spend on a list of headings. This reads the
 * titles and nothing else.
 *
 * Same medium fallback as everywhere: the student's own medium if the chapter
 * has been translated, English if it has not, per resource rather than per
 * chapter.
 */
export async function fetchChapterTopics(chapterId: string, client?: ContentClient): Promise<string[]> {
  const at = client ?? db;
  if (!at) return [];
  try {
    const { data, error } = await table('chapter_sections', at)
      .select('medium,position,title')
      .eq('chapter_id', chapterId)
      .order('position');
    if (error || !data) return [];
    const rows = data as { medium: string; title: string }[];
    const wanted = rows.filter((r) => r.medium === medium);
    const use = wanted.length ? wanted : rows.filter((r) => r.medium === 'en');
    return use.map((r) => r.title).filter((title): title is string => !!title);
  } catch {
    return [];
  }
}
