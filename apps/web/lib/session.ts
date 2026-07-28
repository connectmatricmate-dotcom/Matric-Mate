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
