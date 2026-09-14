/**
 * Typed clients for the AI feature routes, shared by both apps.
 *
 * Everything here goes through aiPost in ./tutor, so auth, the shared
 * failure vocabulary (offline / quota / rate / plan / refused / error) and
 * the quota snapshot in every reply come for free. The normalisers turn the
 * server's raw generated items into the app's own item types, minting local
 * ids, so the session screens run an AI set exactly like a bank set.
 */
import { subjectMedium } from './boards';
import { chapterById, subjectById } from './content';
import { contentBoard } from './db';
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

/** FNV-1a, 32 bit: a short, stable number for a piece of content. */
function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * What a set's item ids are built from.
 *
 * Every set used to number its items `ai-0`, `ai-1` and so on, so card 0 of
 * every AI flashcard set was the same card as far as the app could tell: its
 * XP was paid once, "Repeat" un-knew another set's card, and every set's
 * answers counted as the same few questions. The set's own id when the caller
 * has it (the saved session's id); otherwise a digest of the set's content,
 * which is just as stable when the same set is reopened and differs between
 * any two sets. Underscores, not hyphens, so no item id can be read as a
 * chapter id (see chapterOfId).
 */
const setToken = (setId: string | undefined, chapterId: string, items: unknown): string =>
  setId?.trim() || fnv(`${chapterId}|${JSON.stringify(items)}`).toString(36);

const itemId = (token: string, kind: string, i: number): string => `ai_${token}_${kind}${i}`;

/**
 * Never an empty topic. An empty one became a nameless weak topic, a "Fix ."
 * button, a blank task on the plan and an empty pill on the question. The
 * caller's topic, else the chapter's title (as the blanks and short-question
 * screens record theirs), else the subject's name.
 */
const topicFor = (chapterId: string, topic?: string): string =>
  topic?.trim() || chapterById(chapterId)?.title || subjectById(chapterId.split('-')[0])?.name || chapterId;

/** mulberry32: a seeded generator, so a reopened set keeps its option order. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Options that point at the others ("Both A and B", "None of the above") only make sense where they are. */
const POSITIONAL = [
  /\b(all|none) of (the )?(above|these|them)\b/i,
  /\bboth (of )?(these|them|the above)\b/i,
  /\bboth \(?[a-d]\)? (and|&) \(?[a-d]\)?(?![a-z])/i,
  /\bneither\b/i,
  /مندرجہ بالا|درج بالا|ان میں سے کوئی نہیں|دونوں/,
];

/**
 * The options in a new order, and where the answer went. A model writing a
 * question tends to write the right answer first, so an AI set was a set
 * where "A" was nearly always right.
 */
function shuffleOptions(options: string[], answer: number, rand: () => number): { options: string[]; answer: number } {
  if (!Array.isArray(options) || options.length < 2) return { options, answer };
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return { options, answer };
  if (options.some((o) => POSITIONAL.some((re) => re.test(String(o))))) return { options, answer };
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => options[i]), answer: order.indexOf(answer) };
}

export function normalizeAiMcqs(
  items: RawMcq[],
  chapterId: string,
  topic?: string,
  /** The saved set's id. Optional: see setToken. */
  setId?: string,
): Mcq[] {
  const token = setToken(setId, chapterId, items);
  const named = topicFor(chapterId, topic);
  const rand = seeded(fnv(token));
  return items.map((m, i) => {
    const { options, answer } = shuffleOptions(m.options, m.answer, rand);
    return {
      id: itemId(token, 'm', i),
      chapterId,
      topic: named,
      q: m.q,
      options,
      answer,
      explanation: m.explanation,
      difficulty: (['easy', 'medium', 'hard'].includes(m.difficulty) ? m.difficulty : 'medium') as Mcq['difficulty'],
      source: 'ai',
    };
  });
}

export function normalizeAiCards(items: RawCard[], chapterId: string, setId?: string): Flashcard[] {
  const token = setToken(setId, chapterId, items);
  return items.map((c, i) => ({ id: itemId(token, 'c', i), chapterId, front: c.front, back: c.back }));
}

export function normalizeAiBlanks(items: RawBlank[], chapterId: string, setId?: string): Blank[] {
  const token = setToken(setId, chapterId, items);
  return items.map((b, i) => ({
    id: itemId(token, 'b', i),
    chapterId,
    sentence: [b.before, b.after] as [string, string],
    answer: b.answer,
    options: b.options,
  }));
}

export function normalizeAiShortQs(items: RawShortQ[], chapterId: string, setId?: string): ShortQ[] {
  const token = setToken(setId, chapterId, items);
  return items.map((s, i) => ({ id: itemId(token, 's', i), chapterId, marks: s.marks, q: s.q, answer: s.answer, points: s.points }));
}

/**
 * The medium to ask the model for. A language subject is written in its own
 * language whatever the student reads in (see subjectMedium), and the screens
 * pass the student's medium, so an Urdu-medium student's English set came back
 * in Urdu script and an English-medium student's Urdu set in English.
 */
const askIn = (subjectOrChapterId: string, medium: string): string =>
  medium === 'en' || medium === 'ur' ? subjectMedium(subjectOrChapterId, contentBoard(), medium) : medium;

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
  const res = await aiPost<{ sessionId: string; items: unknown[]; quota: TutorQuota }>(
    '/api/ai/generate-session',
    { ...input, medium: askIn(input.chapterId, input.medium) },
    signal,
  );
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
  const res = await aiPost<{ sessionId: string; items: AiPaperItems; quota: TutorQuota }>(
    '/api/ai/mock-paper',
    { ...input, medium: askIn(input.subjectId, input.medium) },
    signal,
  );
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
  const res = await aiPost<{ sheet: string; cached: boolean }>('/api/ai/cheat-sheet', {
    ...input,
    medium: askIn(input.chapterId, input.medium),
  });
  return res.ok ? { ok: true, ...res.data } : res;
}

/* ------------------------------------------------------ career guidance */

/** One subject's practice record, the numbers the guidance is read from. */
export type CareerSubjectStat = { subject: string; answered: number; correct: number; accuracy: number };

/** What the AI reads in those numbers (see /api/ai/career). */
export type CareerReport = {
  summary: string;
  strengths: { subject: string; why: string }[];
  /** Class 11 groups: FSc Pre-Medical, Pre-Engineering, ICS, I.Com, FA. */
  streams: { name: string; why: string }[];
  fields: { name: string; why: string }[];
  nextSteps: string[];
};

/**
 * The career screen's whole state, from one read.
 *
 * `enough` says whether two subjects have `need` answers each: guidance from
 * three questions would be a guess dressed up as advice, so below that the
 * screen asks for more practice and never spends a question. `nextAt` is when
 * a fresh reading may be asked for; a report is kept for a week, and reading
 * the same results again sooner would only say the same thing.
 */
export type CareerState = {
  report: CareerReport | null;
  createdAt: string | null;
  stats: CareerSubjectStat[];
  answered: number;
  need: number;
  enough: boolean;
  nextAt: string | null;
  quota?: TutorQuota;
};

/** The saved guidance and the results behind it. Free: it never calls the model. */
export async function fetchCareer(): Promise<{ ok: true; data: CareerState } | AiFail> {
  return aiGet<CareerState>('/api/ai/career');
}

/** Write the guidance (or return this week's, when there is one). Costs one question. */
export async function buildCareer(language: 'en' | 'ur'): Promise<{ ok: true; data: CareerState } | AiFail> {
  return aiPost<CareerState>('/api/ai/career', { language });
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
