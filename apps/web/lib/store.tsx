'use client';

/**
 * React binding for the persisted store. The store itself lives outside React
 * (see ./persisted-store) so hydration doesn't need a setState effect.
 *
 * The public shape, `{ state, hydrated, actions, derived }`, matches the
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
import { createClient } from './supabase/client';
import { seed } from './seed';

export type { Onboarding, Settings, State };

type Actions = {
  signIn: (u: { id: string; name: string; contact: string }) => void;
  signOut: () => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
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

  /**
   * Identity comes from Supabase, not from localStorage.
   *
   * proxy.ts already refuses protected routes server-side, so this is not the
   * access control; it is how the UI learns the student's name and keeps in
   * step when a session is refreshed, or ends in another tab.
   */
  useEffect(() => {
    const supabase = createClient();

    const apply = (u: { id: string; email?: string; user_metadata?: { name?: string } } | null) =>
      update((s) => {
        if (!u) return s.user ? { ...s, user: null } : s;
        const user = {
          id: u.id,
          name: u.user_metadata?.name?.trim() || (u.email ?? '').split('@')[0] || 'Student',
          contact: u.email ?? '',
        };
        if (s.user?.id === user.id && s.user.name === user.name) return s;
        // A brand new account gets the sample data once, so the demo is not an
        // empty dashboard. Real accounts with history are left alone.
        const fresh = s.attempts.length === 0 && s.results.length === 0;
        return touchToday({ ...s, user, ...(fresh ? seed() : {}) });
      });

    /**
     * Entitlement is read, never written, on the client.
     *
     * The row is written by the payment webhook under the service role, and RLS
     * gives the student SELECT and nothing else. So this mirrors the database
     * into the UI; it cannot invent access. Anything that used to set premium
     * locally is gone, because a local flag and the database disagreeing is
     * worse than no flag at all.
     */
    const syncEntitlement = async () => {
      const { data } = await supabase.from('entitlements').select('active, plan, valid_till').maybeSingle();
      update((s) => ({
        ...s,
        premium: data?.active
          ? {
              active: true,
              plan: data.plan ?? undefined,
              validTill: data.valid_till ? new Date(data.valid_till).getTime() : null,
              ref: s.premium.ref,
            }
          : { active: false, validTill: null },
      }));
    };

    void supabase.auth.getUser().then(({ data }) => {
      apply(data.user);
      if (data.user) void syncEntitlement();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      apply(session?.user ?? null);
      if (session?.user) void syncEntitlement();
    });
    return () => sub.subscription.unsubscribe();
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
