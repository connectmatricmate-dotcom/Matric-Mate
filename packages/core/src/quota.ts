import type { TutorQuota } from './tutor';

/**
 * One number for "how many AI questions are left today", shared by every
 * screen in both apps.
 *
 * There used to be two, and they disagreed on screen. The header read a local
 * counter the client kept itself, incrementing by one per AI action, while the
 * tutor page read the server's. But the server does not charge one per action:
 * a mock paper costs three, a generated set costs two. So one paper left the
 * header two ahead of the tutor page, which is what the client reported.
 *
 * The local counter was also per device, so a student on a phone and a laptop
 * saw two different numbers for the same day.
 *
 * There is no arithmetic here on purpose. Every AI response already carries the
 * server's own count, and `tutor.ts` funnels all of them through `setQuota`, so
 * the number a student reads is one the server actually wrote. Nothing guesses
 * a cost, which is the mistake that started this.
 *
 * Kept outside React so both apps and the non-React call sites share it, and
 * so a screen that mounts late still gets the current value rather than
 * refetching one of its own.
 */
let current: TutorQuota | null = null;
const listeners = new Set<() => void>();

export function getQuota(): TutorQuota | null {
  return current;
}

/**
 * Record the server's count. Ignores a stale answer: AI calls finish out of
 * order, and a slow paper landing after a fast chat must not wind the number
 * back up. `used` only ever climbs within a day, so it doubles as a sequence.
 */
export function setQuota(next: TutorQuota | null | undefined): void {
  if (!next) return;
  if (current && current.resetAt === next.resetAt && next.used < current.used) return;
  current = next;
  listeners.forEach((l) => l());
}

/** Cleared on sign-out, so the next student never sees the last one's count. */
export function clearQuota(): void {
  current = null;
  listeners.forEach((l) => l());
}

export function subscribeQuota(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The topic the database broadcasts a student's usage on. See migration 0015. */
export const quotaTopic = (userId: string) => `quota:${userId}`;
