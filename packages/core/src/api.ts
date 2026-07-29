/**
 * MOCK API, the single seam between the UI and the backend.
 *
 * Every function here is async with a little latency so real loading states are
 * exercised. When Supabase arrives (M2) only this file changes: each function
 * becomes a query/RPC call and the screens stay exactly as they are.
 */
import {
  ALL_CHAPTERS,
  CHAPTERS,
  PAST_PAPERS,
  SUBJECTS,
  chapterById,
  contentFor,
  isAuthored,
  subjectById,
} from './content';
import { Chapter, ChapterContent, Flashcard, Mcq, PastPaper, Subject } from './types';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Simulated network latency, keep small so the demo feels quick but honest. */
const LATENCY = 180;

export const api = {
  async getSubjects(ids?: string[]): Promise<Subject[]> {
    await wait(LATENCY);
    return ids?.length ? SUBJECTS.filter((s) => ids.includes(s.id)) : SUBJECTS;
  },

  async getSubject(id: string): Promise<Subject | undefined> {
    await wait(60);
    return subjectById(id);
  },

  async getChapters(subjectId: string): Promise<Chapter[]> {
    await wait(LATENCY);
    return CHAPTERS[subjectId] ?? [];
  },

  async getChapter(id: string): Promise<Chapter | undefined> {
    await wait(90);
    return chapterById(id);
  },

  async getChapterContent(chapterId: string): Promise<ChapterContent> {
    await wait(LATENCY);
    return contentFor(chapterId);
  },

  /** Question set for a practice session or exam. */
  async getMcqs(opts: { chapterIds?: string[]; subjectId?: string; count: number; topics?: string[] }): Promise<Mcq[]> {
    await wait(LATENCY);
    let pool: Mcq[] = [];
    const chapters = opts.chapterIds?.length
      ? (opts.chapterIds.map(chapterById).filter(Boolean) as Chapter[])
      : ALL_CHAPTERS.filter((c) => (opts.subjectId ? c.subjectId === opts.subjectId : true));
    chapters.forEach((c) => pool.push(...contentFor(c.id).mcqs));
    if (opts.topics?.length) {
      const t = pool.filter((m) => opts.topics!.includes(m.topic));
      if (t.length >= 4) pool = t;
    }
    // Fully authored chapters come first so a session leads with real questions;
    // within each group the order is deterministic so review stays reproducible.
    const out = [...pool].sort((a, b) => {
      const rank = Number(isAuthored(b.chapterId)) - Number(isAuthored(a.chapterId));
      return rank !== 0 ? rank : a.id.localeCompare(b.id);
    });
    return out.slice(0, opts.count);
  },

  async getFlashcards(chapterId: string): Promise<Flashcard[]> {
    await wait(LATENCY);
    return contentFor(chapterId).flashcards;
  },

  async getPastPapers(subjectId?: string): Promise<PastPaper[]> {
    await wait(LATENCY);
    return subjectId ? PAST_PAPERS.filter((p) => p.subjectId === subjectId) : PAST_PAPERS;
  },

  /* ----------------------------------------------------------------- auth */

  /*
   * There is no mock auth here any more, deliberately.
   *
   * signUp, signIn and requestPasswordReset used to live at this spot and would
   * accept any email with a six-character password, returning a hardcoded
   * `u_demo`. Both apps now use Supabase, so leaving working fakes next to the
   * real thing is an invitation to wire the wrong one back in by accident.
   *
   * Web: apps/web/app/(auth)/actions.ts · Android: apps/mobile/src/store/auth.tsx
   */

  /* ------------------------------------------------------------- payments */

  /** Mock Safepay checkout. In M4 this hits the real hosted checkout + webhook. */
  async pay(input: { method: 'card' | 'jazzcash' | 'easypaisa'; amount: number }) {
    await wait(1400);
    return {
      ref: `SP-${Math.floor(100000 + (input.amount % 7919) * 13 + input.method.length * 977)}`,
      validTill: Date.now() + 30 * 864e5,
    };
  },

  /* ------------------------------------------------------------------- AI */

  /**
   * Mock AI tutor. Returns a canned step-by-step answer with a small delay so the
   * streaming/typing UI is real. M3 replaces this with a Claude call through a
   * Supabase Edge Function that also enforces the per-user daily quota.
   */
  async askTutor(question: string, context?: string): Promise<{ text: string; steps: string[] }> {
    await wait(1200);
    const q = question.toLowerCase();
    if (q.includes('velocity') || q.includes('speed'))
      return {
        text: 'Great question! Short answer first, phir steps:',
        steps: [
          'Speed = only how fast (magnitude). 60 km/h, bas.',
          'Velocity = how fast plus direction. 60 km/h towards north.',
          'Direction badle to velocity badal jati hai, even at constant speed. That’s why circular motion has acceleration!',
        ],
      };
    if (q.includes('newton') || q.includes('f = ma') || q.includes('force'))
      return {
        text: 'Newton’s second law, step by step:',
        steps: [
          'A net force on a body produces acceleration in the same direction.',
          'a ∝ F (more force, more acceleration) and a ∝ 1/m (more mass, less acceleration).',
          'Together: F = ma. For 5 kg with 20 N → a = 20/5 = 4 m/s².',
        ],
      };
    if (q.includes('inertia'))
      return {
        text: 'Inertia, asaan lafzon mein:',
        steps: [
          'Every body resists a change in its state of rest or motion.',
          'That resistance is called inertia, and mass is its measure.',
          'Bus achanak ruke to aap aage gir jate hain, kyunke upper body inertia ki wajah se chalta rehta hai.',
        ],
      };
    return {
      text: `Let’s work through “${question.trim() || 'your question'}”${context ? ` (${context})` : ''}:`,
      steps: [
        'Pehle dekhein ke sawal kis concept ka hai, phir usay naam dein.',
        'Us concept ki definition aur formula likhein, phir given values daalein.',
        'Jawab unit ke saath likhein aur aik line mein wajah batayein.',
        'Note: this demo returns a sample answer. The live tutor (M3) runs on Claude with a daily quota per student.',
      ],
    };
  },

  /** Mock AI question generation, used by the AI test screen. */
  async generateTest(topics: string[], count: number): Promise<Mcq[]> {
    await wait(1600);
    const pool: Mcq[] = [];
    ALL_CHAPTERS.forEach((c) => pool.push(...contentFor(c.id).mcqs.map((m) => ({ ...m, source: 'ai' as const }))));
    const focused = pool.filter((m) => topics.includes(m.topic));
    const chosen = (focused.length >= count ? focused : [...focused, ...pool]).slice(0, count);
    return chosen;
  },
};
