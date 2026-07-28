/**
 * App state — session, onboarding choices, progress, attempts, AI usage, settings.
 *
 * Persisted to AsyncStorage (localStorage on web) so the demo survives reloads and
 * app restarts. When Supabase lands this becomes a thin cache over server state;
 * the shape of `state` and the action names stay the same.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_QUOTA, XP, buildPlan, level, streakFrom, todayKey } from '../core/domain';
import {
  Attempt,
  ChatThread,
  Confidence,
  Group,
  Medium,
  Notification,
  PlanTask,
  TestResult,
} from '../core/types';

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
  // land mostly right and Tukka mostly wrong — but not perfectly, which is what
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
      label: 'Kinematics — timed exam',
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
      label: 'Dynamics — practice',
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
      label: 'Structure of Atoms — practice',
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
      title: 'Streak alive — shabash!',
      body: 'Keep it going: one lesson today counts.',
      at: Date.now() - 2 * 36e5,
      href: '/(tabs)/progress',
      read: false,
    },
    {
      id: 'n2',
      kind: 'reminder',
      title: 'Study reminder',
      body: '10 MCQs on Dynamics are waiting.',
      at: Date.now() - 5 * 36e5,
      href: '/session/setup',
      read: false,
    },
    {
      id: 'n3',
      kind: 'report',
      title: 'Your report card is ready',
      body: 'Tap to view and share with your parents.',
      at: daysAgo(3),
      href: '/insights/report',
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

type Actions = {
  signIn: (u: { id: string; name: string; contact: string }) => void;
  signOut: () => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
  subscribe: (p: { ref: string; validTill: number }) => void;
  cancelSubscription: () => void;
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
        // corrupt cache — start clean rather than crash
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

  const actions = useMemo<Actions>(
    () => ({
      signIn: (user) =>
        setState((s) => {
          const fresh = s.attempts.length === 0 && s.results.length === 0;
          return touchToday({ ...s, user, ...(fresh ? seed() : {}) });
        }),
      signOut: () => setState((s) => ({ ...s, user: null })),
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
      subscribe: ({ ref, validTill }) =>
        setState((s) => ({
          ...s,
          premium: { active: true, validTill, ref },
          notifications: [
            {
              id: `pay-${Date.now()}`,
              kind: 'payment',
              title: 'Payment received',
              body: 'Premium is active for one month.',
              at: Date.now(),
              href: '/account/payments',
              read: false,
            },
            ...s.notifications,
          ],
        })),
      cancelSubscription: () => setState((s) => ({ ...s, premium: { active: false, validTill: null } })),
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

  const derived = useMemo(() => {
    const aiLimit = state.premium.active ? AI_QUOTA.premium : AI_QUOTA.free;
    const usedToday = state.ai.day === todayKey() ? state.ai.used : 0;
    const subjects = state.onboarding?.subjects?.length
      ? state.onboarding.subjects
      : ['phy', 'chem', 'bio', 'math', 'eng', 'urd', 'isl'];
    return {
      streak: streakFrom(state.activeDays),
      level: level(state.xp),
      aiLeft: Math.max(0, aiLimit - usedToday),
      aiLimit,
      subjects,
      plan: buildPlan({
        subjectIds: subjects,
        lastChapterId: state.lastChapterId,
        attempts: state.attempts,
        doneIds: state.planDone,
      }),
    };
  }, [state]);

  return <AppCtx.Provider value={{ state, hydrated, actions, derived }}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
