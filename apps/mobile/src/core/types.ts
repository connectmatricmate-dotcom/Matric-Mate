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

/** One answered question — the row that powers every analytic in the app. */
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
 * Where a notification can send you. A closed union rather than a free string,
 * so renaming a route breaks the build instead of shipping a dead link.
 */
export type NotificationHref =
  | '/(tabs)'
  | '/(tabs)/study'
  | '/(tabs)/practice'
  | '/(tabs)/progress'
  | '/session/setup'
  | '/insights/report'
  | '/account/payments'
  | '/account/subscription';

export type Notification = {
  id: string;
  kind: 'streak' | 'reminder' | 'report' | 'payment';
  title: string;
  body: string;
  at: number;
  href?: NotificationHref;
  read: boolean;
};
