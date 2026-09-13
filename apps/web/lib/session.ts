/**
 * The active practice or exam session.
 *
 * A module singleton rather than router state: a session carries a question
 * list and an answer history, which don't belong in a URL. Mirrors
 * apps/mobile/src/store/session.ts.
 */
import { Confidence, Mcq } from '@matricmate/core';

export type Answer = {
  mcqId: string;
  chosen: number | null;
  confidence: Confidence | null;
  correct: boolean;
  flagged?: boolean;
};

export type SessionState = {
  mode: 'practice' | 'exam';
  label: string;
  subjectId: string;
  chapterId: string | null;
  mcqs: Mcq[];
  answers: Record<string, Answer>;
  startedAt: number;
  durationSec?: number;
  aiGenerated?: boolean;
};

let current: SessionState | null = null;

export const session = {
  get current() {
    return current;
  },
  start(s: Omit<SessionState, 'answers' | 'startedAt'>) {
    current = { ...s, answers: {}, startedAt: Date.now() };
    return current;
  },
  answer(a: Answer) {
    if (current) current.answers[a.mcqId] = a;
  },
  clear() {
    current = null;
  },
};

/**
 * Out of a finished set, back to wherever it was opened from: the chapter,
 * Practice, weak topics, a subject, the tutor.
 *
 * Setup, the questions and the result replace one another as a set runs, so
 * the page behind the result is the one the student started from, and going
 * back to it leaves no finished set in the history for the browser's back
 * button to find. "Done" used to send everyone to /practice, so a student who
 * opened MCQs from a chapter lost the chapter. With no page of ours behind (the
 * set was opened from a shared link), the chapter it was on, or Practice.
 */
export function leaveSession(router: { back(): void; replace(href: string): void }, canGoBack: boolean) {
  const s = current;
  current = null;
  if (s && canGoBack) router.back();
  else router.replace(s?.chapterId ? `/learn/chapter/${s.chapterId}` : '/practice');
}
