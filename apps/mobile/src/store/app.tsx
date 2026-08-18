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
import { AI_QUOTA, Attempt, Group, Language, Medium, Notification, PlanTask, SyncOp, TestResult, XP, buildPlan, enqueueOp, flushQueue, hydrateStudyState, level, markNotificationsRead, mergeHydratedState, setContentGrade, setContentMedium, streakFrom, syncActiveDay, syncAttempt, syncCardKnown, syncCardUnknown, syncAccountPrefs, syncPlanTask, syncReadSection, syncResult, todayKey, totalXp, wipeStudyHistory } from '@matricmate/core';
import { useAuth } from './auth';
import { supabase } from '../lib/supabase';
import { deleteAllDownloads, deleteChapterDownload, downloadChapter } from '../core/downloads';
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
   * sign-ins.
   */
  ownerId: string | null;
  user: { id: string; name: string; contact: string } | null;
  onboarding: Onboarding | null;
  premium: { active: boolean; validTill: number | null; ref?: string };
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
   */
  toggleDownload: (chapterId: string) => Promise<'downloaded' | 'removed' | 'failed'>;
  markCard: (cardId: string, known: boolean) => void;
  consumeAi: () => boolean;
  readNotifications: () => void;
  setSettings: (s: Partial<Settings>) => void;
  /** The single language switch: interface and syllabus move together. */
  setLanguage: (next: Language) => void;
  /** Server-enforced class change; 'cooldown' when the 7-day wall says no. */
  switchClass: (next: 9 | 10) => Promise<'ok' | 'cooldown' | 'error'>;
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
   * upsert per session.
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
        void deleteAllDownloads();
        if (previousOwner) await AsyncStorage.removeItem(queueKey(previousOwner));
        setState((s) => ({ ...EMPTY, ownerId: uid, settings: devicePrefs(s.settings) }));
      } else if (uid) {
        setState((s) => (s.ownerId === uid ? s : { ...s, ownerId: uid }));
      }

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
        /**
         * The class on the SERVER wins, always. A switch made on the website
         * must reset this phone too, or one subscription quietly serves two
         * classes, which is the exact thing the client asked us to prevent.
         * Adopting it is a full local restart: downloads off disk, progress
         * gone, same as switching here.
         */
        const serverGrade = server?.grade === 10 ? 10 : server?.grade === 9 ? 9 : null;
        const localGrade = stateRef.current.onboarding?.classLevel ?? 9;
        if (serverGrade && serverGrade !== localGrade) {
          void deleteAllDownloads();
          setContentGrade(serverGrade);
          setState((s) => ({
            ...EMPTY,
            user: s.user,
            settings: s.settings,
            onboarding: { ...(s.onboarding ?? { board: 'fbise', medium: 'en', group: 'science', subjects: [] }), classLevel: serverGrade },
          }));
          setHydrated(true);
          return;
        }
        if (server) {
          setState((s) => {
            const merged = mergeHydratedState(s, server);
            // Choices already made on this device win; the server's copy is
            // for the phone that has none, which is what a reinstall is.
            const onboarding = s.onboarding?.subjects?.length
              ? s.onboarding
              : ((server.onboarding as Onboarding | null) ?? s.onboarding);
            // The nudge preferences belong to the account, so the server's
            // copy wins outright. Null means the student has never set them
            // and this device's defaults stand.
            const settings = server.accountPrefs ? { ...s.settings, ...server.accountPrefs } : s.settings;
            return { ...merged, onboarding, settings, xp: totalXp(merged.attempts, merged.cardsKnown) };
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
   * Keep the content layer on the student's medium.
   *
   * db.ts queries by medium and nothing ever set it, so every live read came
   * back English however the student had it configured. A full Urdu
   * translation of all nine subjects sat in the database that no Urdu-medium
   * student could reach.
   */
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
        setState((s) => {
          const merged = mergeHydratedState(s, server);
          return {
            ...merged,
            /*
             * The server wins on plan ticks, unlike everything else here.
             * The rest are sets that only ever grow, so a union is right for
             * them. A tick can be taken back, and a union would quietly
             * restore a task the student just uncrossed on their laptop.
             */
            planDone: server.planDone,
            // Same reasoning: a switch turned off on the laptop must turn off
            // here, and a merge would never let it.
            settings: server.accountPrefs ? { ...s.settings, ...server.accountPrefs } : s.settings,
            xp: totalXp(merged.attempts, merged.cardsKnown),
          };
        });
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

  const contentMedium = state.settings.language;
  useEffect(() => {
    setContentMedium(contentMedium);
  }, [contentMedium]);

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

  // And on the student's class. The server filters by it (RLS); this keeps
  // the local cache and labels honest.
  const classLevel = state.onboarding?.classLevel ?? 9;
  useEffect(() => {
    setContentGrade(classLevel);
  }, [classLevel]);

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
        if (uid) void supabase.from('profiles').update({ onboarding, grade: onboarding.classLevel }).eq('id', uid);
      },
      recordAttempt: (a) => {
        const full: Attempt = { ...a, id: `a-${Date.now()}-${Math.round(Math.random() * 1e4)}`, at: Date.now() };
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
        markDayActive();
        return full;
      },
      addResult: (r) => {
        const full: TestResult = { ...r, id: `r-${Date.now()}`, at: Date.now() };
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
        const day = todayKey();
        // Read before the update, like every other action that can start a day.

        setState((s) => {
          const used = s.ai.day === day ? s.ai.used : 0;
          const limit = s.premium.active ? AI_QUOTA.premium : AI_QUOTA.free;
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
       * disk, then server history, then local state. Server-first on purpose:
       * if the cooldown rejects it, nothing local has been touched yet.
       */
      switchClass: async (next) => {
        const uid = authUser?.id;
        if (!uid) return 'error';
        const current = stateRef.current.onboarding;
        const onboarding: Onboarding = {
          board: 'fbise',
          medium: 'en',
          group: 'science',
          subjects: [],
          ...(current ?? {}),
          classLevel: next,
        };
        const { error } = await supabase.from('profiles').update({ grade: next, onboarding }).eq('id', uid);
        if (error) return String(error.message).includes('grade_cooldown') ? 'cooldown' : 'error';
        deleteAllDownloads();
        void wipeStudyHistory(supabase, uid);
        setContentGrade(next);
        setState((s) => ({ ...EMPTY, user: s.user, settings: s.settings, onboarding }));
        return 'ok';
      },
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
    [queueAndFlush, markDayActive, authUser?.id],
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
        // Real work counts as completion, and all three of these sync, so the
        // plan reads the same on every device without storing anything extra.
        readSections: view.readSections,
        cardsKnown: view.cardsKnown,
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
