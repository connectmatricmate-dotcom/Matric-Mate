/**
 * The active practice/exam session.
 *
 * Deliberately a small module singleton rather than router params: a session
 * carries a question list and answer history, which URLs shouldn't. Screens read
 * it on mount; it is cleared when a new session starts.
 */
import { router } from 'expo-router';
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
  /**
   * Out of a finished set, back to wherever it was opened from.
   *
   * Setup, the questions and the result replace one another as a set runs, so
   * the screen underneath is the one the student started from: the chapter,
   * the Practice tab, weak topics, a subject's exam, the tutor. "Done" used to
   * send everyone to the Practice tab, and a student who opened MCQs from a
   * chapter lost the chapter and had to find the way back to it. With nothing
   * underneath (the app reopened on this screen), the Practice tab.
   */
  leave() {
    current = null;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/practice');
  },
  score() {
    if (!current) return { score: 0, total: 0 };
    const answered = Object.values(current.answers);
    return { score: answered.filter((a) => a.correct).length, total: current.mcqs.length };
  },
};
