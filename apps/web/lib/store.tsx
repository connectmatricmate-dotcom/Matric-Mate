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
  SyncOp,
  TestResult,
  buildPlan,
  flushQueue,
  hydrateStudyState,
  level,
  mergeHydratedState,
  setContentMedium,
  streakFrom,
  wipeStudyHistory,
  syncActiveDay,
  syncAttempt,
  syncCardKnown,
  syncCardUnknown,
  syncReadSection,
  syncResult,
  todayKey,
  totalXp,
  translate,
} from '@matricmate/core';
import {
  EMPTY,
  Onboarding,
  Settings,
  State,
  aiLimitFor,
  getQueue,
  getServerSnapshot,
  getSnapshot,
  hydrate,
  loadQueue,
  pushToQueue,
  saveQueue,
  subscribe,
  touchToday,
  update,
  xpFor,
} from './persisted-store';
import { createClient } from './supabase/client';

export type { Onboarding, Settings, State };

type Actions = {
  /** Local mirror only; the profiles row is written by the screen that calls this. */
  setName: (name: string) => void;
  signOut: () => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
  recordAttempt: (a: Omit<Attempt, 'id' | 'at'>) => void;
  /** One store update for a whole paper. Submitting a 50-question exam through
   * recordAttempt would notify every subscriber 50 times in a synchronous
   * burst; this does it once. */
  recordAttempts: (list: Omit<Attempt, 'id' | 'at'>[]) => void;
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
  /** Re-reads entitlement from the server. Returns whether premium is on. */
  refreshPremium: () => Promise<boolean>;
};

type Ctx = {
  state: State;
  hydrated: boolean;
  actions: Actions;
  derived: { streak: number; level: number; aiLeft: number; aiLimit: number; plan: PlanTask[]; subjects: string[] };
};

const AppCtx = createContext<Ctx | null>(null);

const actions: Actions = {
  setName: (name) => update((s) => (s.user ? { ...s, user: { ...s.user, name } } : s)),
  signOut: () => update((s) => ({ ...s, user: null, premium: { active: false, validTill: null } })),
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
  recordAttempt: (a) => {
    const day = todayKey();
    const isNewDay = !getSnapshot().activeDays.includes(day);
    const full: Attempt = { ...a, id: `a-${Date.now()}-${getSnapshot().attempts.length}`, at: Date.now() };
    update((s) => touchToday({ ...s, attempts: [...s.attempts, full], xp: s.xp + xpFor(a.correct, a.confidence) }));
    // Queued, not awaited: the store already updated and the screen already
    // moved on. See queueAndFlush below for what happens to this in the
    // background.
    queueAndFlush(syncAttempt(full));
    if (isNewDay) queueAndFlush(syncActiveDay(day));
  },
  recordAttempts: (list) => {
    if (!list.length) return;
    const day = todayKey();
    const isNewDay = !getSnapshot().activeDays.includes(day);
    const at = Date.now();
    const base = getSnapshot().attempts.length;
    const full = list.map((a, n) => ({ ...a, id: `a-${at}-${base + n}`, at }));
    update((s) =>
      touchToday({
        ...s,
        attempts: [...s.attempts, ...full],
        xp: s.xp + list.reduce((sum, a) => sum + xpFor(a.correct, a.confidence), 0),
      })
    );
    // Each answer in the paper is still its own row server-side (attempts is
    // an append-only log); only the store notification was batched.
    full.forEach((a) => queueAndFlush(syncAttempt(a)));
    if (isNewDay) queueAndFlush(syncActiveDay(day));
  },
  addResult: (r) => {
    const full: TestResult = { ...r, id: `r-${Date.now()}`, at: Date.now() };
    const day = todayKey();
    const isNewDay = !getSnapshot().activeDays.includes(day);
    update((s) => touchToday({ ...s, results: [full, ...s.results] }));
    queueAndFlush(syncResult(full));
    if (isNewDay) queueAndFlush(syncActiveDay(day));
    return full;
  },
  markSectionRead: (sectionId, chapterId, index) => {
    const isNewSection = !getSnapshot().readSections.includes(sectionId);
    const day = todayKey();
    const isNewDay = !getSnapshot().activeDays.includes(day);
    update((s) =>
      touchToday({
        ...s,
        readSections: s.readSections.includes(sectionId) ? s.readSections : [...s.readSections, sectionId],
        lastChapterId: chapterId,
        lastSectionIndex: index,
      })
    );
    // Only the first time a section is read is synced (read_sections' own
    // comment in 0001_init.sql: re-reading is not a new fact), so "resume
    // reading" restores to the newest section reached, not wherever a
    // student last happened to be re-reading.
    if (isNewSection) queueAndFlush(syncReadSection(sectionId, chapterId, index));
    if (isNewDay) queueAndFlush(syncActiveDay(day));
  },
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
  markCard: (cardId, known) => {
    const wasKnown = getSnapshot().cardsKnown.includes(cardId);
    update((s) => ({
      ...s,
      cardsKnown: known
        ? s.cardsKnown.includes(cardId)
          ? s.cardsKnown
          : [...s.cardsKnown, cardId]
        : s.cardsKnown.filter((x) => x !== cardId),
      xp: known && !s.cardsKnown.includes(cardId) ? s.xp + 2 : s.xp,
    }));
    if (known && !wasKnown) queueAndFlush(syncCardKnown(cardId));
    else if (!known && wasKnown) queueAndFlush(syncCardUnknown(cardId));
  },
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
  resetDemo: () =>
    update((s) => {
      // The server too, not just localStorage. Progress syncs now, so clearing
      // only this browser is undone by the next hydration, and a button that
      // appears to do nothing is worse than no button. Fired from inside the
      // updater because that is where the signed-in user is readable, and not
      // awaited because the screen should respond at once.
      const uid = s.user?.id;
      if (uid) void wipeStudyHistory(createClient(), uid);
      return { ...EMPTY, hydrated: true, user: s.user, onboarding: s.onboarding, settings: s.settings };
    }),
  refreshPremium: () => refreshPremium(),
};

/**
 * Entitlement is read, never written, on the client.
 *
 * The row is written by the payment webhook under the service role, and RLS
 * gives the student SELECT and nothing else, so this mirrors the database into
 * the UI; it cannot invent access. A past valid_till counts as inactive even
 * while the column still says active, because nothing runs at midnight to flip
 * it. Same rule as the Android app and the gateway confirm.
 */
async function refreshPremium(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.from('entitlements').select('active, plan, valid_till').maybeSingle();
  const till = data?.valid_till ? new Date(data.valid_till).getTime() : null;
  const active = Boolean(data?.active) && (till === null || till > Date.now());
  update((s) => ({
    ...s,
    premium: active ? { active: true, plan: data?.plan ?? undefined, validTill: till } : { active: false, validTill: null },
  }));
  return active;
}

/* ------------------------------------------------------------- study sync */

/**
 * Which user id has already had its offline queue loaded and its server
 * study-state pulled in this tab, or null while signed out. Set synchronously
 * so `queueAndFlush` always knows who a write belongs to, and checked before
 * acting on it so a SIGNED_IN/USER_UPDATED pair (the same events
 * refreshPremium reacts to) does not re-pull and re-merge twice.
 */
let syncedFor: string | null = null;
let flushing = false;

/**
 * Sends whatever is queued for `userId`. Called after every enqueue and on
 * an online/visibility signal, never on a timer: there is nothing to poll for,
 * only a queue to drain the moment a connection plausibly exists.
 */
async function flush(userId: string): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const supabase = createClient();
    const { remaining } = await flushQueue(supabase, userId, getQueue());
    saveQueue(userId, remaining);
  } finally {
    flushing = false;
  }
}

/**
 * Queues a write and kicks a flush in the background. Never awaited by an
 * action: recordAttempt etc. must return the instant local state is updated,
 * with the network write following behind it rather than gating it.
 */
function queueAndFlush(op: SyncOp): void {
  const userId = syncedFor;
  if (!userId) return; // signed out: nothing to attach this write to
  pushToQueue(userId, op);
  void flush(userId);
}

/**
 * Pulls server study-state into the store and loads that user's offline
 * queue, once per identity per tab. A fresh sign-in on a new browser has an
 * empty local store, so this is what turns a blank dashboard into the real
 * one; on a browser that already has local state, it is a cross-device merge
 * (see mergeHydratedState), which is what keeps two devices converging.
 */
async function syncStudyState(userId: string): Promise<void> {
  if (syncedFor === userId) return;
  syncedFor = userId;
  loadQueue(userId);
  const supabase = createClient();
  const server = await hydrateStudyState(supabase, userId);
  if (syncedFor !== userId) return; // a different user signed in while this was in flight
  if (server) {
    update((s) => {
      const merged = mergeHydratedState(s, server);
      return { ...merged, xp: totalXp(merged.attempts, merged.cardsKnown) };
    });
  }
  void flush(userId);
}

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
        return touchToday({ ...s, user });
      });

    void supabase.auth.getUser().then(({ data }) => {
      apply(data.user);
      if (data.user) {
        void refreshPremium();
        void syncStudyState(data.user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      apply(session?.user ?? null);
      // Entitlement and study-state re-pull only when the PERSON might have
      // changed, not on every TOKEN_REFRESHED. Token rotation happens
      // constantly in the background, and each re-check is a network round
      // trip for an answer that cannot have changed; syncStudyState also
      // short-circuits on its own via `syncedFor`, so this gate is belt and
      // braces against firing it on every refresh.
      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          void refreshPremium();
          void syncStudyState(session.user.id);
        }
      } else {
        // Signing out must also drop what the last account was entitled to,
        // or the next person on a shared computer inherits the crown until
        // their first sync answers. The offline queue is left on disk under
        // the outgoing user's own key rather than cleared: a write that has
        // not synced yet is real work a student did, and it is still there
        // to send if they sign back in on this browser.
        update((s) => ({ ...s, premium: { active: false, validTill: null } }));
        syncedFor = null;
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * Retries whatever is still queued on the two browser signals that
   * plausibly mean "we might be online again": the connection coming back,
   * and the tab regaining focus after being backgrounded (mobile Safari and
   * Chrome both suspend timers and sometimes connections in a hidden tab).
   */
  useEffect(() => {
    const onOnline = () => {
      if (syncedFor) void flush(syncedFor);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && syncedFor) void flush(syncedFor);
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
  /**
   * Keep the content layer on the student's medium.
   *
   * db.ts queries by medium, and nothing ever told it which one. Every live
   * read came back English no matter what the student picked at onboarding, so
   * an Urdu-medium student got English notes and English questions while a full
   * Urdu translation sat unread in the database. The medium chosen at
   * onboarding is the syllabus language, which is what content is keyed on.
   */
  const contentMedium = state.onboarding?.medium ?? 'en';
  useEffect(() => {
    setContentMedium(contentMedium);
  }, [contentMedium]);

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
