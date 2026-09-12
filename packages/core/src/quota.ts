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
/** Whose count `current` is. Undefined until an app says who is signed in. */
let owner: string | null | undefined;
const listeners = new Set<() => void>();

/**
 * A count for a day that is over. `resetAt` is when the allowance comes back,
 * so once it has passed the number is yesterday's: a student who hit the limit
 * stayed locked out after midnight until the app process died, because
 * nothing ever replaced it. An unreadable time is taken at its word.
 */
const expired = (q: TutorQuota): boolean => {
  const at = Date.parse(q.resetAt);
  return Number.isFinite(at) && at <= Date.now();
};

/** Today's count, or null when there is none or it has run out of day. Null means "fetch it". */
export function getQuota(): TutorQuota | null {
  return current && !expired(current) ? current : null;
}

/**
 * Record the server's count. Ignores a stale answer: AI calls finish out of
 * order, and a slow paper landing after a fast chat must not wind the number
 * back up. `used` only ever climbs within a day, so it doubles as a sequence.
 *
 * `forUser` is who the count was asked for, when the caller knows (the AI
 * clients in tutor.ts capture it before the request goes out). An answer that
 * lands after the account changed belongs to the previous student and is
 * dropped. A count for a day already over is dropped too, as is one pieced
 * together from yesterday's `resetAt`.
 */
export function setQuota(next: TutorQuota | null | undefined, forUser?: string | null): void {
  if (!next) return;
  if (forUser !== undefined && owner !== undefined && forUser !== owner) return;
  if (expired(next)) return;
  if (current && !expired(current) && current.resetAt === next.resetAt && next.used < current.used) return;
  current = next;
  listeners.forEach((l) => l());
}

/** Cleared on sign-out, so the next student never sees the last one's count. */
export function clearQuota(): void {
  current = null;
  listeners.forEach((l) => l());
}

/**
 * Who is signed in, or null when nobody is. Call on every auth change. A
 * different account from the last clears the count, so the next student on a
 * shared phone never inherits the previous one's fifty used questions and a
 * disabled chat box. The same account again changes nothing, so a token
 * refresh does not blank the number.
 */
export function setQuotaUser(userId: string | null): void {
  if (userId === owner) return;
  owner = userId;
  clearQuota();
}

/** The account the count belongs to, as last told by setQuotaUser. */
export const quotaUser = (): string | null | undefined => owner;

export function subscribeQuota(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The topic the database broadcasts a student's usage on. See migration 0015. */
export const quotaTopic = (userId: string) => `quota:${userId}`;
