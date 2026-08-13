/**
 * Typed clients for the AI feature routes, shared by both apps.
 *
 * Everything here goes through aiPost in ./tutor, so auth, the shared
 * failure vocabulary (offline / quota / rate / plan / refused / error) and
 * the quota snapshot in every reply come for free. The normalisers turn the
 * server's raw generated items into the app's own item types, minting local
 * ids, so the session screens run an AI set exactly like a bank set.
 */
import { weakTopics } from './domain';
import { aiPost } from './tutor';
import type { AiFail, TutorQuota } from './tutor';
import type { Attempt, Blank, Flashcard, Mcq, ShortQ } from './types';

export type AiSessionKind = 'mcq' | 'flashcards' | 'blanks' | 'shortq';

export type AiPaperItems = { mcqs: Mcq[]; shortQs: ShortQ[]; longQs: ShortQ[] };

export type AiCheckVerdict = {
  score: number;
  maxMarks: number;
  feedback: string;
  missed: string[];
  quota?: TutorQuota;
};

export type CoachReport = {
  summary: string;
  weak: { topic: string; why: string }[];
  actions: string[];
};

/* ------------------------------------------------------------ normalisers */

type RawMcq = { q: string; options: string[]; answer: number; explanation: string; difficulty: string };
type RawCard = { front: string; back: string };
type RawBlank = { before: string; after: string; answer: string; options: string[] };
type RawShortQ = { q: string; answer: string; points: string[]; marks: number };

export function normalizeAiMcqs(items: RawMcq[], chapterId: string, topic?: string): Mcq[] {
  return items.map((m, i) => ({
    id: `ai-${i}`,
    chapterId,
    topic: topic ?? '',
    q: m.q,
    options: m.options,
    answer: m.answer,
    explanation: m.explanation,
    difficulty: (['easy', 'medium', 'hard'].includes(m.difficulty) ? m.difficulty : 'medium') as Mcq['difficulty'],
    source: 'ai',
  }));
}

export function normalizeAiCards(items: RawCard[], chapterId: string): Flashcard[] {
  return items.map((c, i) => ({ id: `ai-${i}`, chapterId, front: c.front, back: c.back }));
}

export function normalizeAiBlanks(items: RawBlank[], chapterId: string): Blank[] {
  return items.map((b, i) => ({
    id: `ai-${i}`,
    chapterId,
    sentence: [b.before, b.after] as [string, string],
    answer: b.answer,
    options: b.options,
  }));
}

export function normalizeAiShortQs(items: RawShortQ[], chapterId: string): ShortQ[] {
  return items.map((s, i) => ({ id: `ai-${i}`, chapterId, marks: s.marks, q: s.q, answer: s.answer, points: s.points }));
}

/* ----------------------------------------------------------------- routes */

export async function generateAiSession(input: {
  kind: AiSessionKind;
  chapterId: string;
  topic?: string;
  count: number;
  medium: string;
}): Promise<{ ok: true; sessionId: string; items: unknown[]; quota: TutorQuota } | AiFail> {
  const res = await aiPost<{ sessionId: string; items: unknown[]; quota: TutorQuota }>('/api/ai/generate-session', input);
  return res.ok ? { ok: true, ...res.data } : res;
}

export async function checkAnswerLive(input: {
  question: string;
  modelAnswer: string;
  points: string[];
  marks: number;
  answer: string;
  medium?: string;
}): Promise<{ ok: true; verdict: AiCheckVerdict } | AiFail> {
  const res = await aiPost<AiCheckVerdict>('/api/ai/check-answer', input);
  return res.ok ? { ok: true, verdict: res.data } : res;
}

export async function generateMockPaper(input: {
  subjectId: string;
  medium: string;
}): Promise<{ ok: true; sessionId: string; items: AiPaperItems; quota: TutorQuota } | AiFail> {
  const res = await aiPost<{ sessionId: string; items: AiPaperItems; quota: TutorQuota }>('/api/ai/mock-paper', input);
  return res.ok ? { ok: true, ...res.data } : res;
}

/**
 * The compact week-in-review the coach route reads. Built client-side because
 * the apps already hold the attempt history for their progress screens.
 */
export function buildCoachDigest(input: {
  attempts: Attempt[];
  streak: number;
  xp: number;
  subjects: string[];
  language: string;
}) {
  const weekAgo = Date.now() - 7 * 864e5;
  const recent = input.attempts.filter((a) => a.at >= weekAgo);
  const correct = recent.filter((a) => a.correct).length;
  return {
    streak: input.streak,
    xp: input.xp,
    attemptsThisWeek: recent.length,
    accuracyPct: recent.length ? Math.round((correct / recent.length) * 100) : 0,
    topics: weakTopics(input.attempts, 2)
      .slice(0, 8)
      .map((w) => ({ topic: w.topic, pct: w.accuracy, tries: w.total })),
    subjects: input.subjects,
    language: input.language,
  };
}

export async function fetchCoachReport(digest: {
  streak: number;
  xp: number;
  attemptsThisWeek: number;
  accuracyPct: number;
  topics: { topic: string; pct: number; tries: number }[];
  subjects: string[];
  language: string;
}): Promise<{ ok: true; report: CoachReport; cached: boolean } | AiFail> {
  const res = await aiPost<{ report: CoachReport; cached: boolean }>('/api/ai/coach', { digest });
  return res.ok ? { ok: true, ...res.data } : res;
}

export async function fetchCheatSheet(input: {
  chapterId: string;
  medium: string;
}): Promise<{ ok: true; sheet: string; cached: boolean } | AiFail> {
  const res = await aiPost<{ sheet: string; cached: boolean }>('/api/ai/cheat-sheet', input);
  return res.ok ? { ok: true, ...res.data } : res;
}
