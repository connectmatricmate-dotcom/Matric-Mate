/**
 * App state, session, onboarding choices, progress, attempts, AI usage, settings.
 *
 * Persisted to AsyncStorage so real progress survives reloads and app restarts.
 * Study-state (attempts, results, read sections, known cards, active days) is
 * also written through to Postgres, following the same shape as the
 * entitlement cache in store/auth.tsx: local state updates immediately, a
 * queued write follows in the background, and a bad connection only delays
 * the sync, never the screen. See @matricmate/core's sync.ts for the shared
 * queue/merge logic and the reasoning behind it.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Access,
  Attempt,
  Board,
  Group,
  Language,
  Medium,
  Notification,
  PlanTask,
  SyncOp,
  TestResult,
  XP,
  boardChoice,
  accessFor,
  buildPlan,
  clearContentCache,
  clearSyncQueue,
  contentVersion,
  enqueueOp,
  flushQueue,
  gradeChoice,
  hydrateStudyState,
  hydratedXp,
  level,
  markNotificationsRead,
  mergeHydratedState,
  newRowId,
  primeAllContent,
  setContentBoard,
  setContentGrade,
  setContentMedium,
  streakFrom,
  subscribeContent,
  syncAccountPrefs,
  syncActiveDay,
  syncAttempt,
  syncCardKnown,
  syncCardUnknown,
  syncPlanTask,
  syncReadSection,
  syncResult,
  todayKey,
  wipeStudyHistory,
  xpForAttempt,
} from '@matricmate/core';
import type { HydratedStudyState } from '@matricmate/core';
import { setBeforeSignOut, useAuth } from './auth';
import { session } from './session';
import { supabase } from '../lib/supabase';
import { useOnline } from '../core/connectivity';
import { deleteAllDownloads, deleteChapterDownload, downloadChapter as saveOffline } from '../core/downloads';
import { setDarkUi, setUrduUi } from '../theme';

// v2: the fake "demo seed" that used to write sample attempts, results and a
// streak on first sign-in is gone. Bumping the key throws away anything a
// device already had stored under v1, so nobody's dashboard still shows the
// fabricated history. Do not revert this to v1.
const KEY = 'mm.state.v2';

/**
 * Where a signed-in student's unsent writes wait. Keyed per user, not one
 * shared key, so a still-queued answer from whoever last used this phone can
 * never be attributed to the next person who signs in on it (a shared family
 * or classroom phone is not a hypothetical here). It is only ever loaded, and
 * so only ever sent, under its own student's session.
 */
const queueKey = (userId: string) => `mm.syncQueue.${userId}`;

async function loadQueue(userId: string): Promise<SyncOp[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(userId));
    return raw ? (JSON.parse(raw) as SyncOp[]) : [];
  } catch {
    return [];
  }
}

/**
 * Fire-and-forget on purpose. The queue that matters for correctness is the
 * in-memory `queueRef`; this write only protects against the app being killed
 * before the next flush. Nothing awaits it, and nothing should: an action
 * that answered a question must return the moment local state is updated.
 */
function saveQueue(userId: string, queue: SyncOp[]): void {
  AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue)).catch(() => {});
}

/**
 * How long a switch, a profile write or a sign-out flush waits on the network
 * before going ahead, and how long one read of the chapter index may take.
 * PostgREST does not reject a stalled request, it simply never settles, and
 * every await on it here sits in front of something a student is looking at.
 */
const NETWORK_WAIT_MS = 8000;
const PRIME_WAIT_MS = 15000;

/** `work`, or `fallback` if it fails or has not settled within `ms`. */
function within<T>(work: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(work).then(
      (value) => value,
      () => fallback,
    ),
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Module constant, not an inline literal: as a literal it took a new identity
 * on every derive, which defeated every useMemo keyed on derived.subjects and
 * re-walked all chapters per state change on the progress and report screens.
 */
const DEFAULT_SUBJECTS = ['phy', 'chem', 'bio', 'math', 'eng', 'urd', 'isl'];

export type Onboarding = {
  classLevel: 9 | 10;
  board: 'fbise' | 'punjab';
  medium: Medium;
  group: Group;
  subjects: string[];
};

const ONBOARDING_DEFAULTS: Onboarding = {
  classLevel: 9,
  board: 'fbise',
  medium: 'en',
  group: 'science',
  subjects: [],
};

const savedSubjects = (onboarding: unknown): string[] => {
  const list = (onboarding as { subjects?: unknown } | null)?.subjects;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
};

/**
 * The parts of a saved onboarding record this app can use, checked one by
 * one: the website writes the same column, and not always every field.
 */
function readSaved(saved: Record<string, unknown> | null): Partial<Onboarding> {
  const out: Partial<Onboarding> = {};
  const grade = gradeChoice(saved);
  if (grade) out.classLevel = grade;
  const board = boardChoice(saved);
  if (board) out.board = board;
  if (saved?.medium === 'en' || saved?.medium === 'ur') out.medium = saved.medium;
  if (saved?.group === 'science' || saved?.group === 'arts') out.group = saved.group;
  const subjects = savedSubjects(saved);
  if (subjects.length) out.subjects = subjects;
  return out;
}

export type Settings = {
  /** Language of the interface. Separate from `contentMedium`, which is the syllabus language. */
  language: 'en' | 'ur';
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
   * one signs in on this phone it is not merely stale, it is somebody else's.
   * Persisted so the check survives the app being killed between the two
   * sign-ins. Every reset keeps it: see `restart`.
   */
  ownerId: string | null;
  user: { id: string; name: string; contact: string } | null;
  onboarding: Onboarding | null;
  /** The plan, from the server (store/auth.tsx). `plan` and `trialSubject` since there are two plans and a trial. */
  premium: { active: boolean; validTill: number | null; ref?: string; plan?: string | null; trialSubject?: string | null };
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  planDone: string[];
  downloads: string[];
  ai: { day: string; used: number };
  notifications: Notification[];
  settings: Settings;
  lastChapterId?: string;
  /** Chapters whose 100% moment has already been celebrated on this device. */
  celebratedChapters: string[];
  /** Day key of the last streak-milestone celebration, so it fires once a day. */
  lastStreakCelebrated: string | null;
  lastSectionIndex: number;
  activeDays: string[];
  xp: number;
  cardsKnown: string[];
};

const DEFAULT_SETTINGS: Settings = {
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

const EMPTY: State = {
  ownerId: null,
  user: null,
  onboarding: null,
  premium: { active: false, validTill: null },
  readSections: [],
  attempts: [],
  results: [],
  planDone: [],
  downloads: [],
  ai: { day: todayKey(), used: 0 },
  notifications: [],
  settings: DEFAULT_SETTINGS,
  celebratedChapters: [],
  lastStreakCelebrated: null,
  lastSectionIndex: 0,
  activeDays: [],
  xp: 0,
  cardsKnown: [],
};

/**
 * The settings that describe this phone rather than this student, kept when
 * the account changes.
 *
 * Language, reading size and dark mode are about the person holding the
 * device and the screen they are holding, so making somebody set them again
 * because a sibling signed in would be obtuse. Everything else resets: the
 * avatar is part of a profile, and the notification preferences come back
 * from the server on the next hydrate anyway.
 */
const devicePrefs = (s: Settings): Settings => ({
  ...DEFAULT_SETTINGS,
  language: s.language,
  contentMedium: s.contentMedium,
  dark: s.dark,
  fontScale: s.fontScale,
});

/**
 * The nudge preferences belong to the account, so the server's copy wins
 * outright. Null means the student has never set them and this device's
 * defaults stand.
 */
const withAccountPrefs = (s: Settings, server: HydratedStudyState): Settings =>
  server.accountPrefs ? { ...s, ...server.accountPrefs } : s;

/**
 * Folds a hydrate into local state: the merge, the account's nudge
 * preferences, and XP.
 *
 * `pending` is the queue still to be sent. With it the merge lets known cards
 * and plan ticks follow the server except where this phone has a change on
 * its way, and XP is the server's own total plus what it has not summed yet
 * (hydratedXp; the server total needs migration 0039, and until then this is
 * the old recount from local history).
 */
function withServer(s: State, server: HydratedStudyState, pending: SyncOp[]): State {
  const merged = mergeHydratedState(s, server, pending);
  return { ...merged, settings: withAccountPrefs(s.settings, server), xp: hydratedXp(merged, server, pending) };
}

/* ------------------------------------------------------------------ context */

/**
 * Note what is missing: there is no signIn, signOut, subscribe or cancel here
 * any more. Identity and entitlement are owned by store/auth.tsx and come from
 * the server. A local `subscribe()` would have meant the phone could grant
 * itself premium, which is both a bug and the thing Play policy exists to stop.
 */
type Actions = {
  /** Records that a chapter's 100% moment has been shown, so it never repeats. */
  markChapterCelebrated: (chapterId: string) => void;
  markStreakCelebrated: () => void;
  /**
   * Saves onboarding choices. For the first run, and for the choices that
   * cost nothing to change (medium, subjects). A student who already has a
   * class or board changes it with switchClass or switchBoard, which also
   * start their progress over; this only clears the downloads and the
   * resume point, which belong to the old syllabus whoever is asking.
   */
  setOnboarding: (o: Partial<Onboarding>) => void;
  recordAttempt: (a: Omit<Attempt, 'id' | 'at'>) => Attempt;
  addResult: (r: Omit<TestResult, 'id' | 'at'>) => TestResult;
  markSectionRead: (sectionId: string, chapterId: string, index: number) => void;
  togglePlanTask: (id: string) => void;
  /**
   * Marks today as studied, with nothing else to record.
   *
   * Every other action that counts as studying does this on the way past:
   * answering a question, reading a section, finishing a test. Listening to an
   * audio lesson recorded nothing at all, so a student who studies by ear got
   * no streak and no active day for an hour of work.
   */
  markStudied: () => void;
  /**
   * Downloads a chapter for offline use, or removes it. Async, and reports
   * which of the three actually happened: a download is a real network fetch
   * plus a disk write, not a state flip, so a failed fetch or a failed write
   * must not add the chapter to state.downloads. That would leave the
   * downloads screen claiming offline access to a chapter with nothing
   * actually on disk, which is exactly what a plane-mode student would
   * discover at the worst possible time.
   *
   * Decided by state.downloads alone: a chapter listed there is removed, in
   * every medium, even when it was saved in the other one. To fetch the
   * current medium's copy of a chapter already listed, use downloadChapter.
   */
  toggleDownload: (chapterId: string) => Promise<'downloaded' | 'removed' | 'failed'>;
  /**
   * Downloads a chapter in the student's current medium, whether or not it is
   * already listed (a chapter saved before a language switch), and never
   * removes anything. The copy in the other medium stays.
   */
  downloadChapter: (chapterId: string) => Promise<'downloaded' | 'failed'>;
  /** Removes a chapter's offline copy, in every medium. No confirmation; that is the screen's. */
  removeDownload: (chapterId: string) => void;
  markCard: (cardId: string, known: boolean) => void;
  consumeAi: () => boolean;
  readNotifications: () => void;
  setSettings: (s: Partial<Settings>) => void;
  /** The single language switch: interface and syllabus move together. */
  setLanguage: (next: Language) => void;
  /**
   * Server-enforced class change; 'cooldown' when the 7-day wall says no.
   * Signed out (the first run, before any account exists) the choice is just
   * corrected on the phone and resolves 'ok'.
   */
  switchClass: (next: 9 | 10) => Promise<'ok' | 'cooldown' | 'error'>;
  /**
   * Board change with switchClass's contract: the profile first, then this
   * account's server history, then the phone (downloads, progress, queued
   * writes). 'error' when the profile write did not land, with nothing on the
   * phone touched. Signed out it is a correction, as for switchClass.
   */
  switchBoard: (next: Board) => Promise<'ok' | 'error'>;
  /**
   * Sends every queued write now. Resolves with how many are still unsent,
   * which is 0 unless the phone is offline. Bounded: never waits much longer
   * than eight seconds.
   */
  syncNow: () => Promise<number>;
  resetDemo: () => void;
};

type Ctx = {
  state: State;
  hydrated: boolean;
  /**
   * Hydrated for the account signed in right now. False from a sign-in until
   * that account's own state has been read (or this device's has been found
   * to be enough), which is what the splash has to wait for before deciding
   * between onboarding and the app: `hydrated` alone was already true from
   * the login screen, so a sign-in on a slow connection was routed on the
   * empty signed-out state and a returning student was sent into onboarding.
   */
  accountReady: boolean;
  actions: Actions;
  derived: {
    streak: number;
    level: number;
    aiLeft: number;
    aiLimit: number;
    plan: PlanTask[];
    /** The subjects this plan opens: on a free trial, only its one. */
    subjects: string[];
    /** On a free trial, the student's other subjects, shown as locked. */
    lockedSubjects: string[];
    /** What the plan lets them do: tier, AI, allowance, trial subject. See accessFor in core. */
    access: Access;
  };
  /**
   * Changes whenever what a content fetch would return can have changed: the
   * board, the class, the medium, or the chapter index being read again
   * (sign-in, a switch, a profile write landing, coming back online). Put it
   * in the dependency list of every content fetch and of every memo over
   * chapterById or chaptersFor, and a switch reaches every mounted screen.
   */
  contentKey: string;
  /**
   * True while the chapter index for the current syllabus is being read, so a
   * list that is empty right now may not be empty in a second. False offline,
   * where nothing is being read. Show a skeleton rather than "0 chapters".
   */
  contentLoading: boolean;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  /**
   * Study progress is local-first, but not local-only any more. Identity and
   * entitlement are merged in below so every screen keeps reading `state.user`
   * and `state.premium` without knowing where they came from; the same is now
   * true of progress, which starts from AsyncStorage and is corrected by the
   * server the moment a session and a connection both exist.
   */
  const { user: authUser, entitlement, entitlementReady, loading: authLoading } = useAuth();
  const online = useOnline();
  const [state, setState] = useState<State>(EMPTY);
  /** Today's AI allowance under the current plan, for consumeAi (the plan is not in `state`). */
  const aiLimitRef = useRef(0);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  /**
   * Which account `hydrated` was last reached for: the user id, or null for
   * signed out. `hydrated` itself stays true from the login screen on, so on
   * its own it cannot say whether the account that has just signed in has
   * been read yet. See accountReady.
   */
  const [readyFor, setReadyFor] = useState<string | null | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Read by actions so they can decide what to queue without `state` in their deps (see `actions` below, memoised once). */
  const stateRef = useRef<State>(EMPTY);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Unsent study-state writes for the signed-in user, mirrored to AsyncStorage on every change. */
  const queueRef = useRef<SyncOp[]>([]);
  /**
   * Bumped whenever the queue is replaced rather than added to: dropped by a
   * switch or a reset, or put aside for another account. A flush that was
   * sending the old queue checks it on the way back, and leaves alone a queue
   * that is no longer the one it was sending.
   */
  const queueGenRef = useRef(0);
  /** The flush in flight, if any, so a second caller waits on it instead of starting another. */
  const flushRef = useRef<Promise<void> | null>(null);
  /**
   * Which user id the server hydration (and queue load) has already run for
   * this cold start, or null for signed-out. Guards against re-running on
   * every token refresh, the same problem `refresh` guards against for
   * entitlement, and lets actions know who a write belongs to without a
   * second copy of `authUser` threaded through `useMemo` deps.
   */
  const syncedForRef = useRef<string | null>(null);
  /**
   * The account whose saved choices did not reach the server, so the next
   * foreground tries again. See saveChoices.
   */
  const choicesUnsavedRef = useRef<string | null>(null);

  /**
   * The last day this session has queued an "I studied" row for.
   *
   * Not derived from state.activeDays, which is what it used to be, and that
   * was wrong in a way that only showed up on an upgrade. The old build marked
   * days active locally without queueing the write, so an upgrading student
   * arrives with today already in their stored activeDays and every check of
   * "is this a new day" answers no. The row is then never written, for that
   * day or any other, and their streak reads zero forever while they study
   * daily. Four sections read on a fresh 0.4.0 install produced no active_day
   * row at all, which is how this was found.
   *
   * A ref, reset by definition on every app start, so the first study action
   * of each session queues one op. The queue collapses duplicates by day and
   * the write is an idempotent upsert, so the worst case is one redundant
   * upsert per session. Also reset by every restart: a switch wipes the
   * server's active days, today's included.
   */
  const activeDaySyncedRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as State;
          const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
          /**
           * Interface language and syllabus language are one choice now. An
           * account saved under the old split can hold two different values,
           * so the syllabus wins: it is the one attached to real content, and
           * a student reading Urdu notes wants an Urdu app.
           */
          const one = parsed.onboarding?.medium ?? settings.contentMedium ?? settings.language;
          setState({
            ...EMPTY,
            ...parsed,
            settings: { ...settings, language: one, contentMedium: one },
            onboarding: parsed.onboarding ? { ...parsed.onboarding, medium: one } : parsed.onboarding,
          });
        }
      } catch {
        // corrupt cache, start clean rather than crash
      } finally {
        setLocalLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
  }, [state, hydrated]);

  /**
   * Sends the queue, in rounds.
   *
   * A round sends a snapshot. Anything queued while it was in flight used to
   * be lost: the round wrote its leftovers back over the whole queue, so an
   * answer given while the previous one was still sending (a set answered at
   * speed) was dropped from memory and from disk without ever being sent. Now
   * a round takes out exactly the ops that left (`settled`: sent, or refused
   * for good), so whatever arrived meanwhile stays and goes next round.
   */
  const flush = useCallback((userId: string): Promise<void> => {
    if (flushRef.current) return flushRef.current;
    if (!queueRef.current.length) return Promise.resolve();
    const run = (async () => {
      for (let round = 0; round < 5; round += 1) {
        const gen = queueGenRef.current;
        const batch = queueRef.current;
        if (!batch.length) return;
        const { remaining, flushed, dropped, settled, cancelled } = await flushQueue(supabase, userId, batch);
        // The queue this was sending has been thrown away (clearSyncQueue, see
        // dropQueue), or a different student is signed in now. Writing
        // anything back would resurrect ops somebody meant to discard, or file
        // them under the wrong account.
        if (cancelled || gen !== queueGenRef.current || syncedForRef.current !== userId) return;
        const gone = new Set(settled);
        queueRef.current = queueRef.current.filter((op) => !gone.has(op.id));
        if (flushed || dropped) saveQueue(userId, queueRef.current);
        // Stopped on an op that has to wait, which means no signal: the next
        // foreground tries again. Or nothing new came in while sending: done.
        if (remaining.length || !queueRef.current.length) return;
      }
    })()
      .catch(() => {})
      .finally(() => {
        flushRef.current = null;
      });
    flushRef.current = run;
    return run;
  }, []);

  /** The flush in flight, then one more for anything it left, bounded. */
  const sendAll = useCallback(
    (userId: string): Promise<void> =>
      within(
        (async () => {
          await flush(userId);
          if (queueRef.current.length) await flush(userId);
        })(),
        NETWORK_WAIT_MS,
        undefined,
      ),
    [flush],
  );

  /**
   * Empties the queue, then waits (a bounded time) for a flush already sending
   * part of it, which clearSyncQueue stops after the write it is on. For the
   * switches and the reset: answers queued under the old syllabus must not
   * land after the server history is wiped, or they come back into the new
   * one on the next hydrate. They used to, and the chapter the plan resumes on
   * came back with them.
   */
  const dropQueue = useCallback((userId: string): Promise<void> => {
    queueGenRef.current += 1;
    queueRef.current = clearSyncQueue();
    saveQueue(userId, []);
    const inflight = flushRef.current;
    return inflight ? within(inflight, NETWORK_WAIT_MS, undefined) : Promise.resolve();
  }, []);

  /**
   * Queues a write and immediately tries to send it. Never awaited by a
   * caller: the point of the queue is that a student answering questions on a
   * train does not wait on a network that is not there. If `flush` fails, the
   * op is still in `queueRef` (and on disk), and the AppState listener below
   * retries it the next time the app comes to the foreground.
   */
  const queueAndFlush = useCallback(
    (op: SyncOp) => {
      const userId = syncedForRef.current;
      if (!userId) return; // signed out: nothing to attach this write to yet
      queueRef.current = enqueueOp(queueRef.current, op);
      saveQueue(userId, queueRef.current);
      void flush(userId);
    },
    [flush],
  );

  /**
   * Signing out sends what is queued first, while the session still exists.
   * Registered with the auth store, which runs it; see setBeforeSignOut.
   */
  useEffect(() => {
    setBeforeSignOut(async () => {
      const uid = syncedForRef.current;
      if (uid) await sendAll(uid);
    });
    return () => setBeforeSignOut(null);
  }, [sendAll]);

  /**
   * Bumped when a write to the profile has changed what row level security
   * serves (a class or board landing on profiles), so the chapter index is
   * read again under the new rules. Never read for its value.
   */
  const [profileEpoch, setProfileEpoch] = useState(0);
  const syllabusChanged = useCallback(() => {
    // Answers cached a moment ago, and the index read a moment ago, were
    // given under the old rules, and the cache keys do not say so. The epoch
    // bump then reads the index again (see reprime).
    clearContentCache();
    setProfileEpoch((e) => e + 1);
  }, []);

  /**
   * Writes the onboarding choices, and the class that goes with them, to the
   * account, and says whether they landed.
   *
   * Awaited wherever the class or board moves: row level security serves
   * chapters by profiles.grade and profiles.board, so until this lands the
   * database answers for the old syllabus, and the chapter index has to be
   * read again after it, not before. A failure other than the class cooldown
   * is remembered and retried on the next foreground, with whatever the
   * choices are by then.
   */
  const saveChoices = useCallback(async (uid: string, onboarding: Onboarding): Promise<boolean> => {
    const { error } = await within<{ error: unknown }>(
      supabase.from('profiles').update({ onboarding, grade: onboarding.classLevel }).eq('id', uid),
      NETWORK_WAIT_MS,
      { error: { message: 'timeout' } },
    );
    const cooldown = String((error as { message?: unknown } | null)?.message ?? '').includes('grade_cooldown');
    choicesUnsavedRef.current = error && !cooldown ? uid : null;
    return !error;
  }, []);

  /**
   * The phone's half of starting a syllabus over: files off disk, cached
   * content, the chapter index and the practice session forgotten, and every
   * piece of progress reset, keeping only whose phone this is, the account's
   * inbox and the device's settings. The new class or board changes the key
   * reprime watches, so the index is read again straight after.
   *
   * ownerId is kept on purpose. Every reset used to spread EMPTY and drop it,
   * and with no owner recorded the sign-out check below (previousOwner) never
   * fired, so the next student to sign in on the phone inherited the choices,
   * any progress made since, and the downloads.
   */
  const restart = useCallback((onboarding: Onboarding) => {
    deleteAllDownloads();
    clearContentCache();
    session.clear();
    activeDaySyncedRef.current = null;
    // Right away, not only on the next render: a screen reading a synchronous
    // lookup before then must already see the new syllabus.
    setContentGrade(onboarding.classLevel);
    setContentBoard(onboarding.board);
    setState((s) => ({
      ...EMPTY,
      ownerId: s.ownerId,
      user: s.user,
      settings: s.settings,
      notifications: s.notifications,
      onboarding,
    }));
  }, []);

  /**
   * The rest of a switch, once the server has said yes: queued writes from
   * the old syllabus dropped, the server's history wiped, then the phone.
   * The wipe is awaited now, and bounded. Fired and forgotten, it raced the
   * flush of answers still queued from the old syllabus, which then landed
   * after it and reappeared in the new one.
   */
  const startOver = useCallback(
    async (uid: string | null, onboarding: Onboarding) => {
      if (uid) {
        await dropQueue(uid);
        await within(wipeStudyHistory(supabase, uid), NETWORK_WAIT_MS, false);
      }
      restart(onboarding);
    },
    [dropQueue, restart],
  );

  /**
   * On sign-in (including the app's very first launch already signed in),
   * pull server study-state before this device shows any of it. Skipped
   * entirely for a signed-out student. Guarded by `syncedForRef` so a token
   * refresh, which fires the same auth events as a sign-in, does not re-pull
   * and re-merge on every one.
   */
  useEffect(() => {
    if (!localLoaded || authLoading) return;
    const uid = authUser?.id ?? null;
    let cancelled = false;
    const stale = () => cancelled || syncedForRef.current !== uid;

    // Everything that can call setState runs inside this async body, even the
    // two branches with no real async work, so nothing here sets state
    // synchronously while the effect itself is still running.
    (async () => {
      if (syncedForRef.current === uid) {
        setHydrated(true);
        setReadyFor(uid);
        return;
      }
      syncedForRef.current = uid;

      /**
       * A different student is now holding this phone, so nothing cached here
       * belongs to them.
       *
       * Signing out used to clear the sync queue and nothing else. The class,
       * the subjects, every attempt, the streak, the notifications and the
       * downloaded chapters all stayed, and because the hydrate below merges
       * rather than replaces, and prefers local onboarding over the server's,
       * the next account to sign in inherited all of it permanently. Creating
       * a brand new account landed straight on a dashboard showing somebody
       * else's history and skipped onboarding entirely, because the subjects
       * were already "chosen".
       *
       * On a phone shared between siblings, or handed round a classroom, that
       * is not just wrong data, it is one student reading another's marks.
       */
      const previousOwner = stateRef.current.ownerId;
      const switchedAccount = Boolean(previousOwner) && previousOwner !== uid;
      if (switchedAccount) {
        // Paid chapters on disk go too. They were bought by the account that
        // is leaving, and the reader does not ask who downloaded them.
        deleteAllDownloads();
        /*
         * The leaving student's unsent answers are no longer deleted. They
         * sit under their own key, load only for their own session, and go
         * the next time they sign in here; deleting them lost every answer
         * given offline before a sign-out. Only this session's copy goes.
         * So do cached chapters (the cache answers whoever asks, paid content
         * included) and any practice session left in memory. clearSyncQueue
         * also stops a send still in flight for the account that has gone;
         * anything it did not reach is still in that account's stored queue.
         */
        queueGenRef.current += 1;
        queueRef.current = clearSyncQueue();
        clearContentCache();
        session.clear();
        activeDaySyncedRef.current = null;
        setState((s) => ({ ...EMPTY, ownerId: uid, settings: devicePrefs(s.settings) }));
      } else if (uid) {
        setState((s) => (s.ownerId === uid ? s : { ...s, ownerId: uid }));
      }

      if (!uid) {
        queueGenRef.current += 1;
        queueRef.current = [];
        setHydrated(true);
        setReadyFor(null);
        return;
      }

      const stored = await loadQueue(uid);
      if (stale()) return;
      // Ahead of anything queued while it loaded, which is newer.
      queueRef.current = [...stored, ...queueRef.current];

      /**
       * A device that already carries study state renders now and merges the
       * server's answer whenever it lands. Blocking the splash on this fetch
       * made every cold start pay a full network round trip to show data that
       * was already sitting on the phone, which is most of why opening the
       * app felt slow, and on a dead network it held the splash indefinitely.
       *
       * A fresh device still waits, because rendering before the server
       * answers would seed demo data over a real account's history, and
       * without the account's choices the splash would send a returning
       * student into onboarding. See the read below for how long it waits.
       */
      const apply = async (server: HydratedStudyState | null): Promise<void> => {
        if (stale() || !server) return;
        // After a change of account the phone has no choices by definition,
        // and stateRef may not have caught up with the reset yet: reading it
        // could hand the previous student's choices to this one's profile.
        const local = switchedAccount ? null : stateRef.current.onboarding;
        const localChose = Boolean(local?.subjects?.length);
        const saved = server.onboarding;
        /*
         * What the account has actually chosen. profiles.grade and
         * profiles.board both default on a new account, so on their own they
         * cannot tell "chose Class 9, FBISE" from "has not said". A student
         * who picked Class 10 during onboarding, which runs signed out, was
         * made Class 9 by their very first sign-in: the new profile read 9, and
         * this phone took that for a switch made on the website and reset
         * itself. So the class counts only when the saved onboarding carries
         * one (gradeChoice), as boardChoice already did for the board. When it
         * does, profiles.grade is the value taken: it is what the database
         * serves.
         */
        const chosenGrade = gradeChoice(saved);
        const serverGrade: 9 | 10 | null =
          chosenGrade === null ? null : server.grade === 10 ? 10 : server.grade === 9 ? 9 : chosenGrade;
        const serverBoard = boardChoice(saved);
        const serverHasSubjects = savedSubjects(saved).length > 0;

        /**
         * The class on the SERVER wins, always. A switch made on the website
         * must reset this phone too, or one subscription quietly serves two
         * classes, which is the exact thing the client asked us to prevent.
         * Adopting it is a full local restart, the same as switching here, and
         * then the account's history for its new syllabus is merged in. That
         * last part used to be skipped until the next cold start. The board
         * the same way: a student who picks Punjab on the website is served
         * Punjab by the database from then on.
         */
        if (
          local &&
          localChose &&
          ((serverGrade !== null && serverGrade !== local.classLevel) || (serverBoard !== null && serverBoard !== local.board))
        ) {
          await dropQueue(uid);
          if (stale()) return;
          const onboarding: Onboarding = {
            ...local,
            ...(serverHasSubjects ? readSaved(saved) : {}),
            classLevel: serverGrade ?? local.classLevel,
            board: serverBoard ?? local.board,
            // The medium is this phone's language too; see devicePrefs.
            medium: local.medium,
          };
          restart(onboarding);
          const pending = queueRef.current;
          setState((s) => withServer(s, server, pending));
          return;
        }

        /*
         * A phone with no choices of its own, signing in to an account that
         * has them: a reinstall, a new phone, or the next sibling after a
         * sign-out. The account's choices are adopted whole, its medium
         * included, since that is the syllabus its progress was made in. This
         * used to fall into the class check above, compare against a default
         * of Class 9, "adopt" the class with no subjects, and send a Class 10
         * student on a new phone back through onboarding.
         */
        if (!localChose && serverHasSubjects) {
          const choices = readSaved(saved);
          const onboarding: Onboarding = {
            ...ONBOARDING_DEFAULTS,
            ...choices,
            classLevel: serverGrade ?? (server.grade === 10 ? 10 : 9),
          };
          const pending = queueRef.current;
          setState((s) => {
            const next = withServer(s, server, pending);
            return {
              ...next,
              onboarding,
              settings: { ...next.settings, language: onboarding.medium, contentMedium: onboarding.medium },
            };
          });
          return;
        }

        // Choices already made on this device win; the server's copy was for
        // the phone that had none, handled above.
        const pending = queueRef.current;
        setState((s) => withServer(s, server, pending));

        /*
         * The device has choices the account does not: made during onboarding,
         * which runs signed out, or on an account created before choices
         * synced. Sent up and awaited, because until they land the database
         * serves the account's defaults, and the chapter index is then read
         * again under the right class and board. This used to run only after
         * the class check, which had already returned for exactly the student
         * it was for.
         */
        if (local && localChose && (chosenGrade === null || serverBoard === null || !serverHasSubjects)) {
          const ok = await saveChoices(uid, local);
          if (ok && !stale()) syllabusChanged();
        }
      };

      const local = stateRef.current;
      /*
       * `switchedAccount` short-circuits this deliberately. The reset above is
       * a setState, and stateRef only catches up on the next render, so
       * reading it here can still see the previous student's attempts and
       * conclude the device has state worth showing. It would then render
       * their history immediately while the new account's hydrate is still in
       * flight. The updater inside apply() is safe by contrast, because React
       * runs queued updaters in order.
       */
      const deviceHasState =
        !switchedAccount &&
        (local.attempts.length > 0 ||
          local.readSections.length > 0 ||
          (local.onboarding?.subjects?.length ?? 0) > 0);

      if (deviceHasState) {
        setHydrated(true);
        setReadyFor(uid);
        void hydrateStudyState(supabase, uid).then(async (server) => {
          await apply(server);
          if (!stale()) void flush(uid);
        });
        return;
      }

      /*
       * No race of its own any more. It used to give up after six seconds and
       * throw away the answer that arrived at seven, and nothing ever read it
       * again: on a slow connection a returning student signing in on a new
       * phone was sent through "Which class are you in?" as if the account
       * were new, with none of their progress, and choosing again wrote the
       * half-finished choices over the account's real ones. The read has its
       * own eight second cap, and this runs moments after a sign-in that
       * reached the server, so a link that slow is likelier than a dead one:
       * one more try before falling back to an empty app.
       */
      let server = await hydrateStudyState(supabase, uid);
      if (!server && !stale()) server = await hydrateStudyState(supabase, uid);
      await apply(server);
      if (stale()) return;
      setHydrated(true);
      setReadyFor(uid);
      void flush(uid);
    })();

    return () => {
      cancelled = true;
    };
  }, [localLoaded, authLoading, authUser?.id, flush, dropQueue, restart, saveChoices, syllabusChanged]);

  /**
   * Retries whatever is still queued whenever the student picks the phone
   * back up. There is no native network-reachability listener wired into this
   * app (adding one is a native dependency and a rebuild, see BUILD-PLAN's
   * standing risks on Expo Go drift), so "the app came back to the
   * foreground" stands in for "we might have a connection again", the same
   * proxy store/auth.tsx already uses to re-check entitlement on resume.
   * Choices that failed to save are retried on the same cue.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      const uid = syncedForRef.current;
      if (status !== 'active' || !uid) return;
      void flush(uid);
      const onboarding = stateRef.current.onboarding;
      if (choicesUnsavedRef.current === uid && onboarding) {
        void saveChoices(uid, onboarding).then((ok) => {
          if (ok && syncedForRef.current === uid) syllabusChanged();
        });
      }
    });
    return () => sub.remove();
  }, [flush, saveChoices, syllabusChanged]);

  /**
   * Records today as studied, locally and on the server, exactly once per
   * session. Replaces four copies of an `isNewDay` check that all trusted
   * local state to tell them whether the server already knew.
   */
  const markDayActive = useCallback(() => {
    const day = todayKey();
    if (activeDaySyncedRef.current === day) return;
    activeDaySyncedRef.current = day;
    queueAndFlush(syncActiveDay(day));
  }, [queueAndFlush]);

  const touchToday = (s: State): State => {
    const t = todayKey();
    return s.activeDays.includes(t) ? s : { ...s, activeDays: [...s.activeDays, t] };
  };

  /**
   * The home screen, live.
   *
   * Streak, today's plan and the week chips are all read from synced rows, so
   * the two apps agreed eventually but not promptly: a question answered on
   * the website did not move this phone's streak until it happened to hydrate
   * again, which in practice meant killing the app.
   *
   * The broadcast carries no data, only which table moved (migration 0016), so
   * a public topic never exposes a student's work. This re-reads through their
   * own session. Debounced, because finishing a ten question set writes ten
   * rows and one refresh at the end is the useful one.
   */
  const liveUserId = authUser?.id ?? null;
  useEffect(() => {
    if (!liveUserId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const server = await hydrateStudyState(supabase, liveUserId);
        if (cancelled || !server) return;
        /*
         * Plan ticks and known cards follow the server here, except where this
         * phone has a change still queued: the merge is given the queue for
         * exactly that. A tick or a card can be taken back, and the plain
         * union this used to be for cards quietly restored one the student had
         * just un-marked. (Plan ticks had their own override to the same end,
         * which also threw away a tick made here and not yet sent.) The nudge
         * settings the same way: a switch turned off on the laptop turns off
         * here.
         */
        const pending = syncedForRef.current === liveUserId ? queueRef.current : [];
        setState((s) => withServer(s, server, pending));
      }, 1200);
    };

    const channel = supabase
      .channel(`study:${liveUserId}`, { config: { private: false } })
      .on('broadcast', { event: 'change' }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [liveUserId]);

  /**
   * Keep the content layer on the student's medium.
   *
   * db.ts queries by medium and nothing ever set it, so every live read came
   * back English however the student had it configured. A full Urdu
   * translation of all nine subjects sat in the database that no Urdu-medium
   * student could reach.
   */
  const contentMedium = state.settings.language;
  // While rendering, like the class and board: in an effect, the screens'
  // fetches a language switch set off ran first and came back in the old
  // language, and stayed that way until the screen was opened again.
  setContentMedium(contentMedium);

  /**
   * The same switch drives how the interface is drawn: Nastaliq type, and the
   * layout running right to left. Set during render, not in an effect, because
   * an effect runs after the first paint and the app would flash one frame of
   * left-to-right Latin every cold start.
   */
  setUrduUi(contentMedium === 'ur');

  /* Same reasoning for the palette: set during render so a dark-mode student
     never gets one white frame on a cold start. */
  setDarkUi(state.settings.dark);

  // And on the student's class and board. The server filters by both (RLS);
  // these keep the local cache, the synchronous chapter lookups and the labels
  // honest. Set while rendering, like the theme above, not in an effect: the
  // lookups are module reads, and an effect lands after the screens below
  // have already read the old syllabus, with nothing to make them read again.
  // That would leave a Punjab student looking at FBISE's chapters.
  const classLevel = state.onboarding?.classLevel ?? 9;
  const board: Board = state.onboarding?.board ?? 'fbise';
  setContentGrade(classLevel);
  setContentBoard(board);

  /**
   * The chapter index behind every synchronous lookup (chapterById,
   * chaptersFor, the plan), and which syllabus it was last read for.
   *
   * It used to be read once, at import, before the stored session was even
   * back, and never again. A fresh install primed nothing (chapters are
   * readable only when signed in), and nothing re-read it after sign-in,
   * sign-up or a class, board or language change, so Class 10 and Punjab
   * students had empty lookups and an empty plan, and FBISE Class 9 students
   * the bundle's zero counts, until something else happened to read them.
   *
   * Reads run one at a time, and a request made while one is in flight runs
   * once more after it, so `primed.key` says exactly which syllabus the last
   * finished read was for: that is what contentLoading compares. (Core drops
   * a read that started before a switch, so an old one cannot land over a new
   * one either way.)
   */
  const [primed, setPrimed] = useState<{ key: string; version: number }>({ key: '', version: 0 });
  const primeRef = useRef<{ running: boolean; wanted: string }>({ running: false, wanted: '' });
  const reprime = useCallback((key: string) => {
    const p = primeRef.current;
    p.wanted = key;
    if (p.running) return;
    p.running = true;
    void (async () => {
      let ran = '';
      try {
        while (ran !== p.wanted) {
          ran = p.wanted;
          await within(primeAllContent(), PRIME_WAIT_MS, undefined);
        }
      } finally {
        p.running = false;
        setPrimed((s) => ({ key: ran, version: s.version + 1 }));
      }
    })();
  }, []);

  /*
   * What the plan opens decides what row level security serves: a plan that
   * arrives while the app is open (a payment made on the website, a free
   * trial started here) or ends, or a trial's one subject. The index read
   * before it was counted under the old rules, every chapter empty for an
   * account with no plan, so a new trial opened on an empty plan and "no
   * material" everywhere. So a change of plan clears what was cached and
   * reads the index again. Not the first settle after sign-in: the read that
   * followed it already ran under the server's rules, which do not wait for
   * this phone to learn the plan.
   */
  const planKey = entitlement.active ? `${entitlement.plan ?? ''}:${entitlement.trialSubject ?? ''}` : 'none';
  const planSeen = useRef<{ user: string | null; key: string | null }>({ user: null, key: null });
  const [planEpoch, setPlanEpoch] = useState(0);
  useEffect(() => {
    if (!entitlementReady || !liveUserId) return;
    const seen = planSeen.current;
    if (seen.user !== liveUserId || seen.key === null) {
      planSeen.current = { user: liveUserId, key: planKey };
      return;
    }
    if (seen.key === planKey) return;
    planSeen.current = { user: liveUserId, key: planKey };
    clearContentCache();
    setPlanEpoch((e) => e + 1);
  }, [entitlementReady, liveUserId, planKey]);

  // Who is asking matters as much as what: row level security answers per
  // account, and a signed-out read returns nothing at all.
  const syllabusKey = `${liveUserId ?? '-'}:${board}:${classLevel}:${contentMedium}:${profileEpoch}:${planEpoch}`;
  useEffect(() => {
    // Offline there is nothing to read it from; coming back online reads it
    // again, which is also what refreshes screens that loaded without signal.
    if (!localLoaded || authLoading || !online) return;
    reprime(syllabusKey);
  }, [localLoaded, authLoading, online, syllabusKey, reprime]);

  /*
   * Core's own count of changes to the index: it moves when any read changes
   * it (a screen's chapter fetch included, not only the reads above), and on
   * a syllabus or medium change. Read after the setters above, which can move
   * it during this very render; core tells subscribers in a microtask, so the
   * render that follows is the one that sees it.
   */
  const indexVersion = useSyncExternalStore(subscribeContent, contentVersion, contentVersion);
  const contentKey = `${board}:${classLevel}:${contentMedium}:${indexVersion}.${primed.version}`;
  const contentLoading = online && primed.key !== syllabusKey;

  const actions = useMemo<Actions>(
    () => ({
      markChapterCelebrated: (chapterId) =>
        setState((s) =>
          s.celebratedChapters.includes(chapterId)
            ? s
            : { ...s, celebratedChapters: [...s.celebratedChapters, chapterId] },
        ),
      markStreakCelebrated: () => setState((s) => ({ ...s, lastStreakCelebrated: todayKey() })),
      setOnboarding: (o) => {
        const before = stateRef.current.onboarding;
        const onboarding: Onboarding = { ...ONBOARDING_DEFAULTS, ...(before ?? {}), ...o };
        /*
         * A different board or class makes every downloaded chapter the old
         * syllabus's, and the chapter the plan resumes on with them. The very
         * first choice has nothing to clear. The files used to go and the list
         * of them stay, so the downloads screen showed "0 KB" rows for
         * chapters no longer on the phone.
         */
        const moved = Boolean(before) && (onboarding.board !== before?.board || onboarding.classLevel !== before?.classLevel);
        if (moved) deleteAllDownloads();
        setState((s) => ({
          ...s,
          onboarding,
          ...(moved ? { downloads: [], lastChapterId: undefined, lastSectionIndex: 0 } : {}),
        }));
        // Choices follow the account so a reinstall skips this flow. Signed
        // out (the very first run) there is no account row yet; the hydration
        // above sends them up after sign-in instead. When the class or board
        // moved, the chapter index is read again once the database serves it.
        const uid = syncedForRef.current;
        if (uid) {
          void saveChoices(uid, onboarding).then((ok) => {
            if (ok && moved && syncedForRef.current === uid) syllabusChanged();
          });
        }
      },
      recordAttempt: (a) => {
        /*
         * One id for the answer here and its row in Postgres. It had a local
         * `a-<time>` id while the row went up under another, so the next
         * hydrate saw two answers where there was one: attempts doubled, XP
         * doubled, and a weak topic appeared after two real mistakes.
         */
        const full: Attempt = { ...a, id: newRowId(), at: Date.now() };
        setState((s) =>
          touchToday({
            ...s,
            attempts: [...s.attempts, full],
            // One rule for what an answer is worth, in core, so the increment
            // here and the recompute after a sync cannot disagree. They did:
            // the exam bonus was credited here and dropped there.
            xp: s.xp + xpForAttempt(full),
          })
        );
        // Queued, not awaited: the answer is already on screen and in state.
        // Whether it reaches Postgres now, in ten minutes on reconnect, or
        // never (see applySyncOp's drop path) cannot be allowed to hold up
        // the next question.
        queueAndFlush(syncAttempt(full));
        markDayActive();
        return full;
      },
      addResult: (r) => {
        // The same single id as an attempt, for the same reason.
        const full: TestResult = { ...r, id: newRowId(), at: Date.now() };
        setState((s) => touchToday({ ...s, results: [full, ...s.results] }));
        queueAndFlush(syncResult(full));
        markDayActive();
        return full;
      },
      markSectionRead: (sectionId, chapterId, index) => {
        const isNewSection = !stateRef.current.readSections.includes(sectionId);
        setState((s) =>
          touchToday({
            ...s,
            readSections: s.readSections.includes(sectionId) ? s.readSections : [...s.readSections, sectionId],
            lastChapterId: chapterId,
            lastSectionIndex: index,
          })
        );
        // Only the first time a section is read is synced (read_sections'
        // own comment in 0001_init.sql: re-reading is not a new fact), which
        // also means "resume reading" restores to the newest section a
        // student reached, not wherever they last happened to be re-reading.
        if (isNewSection) queueAndFlush(syncReadSection(sectionId, chapterId, index));
        markDayActive();
      },
      markStudied: () => {
        const day = todayKey();
        // No early return on local state: see markDayActive. Bailing out
        // because the device already believes today is active is exactly what
        // stopped the row ever being written for an upgrading student.
        setState((st) => (st.activeDays.includes(day) ? st : { ...st, activeDays: [...st.activeDays, day] }));
        markDayActive();
      },
      togglePlanTask: (id) => {
        const nowDone = !stateRef.current.planDone.includes(id);
        setState((s) => ({
          ...s,
          // Task ids carry the day, so anything from an earlier day is dead
          // weight. Dropping it here keeps the list to today's three.
          planDone: (s.planDone.includes(id)
            ? s.planDone.filter((x) => x !== id)
            : [...s.planDone, id]
          ).filter((x) => x.endsWith(todayKey())),
        }));
        // And on the server, so the same tick shows on their other device.
        queueAndFlush(syncPlanTask(id, todayKey(), nowDone));
      },
      toggleDownload: async (chapterId) => {
        const isDownloaded = stateRef.current.downloads.includes(chapterId);
        if (isDownloaded) {
          deleteChapterDownload(chapterId);
          setState((s) => ({ ...s, downloads: s.downloads.filter((x) => x !== chapterId) }));
          return 'removed';
        }
        try {
          await saveOffline(chapterId, stateRef.current.settings.contentMedium);
        } catch {
          return 'failed';
        }
        setState((s) => (s.downloads.includes(chapterId) ? s : { ...s, downloads: [...s.downloads, chapterId] }));
        return 'downloaded';
      },
      downloadChapter: async (chapterId) => {
        try {
          await saveOffline(chapterId, stateRef.current.settings.contentMedium);
        } catch {
          return 'failed';
        }
        setState((s) => (s.downloads.includes(chapterId) ? s : { ...s, downloads: [...s.downloads, chapterId] }));
        return 'downloaded';
      },
      removeDownload: (chapterId) => {
        deleteChapterDownload(chapterId);
        setState((s) => ({ ...s, downloads: s.downloads.filter((x) => x !== chapterId) }));
      },
      markCard: (cardId, known) => {
        const wasKnown = stateRef.current.cardsKnown.includes(cardId);
        setState((s) =>
          touchToday({
            ...s,
            cardsKnown: known
              ? s.cardsKnown.includes(cardId)
                ? s.cardsKnown
                : [...s.cardsKnown, cardId]
              : s.cardsKnown.filter((x) => x !== cardId),
            xp: known && !s.cardsKnown.includes(cardId) ? s.xp + XP.card : s.xp,
          })
        );
        if (known && !wasKnown) queueAndFlush(syncCardKnown(cardId));
        else if (!known && wasKnown) queueAndFlush(syncCardUnknown(cardId));
        /**
         * An hour of flashcards is an hour of studying.
         *
         * This was the one study action that recorded no active day, so a
         * student who revises by card ended the day with an unmoved streak and
         * could be sent a "your streak is at risk" nudge on a day they had
         * worked. Either direction counts: saying "repeat" is reviewing the
         * card, not skipping it.
         */
        markDayActive();
      },
      consumeAi: () => {
        let allowed = false;
        const day = todayKey();
        // Read before the update, like every other action that can start a day.

        setState((s) => {
          const used = s.ai.day === day ? s.ai.used : 0;
          // The plan lives in the auth store, overlaid on the view, never in
          // this state: read through the ref the render below keeps current.
          const limit = aiLimitRef.current;
          if (used >= limit) {
            allowed = false;
            return { ...s, ai: { day, used } };
          }
          allowed = true;
          return touchToday({ ...s, ai: { day, used: used + 1 } });
        });
        // Asking the tutor is studying, so it counts, but it has to be written
        // through like the rest. Marking the day locally and never syncing it
        // is what left the streak disagreeing between the phone and laptop.
        if (allowed) markDayActive();
        return allowed;
      },
      readNotifications: () => {
        // The server too. Flipping only local state meant the badge cleared
        // until the next hydration read the same rows back, still unread.
        const uid = syncedForRef.current;
        if (uid) void markNotificationsRead(supabase, uid);
        setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
      },
      setSettings: (patch) => {
        setState((s) => {
          const settings = { ...s.settings, ...patch };
          // The three nudge preferences are account-level, so they go up. The
          // rest describe this device and stay on it.
          const uid = syncedForRef.current;
          if (uid && ('reminders' in patch || 'streakAlerts' in patch || 'reminderTime' in patch || 'dark' in patch ||
        'channelPush' in patch || 'channelEmail' in patch)) {
            void syncAccountPrefs(supabase, uid, {
              reminders: settings.reminders,
              streakAlerts: settings.streakAlerts,
              reminderTime: settings.reminderTime,
              dark: settings.dark,
              channelPush: settings.channelPush,
              channelEmail: settings.channelEmail,
            });
          }
          return { ...s, settings };
        });
      },
      /**
       * One language for the whole app.
       *
       * The interface language and the syllabus language used to be two
       * separate switches, which let a student sit in an English interface
       * reading Urdu notes, or the reverse. The client asked for one choice,
       * and it is also the honest one: a student who studies in Urdu wants
       * the app in Urdu. This writes all three places that carried the old
       * split, so nothing can drift: the interface setting, the content
       * medium the query layer filters on, and the medium stored on the
       * profile that the website's server reads.
       *
       * Downloads are left as they are. See "what a language switch does to a
       * download" in core/downloads.ts for what that means for each subject.
       */
      setLanguage: (next) => {
        setState((s) => ({
          ...s,
          settings: { ...s.settings, language: next, contentMedium: next },
          onboarding: s.onboarding ? { ...s.onboarding, medium: next } : s.onboarding,
        }));
        const uid = syncedForRef.current;
        const onboarding = stateRef.current.onboarding;
        if (uid && onboarding) {
          void supabase.from('profiles').update({ onboarding: { ...onboarding, medium: next } }).eq('id', uid);
        }
      },
      /**
       * Change class, the four-step contract: server first (the trigger there
       * enforces the 7 day cooldown and RLS follows profiles.grade), then
       * queued writes and server history, then disk and local state.
       * Server-first on purpose: if the cooldown rejects it, nothing local has
       * been touched yet.
       *
       * Signed out there is no account to ask and no history to lose: that is
       * the first run, where a student who went back and picked the other
       * class used to meet an error they could not get past.
       */
      switchClass: async (next) => {
        const uid = authUser?.id ?? null;
        const current = stateRef.current.onboarding;
        // Already there: nothing to change, and certainly nothing to wipe.
        if (current && current.classLevel === next) return 'ok';
        const onboarding: Onboarding = { ...ONBOARDING_DEFAULTS, ...(current ?? {}), classLevel: next };
        if (uid) {
          const { error } = await within<{ error: unknown }>(
            supabase.from('profiles').update({ grade: next, onboarding }).eq('id', uid),
            NETWORK_WAIT_MS,
            { error: { message: 'timeout' } },
          );
          if (error) {
            return String((error as { message?: unknown }).message ?? '').includes('grade_cooldown') ? 'cooldown' : 'error';
          }
        }
        await startOver(uid, onboarding);
        return 'ok';
      },
      /**
       * Change board, the same contract as switchClass.
       *
       * It used to be a plain setOnboarding: instant, no warning, the files
       * deleted but the list of them kept, and every attempt, result and read
       * section from the old board kept here and on the server. The plan and
       * Continue then opened chapters the database no longer serves, and other
       * devices merged the old board's attempts back in on their next sync.
       * There is no cooldown on a board (the database has none), so the only
       * failure is the write not landing, and then nothing here is touched.
       */
      switchBoard: async (next) => {
        const uid = authUser?.id ?? null;
        const current = stateRef.current.onboarding;
        if (current && current.board === next) return 'ok';
        const onboarding: Onboarding = { ...ONBOARDING_DEFAULTS, ...(current ?? {}), board: next };
        if (uid) {
          // profiles.board follows the onboarding record (migration 0036).
          const { error } = await within<{ error: unknown }>(
            supabase.from('profiles').update({ onboarding }).eq('id', uid),
            NETWORK_WAIT_MS,
            { error: { message: 'timeout' } },
          );
          if (error) return 'error';
        }
        await startOver(uid, onboarding);
        return 'ok';
      },
      syncNow: async () => {
        const uid = syncedForRef.current;
        if (uid) await sendAll(uid);
        return queueRef.current.length;
      },
      resetDemo: () => {
        // Files on disk, not just the state pointing at them: otherwise every
        // download from before the reset keeps its space on the phone with no
        // entry left in state.downloads to delete it from again.
        deleteAllDownloads();
        session.clear();
        activeDaySyncedRef.current = null;
        // And the server, not just this device. Progress syncs now, so a local
        // clear is undone by the next hydration: the student presses reset,
        // sees zero, reopens the app and their history is back. Not awaited,
        // because the screen should respond at once, and a failed delete leaves
        // rows that the next reset will catch rather than anything broken.
        // The queue goes first, or answers still waiting to send land after
        // the wipe and bring part of the history straight back.
        const uid = authUser?.id;
        if (uid) void dropQueue(uid).then(() => wipeStudyHistory(supabase, uid));
        /* Notifications survive. They belong to the account, nothing here can
           delete them, and blanking them locally only made the inbox look
           cleared until the next hydration read every one of them back. */
        setState((s) => ({
          ...EMPTY,
          ownerId: s.ownerId,
          user: s.user,
          onboarding: s.onboarding,
          settings: s.settings,
          notifications: s.notifications,
        }));
      },
    }),
    [queueAndFlush, markDayActive, authUser?.id, saveChoices, syllabusChanged, startOver, dropQueue, sendAll],
  );

  /**
   * What every screen actually sees.
   *
   * Identity and entitlement are overlaid from the auth store, so `state.user`
   * and `state.premium` stay exactly where they have always been while their
   * source of truth moved to the server. No screen had to change, and none of
   * them can write to either any more.
   */
  /**
   * Memoised on the scalar fields, not the objects. authUser and entitlement
   * arrive as fresh objects even when nothing changed (every foreground
   * entitlement refresh built a new one), and rebuilding `user`/`premium`
   * churned every effect keyed on them, including the splash redirect timer.
   */
  const user = useMemo(
    () => (authUser ? { id: authUser.id, name: authUser.name, contact: authUser.email } : null),
    [authUser?.id, authUser?.name, authUser?.email], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const premium = useMemo(
    () => ({ active: entitlement.active, validTill: entitlement.validTill, plan: entitlement.plan, trialSubject: entitlement.trialSubject }),
    [entitlement.active, entitlement.validTill, entitlement.plan, entitlement.trialSubject],
  );
  const view = useMemo<State>(
    () => ({
      ...state,
      user,
      premium,
    }),
    [state, user, premium]
  );

  const accountReady = hydrated && readyFor === (authUser?.id ?? null);

  const derived = useMemo(() => {
    const access = accessFor({
      active: view.premium.active,
      plan: view.premium.plan ?? null,
      validTill: view.premium.validTill,
      trialSubject: view.premium.trialSubject ?? null,
    });
    const aiLimit = access.aiLimit;
    const usedToday = view.ai.day === todayKey() ? view.ai.used : 0;
    const chosen = view.onboarding?.subjects?.length ? view.onboarding.subjects : DEFAULT_SUBJECTS;
    /*
     * On a free trial the one subject it opens is the student's whole syllabus
     * for three days: today's plan, the practice pickers and the tutor all
     * build from this list, and none of them should point at a subject the
     * database will refuse. The rest are kept to show as locked. Same rule as
     * the website's store.
     */
    const subjects = access.tier === 'trial' && access.trialSubject ? [access.trialSubject] : chosen;
    const lockedSubjects = access.tier === 'trial' ? chosen.filter((id) => id !== access.trialSubject) : [];
    return {
      streak: streakFrom(view.activeDays),
      level: level(view.xp),
      aiLeft: Math.max(0, aiLimit - usedToday),
      aiLimit,
      access,
      lockedSubjects,
      subjects,
      // Can be empty while the index loads (contentLoading): the plan no
      // longer falls back to a chapter whose counts it cannot see.
      plan: buildPlan({
        subjectIds: subjects,
        // The student's own class and board, so the plan can never point at
        // another syllabus. See planChapterId.
        grade: view.onboarding?.classLevel ?? 9,
        board: view.onboarding?.board ?? 'fbise',
        lastChapterId: view.lastChapterId,
        attempts: view.attempts,
        doneIds: view.planDone,
        // Real work counts as completion, and all three of these sync, so the
        // plan reads the same on every device without storing anything extra.
        readSections: view.readSections,
        cardsKnown: view.cardsKnown,
      }),
    };
    // The index versions are not read here, and have to be listed: buildPlan
    // reads the chapter index through synchronous lookups that change
    // underneath without React knowing, so the plan is rebuilt each time it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, indexVersion, primed.version]);

  useEffect(() => {
    aiLimitRef.current = derived.aiLimit;
  }, [derived.aiLimit]);

  return (
    <AppCtx.Provider value={{ state: view, hydrated, accountReady, actions, derived, contentKey, contentLoading }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
