/**
 * The active practice/exam session.
 *
 * Deliberately a small module singleton rather than router params: a session
 * carries a question list and answer history, which URLs shouldn't. Screens read
 * it on mount; it is cleared when a new session starts.
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
    if (!current) return;
    current.answers[a.mcqId] = a;
  },
  toggleFlag(mcqId: string) {
    if (!current) return;
    const a = current.answers[mcqId] ?? { mcqId, chosen: null, confidence: null, correct: false };
    current.answers[mcqId] = { ...a, flagged: !a.flagged };
  },
  clear() {
    current = null;
  },
  score() {
    if (!current) return { score: 0, total: 0 };
    const answered = Object.values(current.answers);
    return { score: answered.filter((a) => a.correct).length, total: current.mcqs.length };
  },
};
