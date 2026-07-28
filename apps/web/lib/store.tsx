'use client';

/**
 * React binding for the persisted store. The store itself lives outside React
 * (see ./persisted-store) so hydration doesn't need a setState effect.
 *
 * The public shape — `{ state, hydrated, actions, derived }` — matches the
 * Android app's `useApp()` exactly, so screens port between the two apps
 * without rewiring.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  Attempt,
  ChatThread,
  Language,
  PlanTask,
  StringKey,
  TestResult,
  buildPlan,
  level,
  streakFrom,
  todayKey,
  translate,
} from '@matricmate/core';
import {
  EMPTY,
  Onboarding,
  Settings,
  State,
  aiLimitFor,
  getServerSnapshot,
  getSnapshot,
  hydrate,
  subscribe,
  touchToday,
  update,
  xpFor,
} from './persisted-store';
import { seed } from './seed';

export type { Onboarding, Settings, State };

type Actions = {
  signIn: (u: { id: string; name: string; contact: string }) => void;
  signOut: () => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
  subscribePremium: (p: { ref: string; validTill: number }) => void;
  cancelSubscription: () => void;
  recordAttempt: (a: Omit<Attempt, 'id' | 'at'>) => void;
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
  derived: { streak: number; level: number; aiLeft: number; aiLimit: number; plan: PlanTask[]; subjects: string[] };
};

const AppCtx = createContext<Ctx | null>(null);

const actions: Actions = {
  signIn: (user) =>
    update((s) => {
      const fresh = s.attempts.length === 0 && s.results.length === 0;
      return touchToday({ ...s, user, ...(fresh ? seed() : {}) });
    }),
  signOut: () => update((s) => ({ ...s, user: null })),
  setOnboarding: (o) =>
    update((s) => ({
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
  subscribePremium: ({ ref, validTill }) =>
    update((s) => ({
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
  cancelSubscription: () => update((s) => ({ ...s, premium: { active: false, validTill: null } })),
  recordAttempt: (a) =>
    update((s) =>
      touchToday({
        ...s,
        attempts: [...s.attempts, { ...a, id: `a-${Date.now()}-${s.attempts.length}`, at: Date.now() }],
        xp: s.xp + xpFor(a.correct, a.confidence),
      })
    ),
  addResult: (r) => {
    const full: TestResult = { ...r, id: `r-${Date.now()}`, at: Date.now() };
    update((s) => touchToday({ ...s, results: [full, ...s.results] }));
    return full;
  },
  markSectionRead: (sectionId, chapterId, index) =>
    update((s) =>
      touchToday({
        ...s,
        readSections: s.readSections.includes(sectionId) ? s.readSections : [...s.readSections, sectionId],
        lastChapterId: chapterId,
        lastSectionIndex: index,
      })
    ),
  togglePlanTask: (id) =>
    update((s) => ({
      ...s,
      planDone: s.planDone.includes(id) ? s.planDone.filter((x) => x !== id) : [...s.planDone, id],
    })),
  toggleDownload: (chapterId) =>
    update((s) => ({
      ...s,
      downloads: s.downloads.includes(chapterId) ? s.downloads.filter((x) => x !== chapterId) : [...s.downloads, chapterId],
    })),
  markCard: (cardId, known) =>
    update((s) => ({
      ...s,
      cardsKnown: known
        ? s.cardsKnown.includes(cardId)
          ? s.cardsKnown
          : [...s.cardsKnown, cardId]
        : s.cardsKnown.filter((x) => x !== cardId),
      xp: known && !s.cardsKnown.includes(cardId) ? s.xp + 2 : s.xp,
    })),
  consumeAi: () => {
    let allowed = false;
    update((s) => {
      const day = todayKey();
      const used = s.ai.day === day ? s.ai.used : 0;
      const limit = aiLimitFor(s.premium.active);
      if (used >= limit) return { ...s, ai: { day, used } };
      allowed = true;
      return touchToday({ ...s, ai: { day, used: used + 1 } });
    });
    return allowed;
  },
  saveThread: (t) => update((s) => ({ ...s, threads: [t, ...s.threads.filter((x) => x.id !== t.id)].slice(0, 20) })),
  readNotifications: () => update((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  setSettings: (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
  resetDemo: () => update((s) => ({ ...EMPTY, hydrated: true, user: s.user, onboarding: s.onboarding, settings: s.settings })),
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Reads the saved snapshot into the external store; not a setState cascade.
  useEffect(() => {
    hydrate();
  }, []);

  const derived = useMemo(() => {
    const aiLimit = aiLimitFor(state.premium.active);
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

  const value = useMemo(() => ({ state, hydrated: state.hydrated, actions, derived }), [state, derived]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}

/** Same call signature as the Android app's hook. */
export function useT() {
  const { state } = useApp();
  const lang = state.settings.language;
  return useCallback(
    (key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );
}

export function useLang() {
  const { state, actions: a } = useApp();
  return {
    lang: state.settings.language,
    isUrdu: state.settings.language === 'ur',
    setLang: (next: Language) => a.setSettings({ language: next }),
  };
}
