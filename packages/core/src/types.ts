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

export type Chapter = {
  id: string;
  subjectId: string;
  number: number;
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

export type PaperSection = { heading: string; marks?: string; lines: string[]; urdu?: boolean };

export type PastPaper = {
  id: string;
  subjectId: string;
  year: number;
  session: 'Annual' | 'Supplementary';
  marks: number;
  minutes: number;
  downloaded: boolean;
};

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
  | 'subscription';

export type Notification = {
  id: string;
  kind: 'streak' | 'reminder' | 'report' | 'payment';
  title: string;
  body: string;
  at: number;
  target?: NotificationTarget;
  read: boolean;
};
