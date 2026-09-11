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
import { Attempt, Language, PlanTask, StringKey, SyncOp, TestResult, XP, buildPlan, configureTutor, flushQueue, hydrateStudyState, level, markNotificationsRead, mergeHydratedState, boardChoice, setContentBoard, setContentGrade, setContentMedium, streakFrom, syncActiveDay, syncAttempt, syncCardKnown, syncCardUnknown, syncAccountPrefs, syncPlanTask, syncReadSection, syncResult, todayKey, totalXp, translate, wipeStudyHistory, xpForAttempt } from '@matricmate/core';
import {
  EMPTY,
  Onboarding,
  Settings,
  State,
  aiLimitFor,
  devicePrefs,
  getQueue,
  serverSnapshotFor,
  getSnapshot,
  hydrate,
  loadQueue,
  pushToQueue,
  saveQueue,
  subscribe,
  touchToday,
  update,
} from './persisted-store';
import { createClient } from './supabase/client';
import { writeLanguageCookie, writeThemeCookie } from './ui-language';

/**
 * The tutor rides same-origin: /api/ai/* on this very deployment, with the
 * session cookie carrying who is asking. No token function needed, and module
 * scope on purpose so it is configured before any screen can send a question.
 */
configureTutor({ siteUrl: '', getToken: async () => null });

export type { Onboarding, Settings, State };

type Actions = {
  /** Local mirror only; the profiles row is written by the screen that calls this. */
  setName: (name: string) => void;
  signOut: () => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
  /** Server-enforced class change; 'cooldown' when the 7-day wall says no. */
  switchClass: (next: 9 | 10) => Promise<'ok' | 'cooldown' | 'error'>;
  recordAttempt: (a: Omit<Attempt, 'id' | 'at'>) => void;
  /** One store update for a whole paper. Submitting a 50-question exam through
   * recordAttempt would notify every subscriber 50 times in a synchronous
   * burst; this does it once. */
  recordAttempts: (list: Omit<Attempt, 'id' | 'at'>[]) => void;
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
  markCard: (cardId: string, known: boolean) => void;
  consumeAi: () => boolean;
  readNotifications: () => void;
  setSettings: (s: Partial<Settings>) => void;
  /** The single language switch: interface and syllabus move together. */
  setLanguage: (next: Language) => void;
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

/**
 * The last day this browser has queued an "I studied" row for.
 *
 * Not derived from state.activeDays, which is what every caller used to do,
 * and that was wrong in a way only an upgrade exposed. An older build marked
 * days active locally without queueing the write, so the stored state arrives
 * already containing today, every "is this a new day" check answers no, and
 * the row is never written: the student studies daily and their streak reads
 * zero. Reset on load, so the first study action of each session queues one
 * op; the queue collapses duplicates by day and the write is an idempotent
 * upsert, so the cost is at most one redundant upsert per session.
 */
let activeDaySynced: string | null = null;

function markDayActive(): void {
  const day = todayKey();
  if (activeDaySynced === day) return;
  activeDaySynced = day;
  queueAndFlush(syncActiveDay(day));
}

const actions: Actions = {
  setName: (name) => update((s) => (s.user ? { ...s, user: { ...s.user, name } } : s)),
  /**
   * Signing out takes this account's data off the machine.
   *
   * It used to null the user and the plan and leave everything else: the
   * class, the subjects, every attempt, the streak, the notifications. The
   * hydrate merges rather than replaces and prefers local onboarding, so the
   * next account to sign in here inherited all of it permanently, and a brand
   * new one skipped onboarding because the subjects were already "chosen".
   * On a shared computer that is one student reading another's marks.
   */
  signOut: () => update((s) => ({ ...EMPTY, hydrated: true, settings: devicePrefs(s.settings) })),
  setOnboarding: (o) => {
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
    }));
    // The class lives on profiles.grade and the board on profiles.board,
    // because row level security follows both. Pushed whenever either
    // changes; the board reaches its column through the onboarding record
    // (migration 0036), so it has to be sent even when the class is not.
    const snap = getSnapshot();
    if ((o.classLevel || o.board) && snap.user) {
      void createClient()
        .from('profiles')
        .update({ ...(o.classLevel ? { grade: o.classLevel } : {}), onboarding: snap.onboarding })
        .eq('id', snap.user.id);
    }
  },
  /**
   * Change class, server first: the trigger there enforces the 7 day
   * cooldown and RLS follows profiles.grade, so if the server says no,
   * nothing local has been touched. On yes: server history wiped, local
   * store restarted, and every other device adopts the new class on its
   * next hydration.
   */
  switchClass: async (next) => {
    const snap = getSnapshot();
    if (!snap.user) return 'error';
    const onboarding: Onboarding = {
      board: 'fbise',
      medium: 'en',
      group: 'science',
      subjects: [],
      ...(snap.onboarding ?? {}),
      classLevel: next,
    };
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ grade: next, onboarding }).eq('id', snap.user.id);
    if (error) return String(error.message).includes('grade_cooldown') ? 'cooldown' : 'error';
    void wipeStudyHistory(supabase, snap.user.id);
    setContentGrade(next);
    update((s) => ({ ...EMPTY, user: s.user, premium: s.premium, settings: s.settings, hydrated: true, onboarding }));
    return 'ok';
  },
  recordAttempt: (a) => {
    const full: Attempt = { ...a, id: `a-${Date.now()}-${getSnapshot().attempts.length}`, at: Date.now() };
    // One rule for what an answer is worth, in core, so the increment here and
    // the recompute after a sync cannot disagree. They did: the exam bonus was
    // credited here and dropped there.
    update((s) =>
      touchToday({
        ...s,
        attempts: [...s.attempts, full],
        xp: s.xp + xpForAttempt(full),
      }),
    );
    // Queued, not awaited: the store already updated and the screen already
    // moved on. See queueAndFlush below for what happens to this in the
    // background.
    queueAndFlush(syncAttempt(full));
    markDayActive();
  },
  recordAttempts: (list) => {
    if (!list.length) return;
    const at = Date.now();
    const base = getSnapshot().attempts.length;
    const full = list.map((a, n) => ({ ...a, id: `a-${at}-${base + n}`, at }));
    update((s) =>
      touchToday({
        ...s,
        attempts: [...s.attempts, ...full],
        xp: s.xp + full.reduce((sum, a) => sum + xpForAttempt(a), 0),
      })
    );
    // Each answer in the paper is still its own row server-side (attempts is
    // an append-only log); only the store notification was batched.
    full.forEach((a) => queueAndFlush(syncAttempt(a)));
    markDayActive();
  },
  addResult: (r) => {
    const full: TestResult = { ...r, id: `r-${Date.now()}`, at: Date.now() };
    update((s) => touchToday({ ...s, results: [full, ...s.results] }));
    queueAndFlush(syncResult(full));
    markDayActive();
    return full;
  },
  markSectionRead: (sectionId, chapterId, index) => {
    const isNewSection = !getSnapshot().readSections.includes(sectionId);
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
    markDayActive();
  },
  markStudied: () => {
    const day = todayKey();
    // No early return on local state: see markDayActive above.
    update((s) => (s.activeDays.includes(day) ? s : { ...s, activeDays: [...s.activeDays, day] }));
    markDayActive();
  },
  togglePlanTask: (id) => {
    const nowDone = !getSnapshot().planDone.includes(id);
    update((s) => ({
      ...s,
      // Task ids carry the day, so anything from an earlier day is dead
      // weight. Dropping it here keeps the list to today's three.
      planDone: (s.planDone.includes(id)
        ? s.planDone.filter((x) => x !== id)
        : [...s.planDone, id]
      ).filter((x) => x.endsWith(todayKey())),
    }));
    // And on the server, so the same tick shows on their phone.
    queueAndFlush(syncPlanTask(id, todayKey(), nowDone));
  },
  markCard: (cardId, known) => {
    const wasKnown = getSnapshot().cardsKnown.includes(cardId);
    update((s) =>
      touchToday({
        ...s,
        cardsKnown: known
          ? s.cardsKnown.includes(cardId)
            ? s.cardsKnown
            : [...s.cardsKnown, cardId]
          : s.cardsKnown.filter((x) => x !== cardId),
        // XP.card, not a literal 2: the Android app reads the constant and a
        // second copy of the number is a second thing to keep in step.
        xp: known && !s.cardsKnown.includes(cardId) ? s.xp + XP.card : s.xp,
      })
    );
    if (known && !wasKnown) queueAndFlush(syncCardKnown(cardId));
    else if (!known && wasKnown) queueAndFlush(syncCardUnknown(cardId));
    /**
     * An hour of flashcards is an hour of studying.
     *
     * This was the one study action that recorded no active day, so a student
     * who revises by card ended the day with an unmoved streak and could be
     * sent a "your streak is at risk" nudge on a day they had worked. Either
     * direction counts: saying "repeat" is reviewing the card, not skipping it.
     */
    markDayActive();
  },
  consumeAi: () => {
    let allowed = false;
    const day = todayKey();
    // Read before the update, like every other action that can start a day.
    update((s) => {
      const used = s.ai.day === day ? s.ai.used : 0;
      const limit = aiLimitFor(s.premium.active);
      if (used >= limit) return { ...s, ai: { day, used } };
      allowed = true;
      return touchToday({ ...s, ai: { day, used: used + 1 } });
    });
    // Asking the tutor is studying, so it counts, but it has to be written
    // through like the rest. Marking the day locally and never syncing it is
    // what left the streak disagreeing between the phone and the laptop.
    if (allowed) markDayActive();
    return allowed;
  },
  readNotifications: () =>
    update((s) => {
      // The server too. Flipping only local state meant the badge cleared
      // until the next hydration read the same rows back, still unread.
      const uid = s.user?.id;
      if (uid) void markNotificationsRead(createClient(), uid);
      return { ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) };
    }),
  setSettings: (patch) =>
    update((s) => {
      const settings = { ...s.settings, ...patch };
      /**
       * The theme lives on the document element, which React does not
       * re-render, so it is set here the same way the language direction is.
       * The cookie is what makes the next cold load paint dark immediately
       * rather than flashing white first (see readUiTheme).
       */
      if ('dark' in patch && typeof document !== 'undefined') {
        const theme = settings.dark ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        writeThemeCookie(theme);
      }
      // The three nudge preferences are account-level, so they go up. The rest
      // describe this browser and stay in it.
      const uid = s.user?.id;
      if (uid && ('reminders' in patch || 'streakAlerts' in patch || 'reminderTime' in patch || 'dark' in patch ||
        'channelPush' in patch || 'channelEmail' in patch)) {
        void syncAccountPrefs(createClient(), uid, {
          reminders: settings.reminders,
          streakAlerts: settings.streakAlerts,
          reminderTime: settings.reminderTime,
          dark: settings.dark,
          channelPush: settings.channelPush,
          channelEmail: settings.channelEmail,
        });
      }
      return { ...s, settings };
    }),
  /**
   * One language for the whole app.
   *
   * The interface language and the syllabus language used to be two separate
   * switches, and the two apps did not even agree on which one drove the
   * content: Android followed the settings toggle, the website followed the
   * medium picked at onboarding, so the same control did different things.
   * One choice now writes all three places, and the profile write is what
   * lets the server-rendered pages read the right medium.
   */
  setLanguage: (next) => {
    update((s) => ({
      ...s,
      settings: { ...s.settings, language: next, contentMedium: next },
      onboarding: s.onboarding ? { ...s.onboarding, medium: next } : s.onboarding,
    }));
    /**
     * The server needs this too. It renders <html lang dir> before any
     * JavaScript runs, and localStorage is invisible to it, so without the
     * cookie the next cold load would paint left-to-right Latin and flip.
     * The reload is what makes the switch feel instantaneous rather than
     * half-applied: direction is set on the document element, which React
     * does not re-render.
     */
    writeLanguageCookie(next);
    if (typeof window !== 'undefined') {
      if (document.documentElement.lang !== next) {
        document.documentElement.lang = next;
        document.documentElement.dir = next === 'ur' ? 'rtl' : 'ltr';
      }
      /*
       * And re-render the server tree, which the cookie alone does not do.
       *
       * Half this app's chrome is decided on the server from that cookie: the
       * `Localized` wrapper, the direction classes, and anything a server
       * component rendered through `t()`. Writing the cookie changes what the
       * NEXT request would produce and nothing about the page already on
       * screen, so the sidebar stayed on the left in Urdu until the student
       * reloaded by hand. The comment above claimed a reload; there was none.
       *
       * An event rather than a call, because this is a plain module and
       * `useRouter` is a hook. `LanguageRefresh` in the app shell listens and
       * calls `router.refresh()`, which re-fetches the server tree in place
       * instead of throwing the whole page away.
       */
      window.dispatchEvent(new CustomEvent('mm:language'));
    }
    const onboarding = getSnapshot().onboarding;
    if (onboarding) {
      void createClient().auth.getUser().then(({ data }) => {
        if (data.user) void createClient().from('profiles').update({ onboarding }).eq('id', data.user.id);
      });
    }
  },
  resetDemo: () =>
    update((s) => {
      // The server too, not just localStorage. Progress syncs now, so clearing
      // only this browser is undone by the next hydration, and a button that
      // appears to do nothing is worse than no button. Fired from inside the
      // updater because that is where the signed-in user is readable, and not
      // awaited because the screen should respond at once.
      const uid = s.user?.id;
      if (uid) void wipeStudyHistory(createClient(), uid);
      /* Notifications survive. They belong to the account, nothing here can
         delete them, and blanking them locally only made the inbox look
         cleared until the next hydration read every one of them back. */
      return {
        ...EMPTY,
        hydrated: true,
        user: s.user,
        onboarding: s.onboarding,
        settings: s.settings,
        notifications: s.notifications,
      };
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
  /**
   * The class on the SERVER wins, always. A switch made on the phone must
   * reset this browser too, or one subscription quietly serves two classes.
   */
  const serverGrade = server?.grade === 10 ? 10 : server?.grade === 9 ? 9 : null;
  const localGrade = getSnapshot().onboarding?.classLevel ?? 9;
  // And the board: the database serves whichever board the account chose, so
  // a choice made on the phone has to reach this browser too.
  const serverBoard = boardChoice(server?.onboarding);
  const localBoard = getSnapshot().onboarding?.board ?? 'fbise';
  if ((serverGrade && serverGrade !== localGrade) || (serverBoard && serverBoard !== localBoard)) {
    const classLevel = serverGrade ?? localGrade;
    const board = serverBoard ?? localBoard;
    setContentGrade(classLevel);
    setContentBoard(board);
    update((s) => ({
      ...EMPTY,
      user: s.user,
      premium: s.premium,
      settings: s.settings,
      hydrated: true,
      onboarding: {
        medium: 'en',
        group: 'science',
        subjects: [],
        ...(s.onboarding ?? {}),
        classLevel,
        board,
      },
    }));
    void flush(userId);
    return;
  }
  if (server) {
    update((s) => {
      const merged = mergeHydratedState(s, server);
      // The nudge preferences belong to the account, so the server's copy
      // wins. Null means never set, and this browser's defaults stand.
      const settings = server.accountPrefs ? { ...s.settings, ...server.accountPrefs } : s.settings;
      return { ...merged, settings, xp: totalXp(merged.attempts, merged.cardsKnown) };
    });
  }
  void flush(userId);
}

export function AppProvider({
  children,
  initialLanguage = 'en',
}: {
  children: React.ReactNode;
  /**
   * What the server rendered with, read from the language cookie by the
   * layout. Without it the server always renders English and an Urdu student
   * watches the page rewrite itself on hydration.
   */
  initialLanguage?: Language;
}) {
  const serverSnapshot = useCallback(() => serverSnapshotFor(initialLanguage), [initialLanguage]);
  const state = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);

  // Reads the saved snapshot into the external store; not a setState cascade.
  useEffect(() => {
    hydrate();
  }, []);

  /**
   * Keeps the document element on whatever theme the store currently holds.
   *
   * setSettings already flips it on the tap, for immediacy. This is the case
   * that tap does not cover: the theme is an account setting now, so it also
   * arrives from the server on hydration and from the other device over the
   * realtime channel, and neither of those goes through setSettings here.
   */
  const dark = state.settings.dark;
  useEffect(() => {
    const theme = dark ? 'dark' : 'light';
    if (document.documentElement.dataset.theme === theme) return;
    document.documentElement.dataset.theme = theme;
    writeThemeCookie(theme);
  }, [dark]);

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
        /*
         * Signed out, by whatever route: the action below, an expired session,
         * or another tab. This account's data leaves the machine either way.
         * It used to null the user and leave the class, the subjects, every
         * attempt and the streak behind, and since the hydrate merges rather
         * than replaces and prefers local onboarding, the next account to sign
         * in here inherited all of it. On a shared computer that is one
         * student reading another's marks.
         */
        if (!u) return s.user || s.ownerId ? { ...EMPTY, hydrated: true, settings: devicePrefs(s.settings) } : s;

        const user = {
          id: u.id,
          name: u.user_metadata?.name?.trim() || (u.email ?? '').split('@')[0] || 'Student',
          contact: u.email ?? '',
        };

        /*
         * A different student in the same browser. Checked before anything
         * else, so it also catches the tab being closed mid-sign-out and
         * signing in as somebody else directly.
         */
        if (s.ownerId && s.ownerId !== user.id) {
          return { ...EMPTY, hydrated: true, ownerId: user.id, user, settings: devicePrefs(s.settings) };
        }

        /*
         * Note what does NOT happen here: signing in is not studying. This
         * used to mark today active, which inflated the streak and, because
         * it did not queue the matching write, burned the "is this a new day"
         * flag before any real study action could claim it. That is why
         * active_days sat empty while attempts landed normally, and why every
         * streak in the product read zero.
         */
        if (s.ownerId === user.id && s.user?.id === user.id && s.user.name === user.name) return s;
        return { ...s, ownerId: user.id, user };
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
        // The student's own class, so the plan can never point at the other
        // one's syllabus. See planChapterId.
        grade: state.onboarding?.classLevel ?? 9,
        lastChapterId: state.lastChapterId,
        attempts: state.attempts,
        doneIds: state.planDone,
        // Real work counts as completion, and all three of these sync, so the
        // plan reads the same on every device without storing anything extra.
        readSections: state.readSections,
        cardsKnown: state.cardsKnown,
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
  /**
   * The home screen, live.
   *
   * Same reasoning as the Android side: streak, today's plan and the week
   * chips all read from synced rows, so the two apps agreed eventually but not
   * promptly. A question answered on the phone did not move this page's streak
   * until a reload. The broadcast (migration 0016) carries only which table
   * moved, never a row, so the re-read happens through the student's own
   * session. Debounced, because a ten question set writes ten rows.
   */
  const liveUserId = state.user?.id ?? null;
  useEffect(() => {
    if (!liveUserId) return;
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const server = await hydrateStudyState(supabase, liveUserId);
        if (cancelled || !server) return;
        update((s) => {
          const merged = mergeHydratedState(s, server);
          // The server wins on plan ticks. The other sets only ever grow, so a
          // union suits them; a tick can be taken back, and a union would
          // restore a task the student just uncrossed on their phone.
          return {
            ...merged,
            planDone: server.planDone,
            // Same reasoning: a switch turned off on the phone must turn off
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
  const classLevel = state.onboarding?.classLevel ?? 9;
  // Set while rendering, not in an effect: the chapter lookups these steer are
  // module reads, and an effect lands after the screens below have already
  // read the old syllabus, with nothing to make them read again. That would
  // leave a Punjab student looking at FBISE's chapters.
  setContentGrade(classLevel);
  setContentBoard(state.onboarding?.board ?? 'fbise');

  useEffect(() => {
    setContentMedium(contentMedium);
  }, [contentMedium]);

  /**
   * Reconcile the document with the store once, after hydration.
   *
   * The server dressed the page from a cookie, and the cookie can be behind:
   * an account that chose Urdu on another device, or before this cookie
   * existed at all. Correcting it here means the preference always wins, and
   * writing the cookie back means the next cold load is right from the first
   * byte instead of flipping again.
   */
  useEffect(() => {
    if (document.documentElement.lang !== contentMedium) {
      document.documentElement.lang = contentMedium;
      document.documentElement.dir = contentMedium === 'ur' ? 'rtl' : 'ltr';
    }
    writeLanguageCookie(contentMedium);
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
    setLang: (next: Language) => a.setLanguage(next),
  };
}
