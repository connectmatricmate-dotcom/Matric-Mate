/**
 * App state, session, onboarding choices, progress, attempts, AI usage, settings.
 *
 * Persisted to AsyncStorage (localStorage on web) so the demo survives reloads and
 * app restarts. When Supabase lands this becomes a thin cache over server state;
 * the shape of `state` and the action names stay the same.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_QUOTA, XP, buildPlan, level, streakFrom, todayKey ,
  Attempt,
  ChatThread,
  Confidence,
  Group,
  Medium,
  Notification,
  PlanTask,
  TestResult,
} from '@matricmate/core';
import { useAuth } from './auth';

const KEY = 'mm.state.v1';

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

/* --------------------------------------------------------------- demo seed */

const daysAgo = (n: number) => Date.now() - n * 864e5;

/**
 * Seeded once at first sign-in so the client sees a lived-in app: real streak,
 * real accuracy, real weak topics. Cleared by "Reset demo data" in Settings.
 */
function seed(): Partial<State> {
  const topics: [string, string, string, number][] = [
    // topic, subjectId, chapterId, accuracy target out of 6
    ['Newton’s laws', 'phy', 'phy-3', 5],
    ['Momentum', 'phy', 'phy-3', 4],
    ['Circular motion', 'phy', 'phy-3', 2],
    ['Friction', 'phy', 'phy-3', 3],
    ['Force', 'phy', 'phy-3', 6],
    ['Turning Effect of Forces', 'phy', 'phy-4', 2],
    ['Atomic models', 'chem', 'chem-2', 5],
    ['Isotopes', 'chem', 'chem-2', 4],
    ['Electronic configuration', 'chem', 'chem-2', 3],
    ['Organelles', 'bio', 'bio-4', 5],
    ['Transport', 'bio', 'bio-4', 3],
  ];
  const attempts: Attempt[] = [];
  let i = 0;
  // Confidence pattern per topic. Correctness runs k < right, so Pakka answers
  // land mostly right and Tukka mostly wrong, but not perfectly, which is what
  // makes the confidence-vs-accuracy chart believable.
  const CONF: Confidence[] = [2, 1, 2, 0, 1, 2];
  topics.forEach(([topic, subjectId, chapterId, right]) => {
    for (let k = 0; k < 6; k++) {
      const correct = k < right;
      const confidence: Confidence = CONF[k];
      attempts.push({
        id: `seed-a${i}`,
        mcqId: `seed-m${i}`,
        chapterId,
        subjectId,
        topic,
        correct,
        confidence,
        mode: k % 5 === 0 ? 'exam' : 'practice',
        at: daysAgo(13 - (i % 13)),
      });
      i += 1;
    }
  });

  const results: TestResult[] = [
    {
      id: 'seed-r1',
      subjectId: 'phy',
      chapterId: 'phy-2',
      label: 'Kinematics, timed exam',
      score: 15,
      total: 20,
      xp: 150,
      mode: 'exam',
      at: daysAgo(5),
      attemptIds: [],
    },
    {
      id: 'seed-r2',
      subjectId: 'phy',
      chapterId: 'phy-3',
      label: 'Dynamics, practice',
      score: 16,
      total: 20,
      xp: 168,
      mode: 'practice',
      at: daysAgo(2),
      attemptIds: [],
    },
    {
      id: 'seed-r3',
      subjectId: 'chem',
      chapterId: 'chem-2',
      label: 'Structure of Atoms, practice',
      score: 12,
      total: 15,
      xp: 120,
      mode: 'practice',
      at: daysAgo(1),
      attemptIds: [],
    },
  ];

  const activeDays = [0, 1, 2, 4, 5, 7, 8, 9, 11, 13].map((n) =>
    new Date(daysAgo(n)).toISOString().slice(0, 10)
  );

  const notifications: Notification[] = [
    {
      id: 'n1',
      kind: 'streak',
      title: 'Streak alive, shabash!',
      body: 'Keep it going: one lesson today counts.',
      at: Date.now() - 2 * 36e5,
      target: 'progress',
      read: false,
    },
    {
      id: 'n2',
      kind: 'reminder',
      title: 'Study reminder',
      body: '10 MCQs on Dynamics are waiting.',
      at: Date.now() - 5 * 36e5,
      target: 'session-setup',
      read: false,
    },
    {
      id: 'n3',
      kind: 'report',
      title: 'Your report card is ready',
      body: 'Tap to view and share with your parents.',
      at: daysAgo(3),
      target: 'report',
      read: true,
    },
  ];

  return {
    attempts,
    results,
    activeDays,
    notifications,
    readSections: ['phy-3-s1', 'phy-3-s2', 'phy-3-s3', 'phy-1-gs1', 'chem-2-s1'],
    lastChapterId: 'phy-3',
    lastSectionIndex: 3,
    xp: 2840,
    downloads: ['phy-2', 'phy-3'],
    cardsKnown: ['phy3-f1', 'phy3-f2', 'phy3-f4'],
  };
}

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
  toggleDownload: (chapterId: string) => void;
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
   * Study progress is still local. Identity and entitlement are not, and are
   * merged in below so every screen keeps reading `state.user` and
   * `state.premium` without knowing where they came from.
   */
  const { user: authUser, entitlement } = useAuth();
  const [state, setState] = useState<State>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setHydrated(true);
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

  const touchToday = (s: State): State => {
    const t = todayKey();
    return s.activeDays.includes(t) ? s : { ...s, activeDays: [...s.activeDays, t] };
  };

  /**
   * Seed sample progress the first time a real account is seen on this phone.
   *
   * The app is still a prototype on mock content, and an empty dashboard shows
   * the client nothing. This goes away with the study-state sync, when progress
   * starts coming from Postgres like entitlement already does.
   */
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !authUser || seededFor.current === authUser.id) return;
    seededFor.current = authUser.id;
    setState((s) => touchToday(s.attempts.length === 0 && s.results.length === 0 ? { ...s, ...seed() } : s));
  }, [hydrated, authUser]);

  const actions = useMemo<Actions>(
    () => ({
      setOnboarding: (o) =>
        setState((s) => ({
          ...s,
          onboarding: {
            classLevel: 9,
            board: 'fbise',
            medium: 'en',
            group: 'science',
            subjects: [],
            ...(s.onboarding ?? {}),
            ...o,
          },
        })),
      recordAttempt: (a) => {
        const full: Attempt = { ...a, id: `a-${Date.now()}-${Math.round(Math.random() * 1e4)}`, at: Date.now() };
        setState((s) =>
          touchToday({
            ...s,
            attempts: [...s.attempts, full],
            xp: s.xp + XP.forAnswer(a.correct, a.confidence),
          })
        );
        return full;
      },
      addResult: (r) => {
        const full: TestResult = { ...r, id: `r-${Date.now()}`, at: Date.now() };
        setState((s) => touchToday({ ...s, results: [full, ...s.results] }));
        return full;
      },
      markSectionRead: (sectionId, chapterId, index) =>
        setState((s) =>
          touchToday({
            ...s,
            readSections: s.readSections.includes(sectionId) ? s.readSections : [...s.readSections, sectionId],
            lastChapterId: chapterId,
            lastSectionIndex: index,
          })
        ),
      togglePlanTask: (id) =>
        setState((s) => ({
          ...s,
          planDone: s.planDone.includes(id) ? s.planDone.filter((x) => x !== id) : [...s.planDone, id],
        })),
      toggleDownload: (chapterId) =>
        setState((s) => ({
          ...s,
          downloads: s.downloads.includes(chapterId)
            ? s.downloads.filter((x) => x !== chapterId)
            : [...s.downloads, chapterId],
        })),
      markCard: (cardId, known) =>
        setState((s) => ({
          ...s,
          cardsKnown: known
            ? s.cardsKnown.includes(cardId)
              ? s.cardsKnown
              : [...s.cardsKnown, cardId]
            : s.cardsKnown.filter((x) => x !== cardId),
          xp: known && !s.cardsKnown.includes(cardId) ? s.xp + XP.card : s.xp,
        })),
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
      resetDemo: () => setState((s) => ({ ...EMPTY, user: s.user, onboarding: s.onboarding, settings: s.settings })),
    }),
    []
  );

  /**
   * What every screen actually sees.
   *
   * Identity and entitlement are overlaid from the auth store, so `state.user`
   * and `state.premium` stay exactly where they have always been while their
   * source of truth moved to the server. No screen had to change, and none of
   * them can write to either any more.
   */
  const view = useMemo<State>(
    () => ({
      ...state,
      user: authUser ? { id: authUser.id, name: authUser.name, contact: authUser.email } : null,
      premium: { active: entitlement.active, validTill: entitlement.validTill },
    }),
    [state, authUser, entitlement]
  );

  const derived = useMemo(() => {
    const aiLimit = view.premium.active ? AI_QUOTA.premium : AI_QUOTA.free;
    const usedToday = view.ai.day === todayKey() ? view.ai.used : 0;
    const subjects = view.onboarding?.subjects?.length
      ? view.onboarding.subjects
      : ['phy', 'chem', 'bio', 'math', 'eng', 'urd', 'isl'];
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
