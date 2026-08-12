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
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_QUOTA, XP, buildPlan, level, setContentMedium, streakFrom, todayKey, totalXp, wipeStudyHistory,
  Attempt,
  ChatThread,
  Group,
  Medium,
  Notification,
  PlanTask,
  SyncOp,
  TestResult,
  enqueueOp,
  flushQueue,
  hydrateStudyState,
  mergeHydratedState,
  syncActiveDay,
  syncAttempt,
  syncCardKnown,
  syncCardUnknown,
  syncReadSection,
  syncResult,
} from '@matricmate/core';
import { useAuth } from './auth';
import { supabase } from '../lib/supabase';
import { deleteAllDownloads, deleteChapterDownload, downloadChapter } from '../core/downloads';

// v2: the fake "demo seed" that used to write sample attempts, results and a
// streak on first sign-in is gone. Bumping the key throws away anything a
// device already had stored under v1, so nobody's dashboard still shows the
// fabricated history. Do not revert this to v1.
const KEY = 'mm.state.v2';

/**
 * Where a signed-in student's unsent writes wait. Keyed per user, not one
 * shared key, so a still-queued answer from whoever last used this phone can
 * never be attributed to the next person who signs in on it (a shared family
 * or classroom phone is not a hypothetical here).
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

/** The avatar choices, indexed by Settings.avatar. */
export const AVATARS = ['🧑🏽‍🎓', '👩🏽‍🎓', '🧕🏽', '👨🏽‍💻', '🦸🏽'];

export type Settings = {
  /** Language of the interface. Separate from `contentMedium`, which is the syllabus language. */
  language: 'en' | 'ur';
  /** Index into AVATARS, chosen on the edit-profile screen. */
  avatar: number;
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
  premium: { active: boolean; validTill: number | null; ref?: string };
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  planDone: string[];
  downloads: string[];
  ai: { day: string; used: number };
  threads: ChatThread[];
  notifications: Notification[];
  settings: Settings;
  lastChapterId?: string;
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
  contentMedium: 'en',
  fontScale: 1,
};

const EMPTY: State = {
  user: null,
  onboarding: null,
  premium: { active: false, validTill: null },
  readSections: [],
  attempts: [],
  results: [],
  planDone: [],
  downloads: [],
  ai: { day: todayKey(), used: 0 },
  threads: [],
  notifications: [],
  settings: DEFAULT_SETTINGS,
  lastSectionIndex: 0,
  activeDays: [],
  xp: 0,
  cardsKnown: [],
};

/* ------------------------------------------------------------------ context */

/**
 * Note what is missing: there is no signIn, signOut, subscribe or cancel here
 * any more. Identity and entitlement are owned by store/auth.tsx and come from
 * the server. A local `subscribe()` would have meant the phone could grant
 * itself premium, which is both a bug and the thing Play policy exists to stop.
 */
type Actions = {
  setOnboarding: (o: Partial<Onboarding>) => void;
  recordAttempt: (a: Omit<Attempt, 'id' | 'at'>) => Attempt;
  addResult: (r: Omit<TestResult, 'id' | 'at'>) => TestResult;
  markSectionRead: (sectionId: string, chapterId: string, index: number) => void;
  togglePlanTask: (id: string) => void;
  /**
   * Downloads a chapter for offline use, or removes it. Async, and reports
   * which of the three actually happened: a download is a real network fetch
   * plus a disk write, not a state flip, so a failed fetch or a failed write
   * must not add the chapter to state.downloads. That would leave the
   * downloads screen claiming offline access to a chapter with nothing
   * actually on disk, which is exactly what a plane-mode student would
   * discover at the worst possible time.
   */
  toggleDownload: (chapterId: string) => Promise<'downloaded' | 'removed' | 'failed'>;
  markCard: (cardId: string, known: boolean) => void;
  consumeAi: () => boolean;
  saveThread: (t: ChatThread) => void;
  readNotifications: () => void;
  setSettings: (s: Partial<Settings>) => void;
  resetDemo: () => void;
};

type Ctx = {
  state: State;
  hydrated: boolean;
  actions: Actions;
  derived: {
    streak: number;
    level: number;
    aiLeft: number;
    aiLimit: number;
    plan: PlanTask[];
    subjects: string[];
  };
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
  const { user: authUser, entitlement, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>(EMPTY);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Read by actions so they can decide what to queue without `state` in their deps (see `actions` below, memoised once). */
  const stateRef = useRef<State>(EMPTY);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Unsent study-state writes for the signed-in user, mirrored to AsyncStorage on every change. */
  const queueRef = useRef<SyncOp[]>([]);
  const flushingRef = useRef(false);
  /**
   * Which user id the server hydration (and queue load) has already run for
   * this cold start, or null for signed-out. Guards against re-running on
   * every token refresh, the same problem `refresh` guards against for
   * entitlement, and lets actions know who a write belongs to without a
   * second copy of `authUser` threaded through `useMemo` deps.
   */
  const syncedForRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as State;
          setState({ ...EMPTY, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } });
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

  const flush = useCallback(async (userId: string) => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const { remaining, flushed, dropped } = await flushQueue(supabase, userId, queueRef.current);
      queueRef.current = remaining;
      if (flushed || dropped) saveQueue(userId, remaining);
    } finally {
      flushingRef.current = false;
    }
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

    // Everything that can call setState runs inside this async body, even the
    // two branches with no real async work, so nothing here sets state
    // synchronously while the effect itself is still running.
    (async () => {
      if (syncedForRef.current === uid) {
        setHydrated(true);
        return;
      }
      syncedForRef.current = uid;

      if (!uid) {
        queueRef.current = [];
        setHydrated(true);
        return;
      }

      queueRef.current = await loadQueue(uid);

      /**
       * A device that already carries study state renders now and merges the
       * server's answer whenever it lands. Blocking the splash on this fetch
       * made every cold start pay a full network round trip to show data that
       * was already sitting on the phone, which is most of why opening the
       * app felt slow, and on a dead network it held the splash indefinitely.
       *
       * A fresh device still waits, because rendering before the server
       * answers would seed demo data over a real account's history. It waits
       * six seconds at most: a student installing on a dead network gets an
       * empty but working app now and their history on the next good signal.
       */
      const apply = (server: Awaited<ReturnType<typeof hydrateStudyState>>) => {
        if (cancelled || syncedForRef.current !== uid) return;
        if (server) {
          setState((s) => {
            const merged = mergeHydratedState(s, server);
            // Choices already made on this device win; the server's copy is
            // for the phone that has none, which is what a reinstall is.
            const onboarding = s.onboarding?.subjects?.length
              ? s.onboarding
              : ((server.onboarding as Onboarding | null) ?? s.onboarding);
            return { ...merged, onboarding, xp: totalXp(merged.attempts, merged.cardsKnown) };
          });
        }
        // The account had no saved choices but this device does: an account
        // created before choices synced. Send them up so the next reinstall
        // lands in the app, not back in the class picker.
        const onb = stateRef.current.onboarding;
        if (onb?.subjects?.length && !server?.onboarding) {
          void supabase.from('profiles').update({ onboarding: onb }).eq('id', uid);
        }
      };

      const local = stateRef.current;
      const deviceHasState =
        local.attempts.length > 0 ||
        local.readSections.length > 0 ||
        (local.onboarding?.subjects?.length ?? 0) > 0;

      if (deviceHasState) {
        setHydrated(true);
        void hydrateStudyState(supabase, uid).then((server) => {
          apply(server);
          void flush(uid);
        });
        return;
      }

      const server = await Promise.race([
        hydrateStudyState(supabase, uid),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      apply(server);
      if (cancelled || syncedForRef.current !== uid) return;
      setHydrated(true);
      void flush(uid);
    })();

    return () => {
      cancelled = true;
    };
  }, [localLoaded, authLoading, authUser?.id, flush]);

  /**
   * Retries whatever is still queued whenever the student picks the phone
   * back up. There is no native network-reachability listener wired into this
   * app (adding one is a native dependency and a rebuild, see BUILD-PLAN's
   * standing risks on Expo Go drift), so "the app came back to the
   * foreground" stands in for "we might have a connection again", the same
   * proxy store/auth.tsx already uses to re-check entitlement on resume.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      const uid = syncedForRef.current;
      if (status === 'active' && uid) void flush(uid);
    });
    return () => sub.remove();
  }, [flush]);

  const touchToday = (s: State): State => {
    const t = todayKey();
    return s.activeDays.includes(t) ? s : { ...s, activeDays: [...s.activeDays, t] };
  };

  /**
   * Keep the content layer on the student's medium.
   *
   * db.ts queries by medium and nothing ever set it, so every live read came
   * back English however the student had it configured. A full Urdu
   * translation of all nine subjects sat in the database that no Urdu-medium
   * student could reach.
   */
  const contentMedium = state.settings.contentMedium;
  useEffect(() => {
    setContentMedium(contentMedium);
  }, [contentMedium]);

  const actions = useMemo<Actions>(
    () => ({
      setOnboarding: (o) => {
        const onboarding: Onboarding = {
          classLevel: 9,
          board: 'fbise',
          medium: 'en',
          group: 'science',
          subjects: [],
          ...(stateRef.current.onboarding ?? {}),
          ...o,
        };
        setState((s) => ({ ...s, onboarding }));
        // Fire and forget: choices follow the account so a reinstall skips
        // this flow. Signed out (the very first run) there is no account row
        // yet; the hydration reconciliation above pushes them up after
        // sign-in instead.
        const uid = syncedForRef.current;
        if (uid) void supabase.from('profiles').update({ onboarding }).eq('id', uid);
      },
      recordAttempt: (a) => {
        const full: Attempt = { ...a, id: `a-${Date.now()}-${Math.round(Math.random() * 1e4)}`, at: Date.now() };
        const isNewDay = !stateRef.current.activeDays.includes(todayKey());
        setState((s) =>
          touchToday({
            ...s,
            attempts: [...s.attempts, full],
            // Exam answers really earn the doubled XP the result screen
            // advertises. It used to be shown there and credited nowhere.
            xp: s.xp + XP.forAnswer(a.correct, a.confidence) * (a.mode === 'exam' ? XP.examMultiplier : 1),
          })
        );
        // Queued, not awaited: the answer is already on screen and in state.
        // Whether it reaches Postgres now, in ten minutes on reconnect, or
        // never (see applySyncOp's drop path) cannot be allowed to hold up
        // the next question.
        queueAndFlush(syncAttempt(full));
        if (isNewDay) queueAndFlush(syncActiveDay(todayKey()));
        return full;
      },
      addResult: (r) => {
        const full: TestResult = { ...r, id: `r-${Date.now()}`, at: Date.now() };
        const isNewDay = !stateRef.current.activeDays.includes(todayKey());
        setState((s) => touchToday({ ...s, results: [full, ...s.results] }));
        queueAndFlush(syncResult(full));
        if (isNewDay) queueAndFlush(syncActiveDay(todayKey()));
        return full;
      },
      markSectionRead: (sectionId, chapterId, index) => {
        const isNewSection = !stateRef.current.readSections.includes(sectionId);
        const isNewDay = !stateRef.current.activeDays.includes(todayKey());
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
        if (isNewDay) queueAndFlush(syncActiveDay(todayKey()));
      },
      togglePlanTask: (id) =>
        setState((s) => ({
          ...s,
          planDone: s.planDone.includes(id) ? s.planDone.filter((x) => x !== id) : [...s.planDone, id],
        })),
      toggleDownload: async (chapterId) => {
        const isDownloaded = stateRef.current.downloads.includes(chapterId);
        if (isDownloaded) {
          deleteChapterDownload(chapterId);
          setState((s) => ({ ...s, downloads: s.downloads.filter((x) => x !== chapterId) }));
          return 'removed';
        }
        try {
          await downloadChapter(chapterId, stateRef.current.settings.contentMedium);
        } catch {
          return 'failed';
        }
        setState((s) => (s.downloads.includes(chapterId) ? s : { ...s, downloads: [...s.downloads, chapterId] }));
        return 'downloaded';
      },
      markCard: (cardId, known) => {
        const wasKnown = stateRef.current.cardsKnown.includes(cardId);
        setState((s) => ({
          ...s,
          cardsKnown: known
            ? s.cardsKnown.includes(cardId)
              ? s.cardsKnown
              : [...s.cardsKnown, cardId]
            : s.cardsKnown.filter((x) => x !== cardId),
          xp: known && !s.cardsKnown.includes(cardId) ? s.xp + XP.card : s.xp,
        }));
        if (known && !wasKnown) queueAndFlush(syncCardKnown(cardId));
        else if (!known && wasKnown) queueAndFlush(syncCardUnknown(cardId));
      },
      consumeAi: () => {
        let allowed = false;
        setState((s) => {
          const day = todayKey();
          const used = s.ai.day === day ? s.ai.used : 0;
          const limit = s.premium.active ? AI_QUOTA.premium : AI_QUOTA.free;
          if (used >= limit) {
            allowed = false;
            return { ...s, ai: { day, used } };
          }
          allowed = true;
          return touchToday({ ...s, ai: { day, used: used + 1 } });
        });
        return allowed;
      },
      saveThread: (t) =>
        setState((s) => ({
          ...s,
          threads: [t, ...s.threads.filter((x) => x.id !== t.id)].slice(0, 20),
        })),
      readNotifications: () =>
        setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      setSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      resetDemo: () => {
        // Files on disk, not just the state pointing at them: otherwise every
        // download from before the reset keeps its space on the phone with no
        // entry left in state.downloads to delete it from again.
        deleteAllDownloads();
        // And the server, not just this device. Progress syncs now, so a local
        // clear is undone by the next hydration: the student presses reset,
        // sees zero, reopens the app and their history is back. Not awaited,
        // because the screen should respond at once, and a failed delete leaves
        // rows that the next reset will catch rather than anything broken.
        const uid = authUser?.id;
        if (uid) void wipeStudyHistory(supabase, uid);
        setState((s) => ({ ...EMPTY, user: s.user, onboarding: s.onboarding, settings: s.settings }));
      },
    }),
    [queueAndFlush, authUser?.id],
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
    () => ({ active: entitlement.active, validTill: entitlement.validTill }),
    [entitlement.active, entitlement.validTill],
  );
  const view = useMemo<State>(
    () => ({
      ...state,
      user,
      premium,
    }),
    [state, user, premium]
  );

  const derived = useMemo(() => {
    const aiLimit = view.premium.active ? AI_QUOTA.premium : AI_QUOTA.free;
    const usedToday = view.ai.day === todayKey() ? view.ai.used : 0;
    const subjects = view.onboarding?.subjects?.length ? view.onboarding.subjects : DEFAULT_SUBJECTS;
    return {
      streak: streakFrom(view.activeDays),
      level: level(view.xp),
      aiLeft: Math.max(0, aiLimit - usedToday),
      aiLimit,
      subjects,
      plan: buildPlan({
        subjectIds: subjects,
        lastChapterId: view.lastChapterId,
        attempts: view.attempts,
        doneIds: view.planDone,
      }),
    };
  }, [view]);

  return <AppCtx.Provider value={{ state: view, hydrated, actions, derived }}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
