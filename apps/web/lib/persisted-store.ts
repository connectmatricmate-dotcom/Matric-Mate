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
import { Attempt, Language, Medium, Group, Notification, SyncOp, TestResult, accessFor, enqueueOp, todayKey, type Access } from '@matricmate/core';

// v2: the fake "demo seed" that used to write sample attempts, results and a
// streak on first sign-in is gone. Bumping the key throws away anything a
// browser already had stored under v1, so nobody's dashboard still shows the
// fabricated history. Do not revert this to v1.
const KEY = 'mm.web.v2';

export type Onboarding = {
  classLevel: 9 | 10;
  /**
   * Absent until the student has chosen one, or the account says which.
   *
   * It used to be filled with 'fbise' the moment the class step wrote
   * anything, which made "has not chosen yet" and "chose FBISE" the same
   * value. The board step then could not tell a first choice from a change,
   * and a Punjab student whose browser had not loaded their account yet was
   * shown FBISE and moved to it by pressing Continue. Readers default it with
   * `?? 'fbise'`, the database's own default.
   */
  board?: 'fbise' | 'punjab';
  medium: Medium;
  group: Group;
  subjects: string[];
};

/**
 * Why an account without a plan has none: a free trial or a plan that ran out
 * on a date, or one switched off early by hand. Absent for an account that
 * never had one. "No plan yet" was said to all four, which told a student
 * whose month had just ended that they had never paid.
 */
export type Lapse = { kind: 'trial' | 'plan'; at: number } | { kind: 'off'; at: number };

export type Settings = {
  language: Language;
  /** Index into core's AVATARS cast, chosen on the edit-profile screen. */
  avatar: number;
  dark: boolean;
  reminders: boolean;
  reminderTime: string;
  streakAlerts: boolean;
  /** Which channels may carry a notification. See AccountPrefs in core. */
  channelPush: boolean;
  channelEmail: boolean;
  contentMedium: Medium;
  fontScale: 0 | 1 | 2;
};

export type State = {
  /**
   * Which account the rest of this object belongs to.
   *
   * Everything below is a cache of one student, and the moment a different
   * one signs in in this browser it is not merely stale, it is somebody
   * else's. Persisted so the check survives the tab being closed between the
   * two sign-ins.
   */
  ownerId: string | null;
  user: { id: string; name: string; contact: string } | null;
  onboarding: Onboarding | null;
  /** `plan` is the PlanId from lib/plans, so the app can name what was bought
   * instead of just saying "Premium". */
  premium: { active: boolean; validTill: number | null; ref?: string; plan?: string; trialSubject?: string; lapse?: Lapse };
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  planDone: string[];
  ai: { day: string; used: number };
  notifications: Notification[];
  settings: Settings;
  lastChapterId?: string;
  lastSectionIndex: number;
  activeDays: string[];
  xp: number;
  cardsKnown: string[];
  /**
   * The account's last wipe (profiles.progress_reset_at) this copy was built
   * against. A newer one on the server means this copy is from before a reset
   * or a switch, and it is replaced rather than merged (see staleCopy in core).
   */
  progressEpoch?: number | null;
  /** False until the saved snapshot has been read, so the UI can hold off. */
  hydrated: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  avatar: 0,
  dark: false,
  reminders: true,
  reminderTime: '7:00 PM',
  streakAlerts: true,
  channelPush: true,
  channelEmail: true,
  contentMedium: 'en',
  fontScale: 1,
};

/** Stable reference, `useSyncExternalStore` requires the server snapshot not to change identity. */
export const EMPTY: State = {
  ownerId: null,
  user: null,
  onboarding: null,
  premium: { active: false, validTill: null },
  readSections: [],
  attempts: [],
  results: [],
  planDone: [],
  ai: { day: todayKey(), used: 0 },
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

/**
 * What the server renders with, before localStorage exists.
 *
 * Returning the plain defaults meant every server-rendered page came out in
 * English and then swapped to Urdu the moment the store hydrated: an Urdu
 * student watched a page of English words, laid out right to left, rewrite
 * itself. The language cookie is the one piece of the preference the server
 * can see, so the server snapshot starts from it.
 *
 * Whether the account has a plan comes from the server too: the app layout
 * has already asked, because the paywall depends on it. Without it every
 * paying student opened the app on the free state (locked chapters, "no plan",
 * a red 0/0 in the header) until the browser's own entitlement read came
 * back, which on 3G is seconds and on a failed read is forever.
 *
 * Everything else here is per-device progress that has no business being
 * guessed.
 *
 * Constants rather than one mutable module variable: this runs on a server
 * handling many requests at once, and a module-level "current language" would
 * let an Urdu request repaint an English one. And they must be stable by
 * reference, because useSyncExternalStore compares snapshots by identity and a
 * fresh object per call never settles.
 */
const URDU: Settings = { ...DEFAULT_SETTINGS, language: 'ur', contentMedium: 'ur' };

/** What the layout read of the plan, for the first render: see seedFromServer. */
/**
 * The plan the server read, for the first frame. `validTill` rides along so
 * the trial strip and the plan pages have their date from the start: without
 * it they read "last day" and "open until ." until the browser asked again.
 */
export type PlanSeed = { active: boolean; plan?: string; trialSubject?: string | null; validTill?: number | null };

/*
 * One snapshot per language and plan, made once and reused. Since there are
 * two plans and a trial, "paid or not" is no longer enough to render the
 * first frame right (a Basic student must not see the AI tutor for the moment
 * before the browser re-reads the plan), and each combination still has to
 * come back as the same object every time it is asked for.
 */
const SERVER_SNAPSHOTS = new Map<string, State>();

export const serverSnapshotFor = (lang: 'en' | 'ur', seed?: PlanSeed | null): State => {
  const key = `${lang}|${seed?.active ? `${seed.plan ?? ''}|${seed.trialSubject ?? ''}|${seed.validTill ?? ''}` : 'free'}`;
  let snap = SERVER_SNAPSHOTS.get(key);
  if (!snap) {
    // The end date makes keys nearly one per student, so the cache is kept
    // small: it only has to hold the snapshots of the requests in flight.
    if (SERVER_SNAPSHOTS.size > 200) SERVER_SNAPSHOTS.clear();
    const base = lang === 'ur' ? { ...EMPTY, settings: URDU } : EMPTY;
    snap = seed?.active
      ? { ...base, premium: { active: true, validTill: seed.validTill ?? null, plan: seed.plan, trialSubject: seed.trialSubject ?? undefined } }
      : base;
    SERVER_SNAPSHOTS.set(key, snap);
  }
  return snap;
};
export const getServerSnapshot = () => serverSnapshotFor('en');

/**
 * Starts the browser's store from what the server rendered with, once.
 *
 * Called while AppProvider renders, before the first read of the store, so
 * the first client render agrees with the server's and a paying student never
 * sees a lock, even for a frame. Only the pristine store is touched: once
 * anything real has been read or written, the server's hint has nothing to
 * add. The same object as the server snapshot, so React finds nothing to
 * re-render after hydration. Never on the server, where this module is shared
 * by every request.
 */
export function seedFromServer(lang: 'en' | 'ur', seed?: PlanSeed | null): void {
  if (typeof window === 'undefined' || state !== EMPTY) return;
  state = serverSnapshotFor(lang, seed);
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      /**
       * Everything except premium. Entitlement is server truth, refreshed on
       * every load, and caching it here had two failure modes: a signed-out
       * machine kept showing the last account's plan, and an expired plan
       * survived until the next sync. The first render takes it from the
       * layout instead, which has just read it (see seedFromServer).
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
  /*
   * Nothing saved (a new browser, cleared storage, a private window) starts
   * from what the server rendered with rather than from English and no plan.
   * Starting from EMPTY rewrote an Urdu cookie to English on the next render
   * and flipped the page, and dropped the plan the layout had already vouched
   * for.
   */
  let restored: State = { ...state, hydrated: true };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      /**
       * Interface language and syllabus language are one choice now. A
       * snapshot written under the old split can hold two different values,
       * so the syllabus wins: it is the one attached to real content, and a
       * student reading Urdu notes wants an Urdu app.
       */
      const one = parsed.onboarding?.medium ?? settings.contentMedium ?? settings.language;
      restored = {
        ...EMPTY,
        ...parsed,
        settings: { ...settings, language: one, contentMedium: one },
        onboarding: parsed.onboarding ? { ...parsed.onboarding, medium: one } : (parsed.onboarding ?? null),
        // Never from storage: snapshots written before premium was excluded
        // may still carry an old one. The server's word, seeded above, stands
        // until the browser's own read replaces it.
        premium: state.premium,
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

/** What the stored plan lets this student do. See accessFor in core. */
export const accessOf = (premium: State['premium']): Access =>
  accessFor({ active: premium.active, plan: premium.plan ?? null, validTill: premium.validTill, trialSubject: premium.trialSubject ?? null });

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

/**
 * Lets go of the in-memory queue and leaves the saved one where it is.
 *
 * For signing out: what could not be sent is real work, and it still goes the
 * next time that student signs in on this browser, under their own key. The
 * sign-out used to save an empty queue over it, and every answer given
 * offline before signing out was lost.
 */
export function unloadQueue(): void {
  syncQueue = [];
}

/** Deletes a user's saved queue: for an account that no longer exists. */
export function forgetQueue(userId: string): void {
  syncQueue = [];
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(queueStorageKey(userId));
  } catch {
    // storage blocked; nothing was saved there either
  }
}

/** Appends one write, deduplicating against anything already queued for the same fact. */
export function pushToQueue(userId: string, op: SyncOp): SyncOp[] {
  const next = enqueueOp(syncQueue, op);
  saveQueue(userId, next);
  return next;
}

/**
 * The settings that describe this browser rather than this student, kept when
 * the account changes.
 *
 * Language, reading size and dark mode are about the person at the screen, so
 * making somebody set them again because a sibling signed in would be obtuse.
 * Everything else resets: the avatar is part of a profile, and the
 * notification preferences come back from the server on the next hydrate.
 */
export const devicePrefs = (s: Settings): Settings => ({
  ...EMPTY.settings,
  language: s.language,
  contentMedium: s.contentMedium,
  dark: s.dark,
  fontScale: s.fontScale,
});
