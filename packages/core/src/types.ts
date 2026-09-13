/** Domain types. These mirror the planned Postgres tables (see docs SOW §8). */

export type Medium = 'en' | 'ur';
export type Group = 'science' | 'arts';
export type Confidence = 0 | 1 | 2; // 0 Tukka · 1 Thora sure · 2 Pakka

export type Subject = {
  id: string;
  name: string;
  urduName?: string;
  icon: 'bolt' | 'flask' | 'leaf' | 'calc' | 'book' | 'quill' | 'star' | 'globe' | 'book2';
  compulsory: boolean;
  group?: Group;
  chapterCount: number;
};

/** The examining boards the app serves. Chapters, outcomes and accounts each carry one. */
export type Board = 'fbise' | 'punjab';

export type Chapter = {
  id: string;
  subjectId: string;
  number: number;
  /**
   * Which board's syllabus this chapter is from. Absent on the bundled
   * catalogue, which is FBISE's; live rows always carry it (migration 0034).
   */
  board?: Board;
  /**
   * Which class this chapter belongs to, 9 or 10.
   *
   * The column has existed since migration 0011 and this type dropped it, so
   * every synchronous lookup answered without it. That is how the daily plan
   * came to offer a Class 10 student Class 9 chapter one: it composed an id as
   * `${subject}-1`, the grade 9 id shape, and nothing downstream could tell
   * that the chapter it got back was the wrong class. Anything choosing a
   * chapter on a student's behalf has to be able to check.
   */
  grade: number;
  /**
   * The board's own unit number, where it differs from our position in the
   * list. Mathematics Class 9 is FBISE units 1-7, 14, 15, 17-23 and 29, the
   * gaps being Class 10's, so a student looking for "unit 22" needs this.
   */
  boardUnit?: number;
  /**
   * What this chapter is worth in the annual paper, from the board's Table of
   * Specification. Undefined means we have not read that subject's table yet,
   * which is not the same as zero, so anything rendering it must hide rather
   * than show a nought.
   */
  examMarks?: number;
  examShare?: number;
  title: string;
  urduTitle?: string;
  blurb: string;
  /** The same one-line description in Urdu, where it has been written. See chapterBlurb. */
  urduBlurb?: string;
  premium: boolean;
  mcqCount: number;
  flashcardCount: number;
  audioMinutes: number;
  sectionCount: number;
};

export type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'def'; term: string; text: string }
  | { kind: 'formula'; text: string; caption?: string }
  | { kind: 'ur'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'example'; text: string };

export type Section = { id: string; title: string; blocks: Block[] };

export type Mcq = {
  id: string;
  chapterId: string;
  topic: string;
  q: string;
  options: string[];
  answer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source?: 'human' | 'ai';
};

export type Flashcard = { id: string; chapterId: string; front: string; back: string; urduBack?: string };

/**
 * A recorded lesson that actually exists.
 *
 * `storagePath` is a path inside the public `audio` bucket, not a URL, because
 * the project URL differs between environments and a stored absolute URL would
 * pin every row to whichever one was current when it was written. Each app
 * resolves it with its own Supabase client, which already knows the project.
 */
export type PlayableTrack = AudioTrack & { url: string };

export type AudioTrack = {
  id: string;
  chapterId: string;
  medium: Medium;
  title: string;
  storagePath: string;
  durationSecs: number;
  bytes: number;
};
export type ShortQ = { id: string; chapterId: string; marks: number; q: string; answer: string; points: string[] };
export type Blank = { id: string; chapterId: string; sentence: [string, string]; answer: string; options: string[] };

export type ChapterContent = {
  sections: Section[];
  /** Urdu-medium version of the same chapter, when the client has supplied it. */
  sectionsUr?: Section[];
  mcqs: Mcq[];
  flashcards: Flashcard[];
  shortQs: ShortQ[];
  blanks: Blank[];
  audioTitle: string;
};

/** A fully written-out sample paper section, used by the marketing site's demo. */
export type PaperSection = { heading: string; marks?: string; lines: string[]; urdu?: boolean };


/** One answered question, the row that powers every analytic in the app. */
export type Attempt = {
  id: string;
  mcqId: string;
  chapterId: string;
  subjectId: string;
  topic: string;
  correct: boolean;
  confidence: Confidence | null;
  mode: 'practice' | 'exam' | 'blanks' | 'shortq';
  at: number;
};

export type TestResult = {
  id: string;
  subjectId: string;
  chapterId: string | null;
  label: string;
  score: number;
  total: number;
  xp: number;
  mode: 'practice' | 'exam';
  at: number;
  attemptIds: string[];
};

/** A daily-plan task. The screen builds the wording, so it follows the app language. */
export type PlanTask = {
  id: string;
  subjectId: string;
  chapterId: string;
  kind: 'read' | 'mcq' | 'cards';
  weakTopic?: string;
  weakAccuracy?: number;
  done: boolean;
};

export type ChatMessage = { id: string; role: 'user' | 'ai'; text: string; steps?: string[]; at: number };
export type ChatThread = { id: string; title: string; subjectId?: string; contextLabel?: string; messages: ChatMessage[]; at: number };

/**
 * Where a notification sends you, named by destination rather than by URL.
 *
 * The two apps spell the same screen differently: Expo Router wants
 * `/(tabs)/progress`, Next wants `/progress`. A shared notification cannot hold
 * either without being wrong in the other app, so it holds the destination and
 * each app maps it to its own route. A closed union, so adding a destination
 * without teaching both apps about it is a build error.
 */
export type NotificationTarget =
  | 'home'
  | 'study'
  | 'practice'
  | 'progress'
  | 'session-setup'
  | 'report'
  | 'payments'
  | 'subscription'
  /** One chapter's page, named by `chapterId`. Stored as `chapter:<id>`. */
  | 'chapter';

export type Notification = {
  id: string;
  kind: 'streak' | 'reminder' | 'report' | 'payment';
  title: string;
  body: string;
  at: number;
  target?: NotificationTarget;
  /** The chapter a `chapter` target opens. */
  chapterId?: string;
  read: boolean;
};

/**
 * A stored or pushed target, split into the destination and its chapter.
 *
 * The notifications column and the push payload are plain text, so a chapter
 * travels as `chapter:<id>`. Anything neither app can route comes back empty,
 * and a `chapter` with no id is not a destination either.
 */
export function parseNotificationTarget(raw: unknown): { target?: NotificationTarget; chapterId?: string } {
  if (typeof raw !== 'string' || !raw) return {};
  if (raw.startsWith('chapter:')) {
    const chapterId = raw.slice('chapter:'.length);
    return chapterId ? { target: 'chapter', chapterId } : {};
  }
  return (NOTIFICATION_TARGETS as readonly string[]).includes(raw) && raw !== 'chapter' ? { target: raw as NotificationTarget } : {};
}

export const NOTIFICATION_TARGETS: readonly NotificationTarget[] = [
  'home',
  'study',
  'practice',
  'progress',
  'session-setup',
  'report',
  'payments',
  'subscription',
  'chapter',
];
