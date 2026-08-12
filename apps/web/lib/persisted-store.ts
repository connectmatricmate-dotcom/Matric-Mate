/**
 * The app's state lives outside React and components subscribe to it.
 *
 * Why not `useState` + a hydrate effect: reading localStorage on the server is
 * impossible, so the naive version renders empty, then calls setState in an
 * effect, a cascading render, and exactly what `react-hooks/set-state-in-effect`
 * warns about. An external store with `useSyncExternalStore` is the supported
 * shape for this: the server snapshot is empty, the client snapshot is whatever
 * was saved, and React reconciles without a second render pass.
 *
 * The state shape matches the Android app's store deliberately, see
 * apps/mobile/src/store/app.tsx.
 */
import { AI_QUOTA, Attempt, ChatThread, Language, Medium, Group, Notification, SyncOp, TestResult, XP, enqueueOp, todayKey } from '@matricmate/core';

// v2: the fake "demo seed" that used to write sample attempts, results and a
// streak on first sign-in is gone. Bumping the key throws away anything a
// browser already had stored under v1, so nobody's dashboard still shows the
// fabricated history. Do not revert this to v1.
const KEY = 'mm.web.v2';

export type Onboarding = {
  classLevel: 9 | 10;
  board: 'fbise' | 'punjab';
  medium: Medium;
  group: Group;
  subjects: string[];
};

export type Settings = {
  language: Language;
  dark: boolean;
  reminders: boolean;
  reminderTime: string;
  streakAlerts: boolean;
  contentMedium: Medium;
  fontScale: 0 | 1 | 2;
};

export type State = {
  user: { id: string; name: string; contact: string } | null;
  onboarding: Onboarding | null;
  /** `plan` is the PlanId from lib/plans, so the app can name what was bought
   * instead of just saying "Premium". */
  premium: { active: boolean; validTill: number | null; ref?: string; plan?: string };
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  planDone: string[];
  ai: { day: string; used: number };
  threads: ChatThread[];
  notifications: Notification[];
  settings: Settings;
  lastChapterId?: string;
  lastSectionIndex: number;
  activeDays: string[];
  xp: number;
  cardsKnown: string[];
  /** False until the saved snapshot has been read, so the UI can hold off. */
  hydrated: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  dark: false,
  reminders: true,
  reminderTime: '7:00 PM',
  streakAlerts: true,
  contentMedium: 'en',
  fontScale: 1,
};

/** Stable reference, `useSyncExternalStore` requires the server snapshot not to change identity. */
export const EMPTY: State = {
  user: null,
  onboarding: null,
  premium: { active: false, validTill: null },
  readSections: [],
  attempts: [],
  results: [],
  planDone: [],
  ai: { day: todayKey(), used: 0 },
  threads: [],
  notifications: [],
  settings: DEFAULT_SETTINGS,
  lastSectionIndex: 0,
  activeDays: [],
  xp: 0,
  cardsKnown: [],
  hydrated: false,
};

let state: State = EMPTY;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Caps on the histories that only ever grow. Without them a student answering
 * 30 MCQs a day crosses ~700KB of localStorage in a school term, every save
 * re-serialises all of it on the main thread, and the 5MB quota ends the story
 * with a silently swallowed write error and no more saved progress. Recent
 * history is what the analytics read anyway; XP and streak live in their own
 * counters and lose nothing when old rows fall off.
 */
const CAP = { attempts: 1000, results: 100, notifications: 50, activeDays: 400 };

function prune(s: State): State {
  if (
    s.attempts.length <= CAP.attempts &&
    s.results.length <= CAP.results &&
    s.notifications.length <= CAP.notifications &&
    s.activeDays.length <= CAP.activeDays
  ) {
    return s;
  }
  return {
    ...s,
    // attempts and activeDays append newest-last; results and notifications
    // insert newest-first. Both slices keep the newest rows.
    attempts: s.attempts.slice(-CAP.attempts),
    results: s.results.slice(0, CAP.results),
    notifications: s.notifications.slice(0, CAP.notifications),
    activeDays: s.activeDays.slice(-CAP.activeDays),
  };
}

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSnapshot = () => state;
export const getServerSnapshot = () => EMPTY;

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      /**
       * Everything except premium. Entitlement is server truth, refreshed on
       * every load, and caching it here had two failure modes: a signed-out
       * machine kept showing the last account's plan, and an expired plan
       * survived until the next sync. A one-render flash of the free state on
       * reload is the honest trade.
       */
      window.localStorage.setItem(KEY, JSON.stringify({ ...state, premium: EMPTY.premium }));
    } catch {
      // storage blocked or full, the session still works in memory
    }
  }, 250);
}

export function update(fn: (s: State) => State) {
  state = prune(fn(state));
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined' && state.hydrated) persist();
}

/** Reads the saved snapshot once, on the client. Safe to call repeatedly. */
export function hydrate() {
  if (state.hydrated) return;
  let restored: State = { ...EMPTY, hydrated: true };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      restored = {
        ...EMPTY,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        // Snapshots written before premium was excluded may still carry one.
        premium: EMPTY.premium,
        hydrated: true,
      };
    }
  } catch {
    // corrupt snapshot, start clean rather than crash
  }
  // Snapshots written before the caps existed may carry oversized histories.
  state = prune(restored);
  listeners.forEach((l) => l());
}

/** Marks today active; used by anything that counts as studying. */
export function touchToday(s: State): State {
  const t = todayKey();
  return s.activeDays.includes(t) ? s : { ...s, activeDays: [...s.activeDays, t] };
}

export const aiLimitFor = (premium: boolean) => (premium ? AI_QUOTA.premium : AI_QUOTA.free);
export const xpFor = XP.forAnswer;

/* --------------------------------------------------------------- sync queue */

/**
 * Study-state writes waiting to reach Postgres, mirroring `state` itself: an
 * in-memory copy the store reads and writes synchronously, backed by
 * localStorage so a closed tab does not lose them. store.tsx owns the
 * Supabase calls that drain this; this file only owns where it lives, the
 * same split as the state above.
 *
 * Keyed per user id, not one shared key, so a still-queued write from
 * whoever last used this browser is never sent under a different student's
 * session if someone else signs in on the same machine before it flushes.
 */
let syncQueue: SyncOp[] = [];

const queueStorageKey = (userId: string) => `mm.web.syncQueue.${userId}`;

export const getQueue = (): SyncOp[] => syncQueue;

/** Reads a user's queued writes off localStorage into memory. Call once, right after identifying who is signed in. */
export function loadQueue(userId: string): SyncOp[] {
  syncQueue = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(queueStorageKey(userId));
      if (raw) syncQueue = JSON.parse(raw) as SyncOp[];
    } catch {
      // corrupt queue, start empty rather than throw on a browser reload
    }
  }
  return syncQueue;
}

/** Replaces the in-memory queue and mirrors it to localStorage. Used both to append a write and to drop flushed/dead ones. */
export function saveQueue(userId: string, queue: SyncOp[]): void {
  syncQueue = queue;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(queueStorageKey(userId), JSON.stringify(queue));
  } catch {
    // storage blocked or full; the queue still lives in memory for this tab
  }
}

/** Appends one write, deduplicating against anything already queued for the same fact. */
export function pushToQueue(userId: string, op: SyncOp): SyncOp[] {
  const next = enqueueOp(syncQueue, op);
  saveQueue(userId, next);
  return next;
}
