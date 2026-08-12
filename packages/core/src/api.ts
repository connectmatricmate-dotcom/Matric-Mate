/**
 * The seam between the UI and the backend.
 *
 * Every screen in both apps calls these functions and none of them knows where
 * the answer came from. That was the point of the mock: when real content
 * arrived, only this file would change. It has now, and it did.
 *
 * Content reads go to Postgres through ./db, which falls back to the bundled
 * sample whenever the database is unreachable, so the apps still work on a bad
 * connection and still work with no connection at all. The tutor and the
 * generator below are still mocks and are labelled as such.
 */
import {
  fetchAudioTracks,
  fetchChapter,
  fetchChapterContent,
  fetchChapters,
  fetchFlashcards,
  fetchMcqs,
  fetchSubject,
  fetchSubjects,
} from './db';
import { ALL_CHAPTERS, contentFor } from './content';
import type { ContentClient } from './db';
import { AudioTrack, Chapter, ChapterContent, Flashcard, Mcq, Subject } from './types';

/** Still needed by the two mocks below, which fake their own latency. */
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Every content read takes an optional client, and this is not decoration.
 *
 * The browser and the mobile app connect one long-lived client with
 * `connectContent` and never pass one here. A Next.js server cannot do that:
 * module state is shared across requests, so a client built from one student's
 * cookies would end up serving another student's page. Server code therefore
 * builds a client per request and hands it in. Getting this wrong is not a
 * rendering bug, it is one student seeing another's session.
 */
export const api = {
  getSubjects: (ids?: string[], client?: ContentClient): Promise<Subject[]> => fetchSubjects(ids, client),

  getSubject: (id: string, client?: ContentClient): Promise<Subject | undefined> => fetchSubject(id, client),

  getChapters: (subjectId: string, client?: ContentClient): Promise<Chapter[]> => fetchChapters(subjectId, client),

  getChapter: (id: string, client?: ContentClient): Promise<Chapter | undefined> => fetchChapter(id, client),

  getChapterContent: (chapterId: string, client?: ContentClient): Promise<ChapterContent> =>
    fetchChapterContent(chapterId, client),

  /** Question set for a practice session or exam. */
  getMcqs: (
    opts: { chapterIds?: string[]; subjectId?: string; count: number; topics?: string[] },
    client?: ContentClient,
  ): Promise<Mcq[]> => fetchMcqs(opts, client),

  getFlashcards: (chapterId: string, client?: ContentClient): Promise<Flashcard[]> => fetchFlashcards(chapterId, client),
  getAudioTracks: (chapterId: string, client?: ContentClient): Promise<AudioTrack[]> => fetchAudioTracks(chapterId, client),

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
        'Note: yeh preview ka sample jawab hai. Live tutor aap ke asal sawal ka jawab de ga.',
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
