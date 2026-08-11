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
import { CHAPTERS, PAST_PAPERS, SUBJECTS, chapterById, contentFor, subjectById } from './content';
import { Blank, Chapter, ChapterContent, Flashcard, Mcq, Medium, PastPaper, Section, ShortQ, Subject } from './types';

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
 * Run a query, and if anything at all goes wrong fall back.
 *
 * "Anything at all" is deliberate. A thrown error, a Supabase error object, a
 * null result and an empty array all mean the same thing to a student staring
 * at a screen, so they are all treated the same: serve the last good answer, or
 * the bundled one. The failure is logged once and never surfaced, because there
 * is nothing the student could do about it.
 */
async function read<T>(
  client: ContentClient | null,
  key: string,
  query: () => Promise<{ data: T | null; error: unknown }>,
  fallback: () => T,
): Promise<T> {
  if (!client) return fallback();
  try {
    const { data, error } = await query();
    if (error || data == null || (Array.isArray(data) && data.length === 0)) throw error ?? new Error('empty');
    cache.set(key, data);
    return data;
  } catch (e) {
    if (isDev()) console.warn(`[content] ${key} fell back:`, e);
    return (cache.get(key) as T) ?? fallback();
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
      return {
        error,
        data: (data as (SubjectRow & { chapters: { count: number }[] })[] | null)?.map((r) =>
          toSubject(r, r.chapters?.[0]?.count ?? 0),
        ) ?? null,
      };
    },
    fallback,
  );
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
      const { data, error } = await table('chapters', at!)
        .select('id,subject_id,number,board_unit,exam_marks,exam_share,title,urdu_title,blurb,premium,audio_minutes')
        .eq('subject_id', subjectId)
        .order('number');
      return { error, data: (data as ChapterRow[] | null)?.map((r) => toChapter(r)) ?? null };
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
export async function fetchChapterContent(chapterId: string, client?: ContentClient): Promise<ChapterContent> {
  const at = client ?? db;
  const fallback = () => contentFor(chapterId);

  return read<ChapterContent>(
    at,
    `content:${chapterId}:${medium}`,
    async () => {
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
        table('chapter_sections', at!).select('id,medium,position,title,blocks').eq('chapter_id', chapterId).order('position'),
        table('mcqs', at!).select('id,medium,topic,q,options,answer,explanation,difficulty,source').eq('chapter_id', chapterId),
        table('flashcards', at!).select('id,medium,front,back').eq('chapter_id', chapterId),
        table('short_questions', at!).select('id,medium,marks,q,answer,points').eq('chapter_id', chapterId),
        table('blanks', at!).select('id,medium,before_text,after_text,answer,options').eq('chapter_id', chapterId),
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
          audioTitle: fallback().audioTitle,
        },
      };
    },
    fallback,
  );
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
  const fallbackPool = (): Mcq[] => {
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

export async function fetchFlashcards(chapterId: string, client?: ContentClient): Promise<Flashcard[]> {
  return (await fetchChapterContent(chapterId, client)).flashcards;
}

export async function fetchPastPapers(subjectId?: string): Promise<PastPaper[]> {
  // Papers are still bundled: the client has not supplied real ones yet, and
  // there is no table for them until he does.
  return subjectId ? PAST_PAPERS.filter((p) => p.subjectId === subjectId) : PAST_PAPERS;
}
