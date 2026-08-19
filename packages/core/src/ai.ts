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
import { aiGet, aiPost } from './tutor';
import type { SyncClient } from './sync';
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

export async function generateAiSession(
  input: {
    kind: AiSessionKind;
    chapterId: string;
    topic?: string;
    count: number;
    medium: string;
  },
  /** Lets the wait screen stop waiting. The server finishes either way and the
   *  set is saved, so a cancelled build is on the sets shelf, not lost. */
  signal?: AbortSignal,
): Promise<{ ok: true; sessionId: string; items: unknown[]; quota: TutorQuota } | AiFail> {
  const res = await aiPost<{ sessionId: string; items: unknown[]; quota: TutorQuota }>('/api/ai/generate-session', input, signal);
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

export async function generateMockPaper(
  input: { subjectId: string; medium: string },
  /** See generateAiSession: the paper is saved even if nobody waited for it. */
  signal?: AbortSignal,
): Promise<{ ok: true; sessionId: string; items: AiPaperItems; quota: TutorQuota } | AiFail> {
  const res = await aiPost<{ sessionId: string; items: AiPaperItems; quota: TutorQuota }>('/api/ai/mock-paper', input, signal);
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

/**
 * A one-time link that opens the website already signed in, on the upgrade
 * page. The Android app can only be consumed from, not bought in, so this
 * exists so a student does not have to sign in a second time on a phone
 * keyboard just to pay.
 *
 * Returns null rather than throwing: a student who cannot get a link should
 * still see the plain address they can type, not an error.
 */
export async function fetchUpgradeLink(): Promise<string | null> {
  const res = await aiPost<{ url?: string }>('/api/upgrade-link', {});
  return res.ok ? (res.data.url ?? null) : null;
}

/**
 * The student's latest coach report, if the nightly job has written one.
 *
 * A read, not a generation: null simply means there is nothing to say yet,
 * which is the normal state for a student who signed up an hour ago. The card
 * greets them itself in that case rather than showing nothing, which is what
 * it used to do.
 */
export async function fetchLatestCoachReport(): Promise<CoachReport | null> {
  const res = await aiGet<{ report: CoachReport | null }>('/api/ai/coach');
  return res.ok ? (res.data.report ?? null) : null;
}

/**
 * Record a thumbs up or down on a tutor answer.
 *
 * Both apps showed the buttons, latched them, and told the student it was
 * noted. Nothing was written anywhere, so the one signal a student actually
 * volunteers about answer quality was being thrown away and they were being
 * told otherwise.
 *
 * Fire and forget by design: a rating that fails to save must not interrupt
 * the conversation, and the student has already been thanked.
 */
export async function rateTutorAnswer(
  client: SyncClient,
  input: { messageId: string; userId: string; rating: 'up' | 'down' },
): Promise<void> {
  try {
    await client
      .from('tutor_feedback')
      .upsert(
        { message_id: input.messageId, user_id: input.userId, rating: input.rating, at: new Date().toISOString() },
        { onConflict: 'message_id,user_id' },
      );
  } catch {
    // Deliberately silent. See above.
  }
}
