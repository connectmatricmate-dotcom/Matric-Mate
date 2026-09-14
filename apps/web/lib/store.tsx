'use client';

/**
 * React binding for the persisted store. The store itself lives outside React
 * (see ./persisted-store) so hydration doesn't need a setState effect.
 *
 * The public shape, `{ state, hydrated, actions, derived }`, matches the
 * Android app's `useApp()`, so screens port between the two apps without
 * rewiring. `synced` is the one addition: see Ctx below.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  Attempt,
  Language,
  PlanTask,
  StringKey,
  SyncOp,
  TestResult,
  XP,
  boardChoice,
  buildPlan,
  clearContentCache,
  clearQuota,
  clearSyncQueue,
  configureTutor,
  contentVersion,
  flushQueue,
  gradeChoice,
  hydratedXp,
  hydrateStudyState,
  level,
  markNotificationsRead,
  mergeHydratedState,
  newRowId,
  primeAllContent,
  setContentBoard,
  setContentGrade,
  setContentMedium,
  setQuotaUser,
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
  translate,
  wipeStudyHistory,
  xpForAttempt,
} from '@matricmate/core';
import type { Access, Board, Group, HydratedStudyState } from '@matricmate/core';
import {
  EMPTY,
  Onboarding,
  Settings,
  State,
  accessOf,
  devicePrefs,
  getQueue,
  getSnapshot,
  hydrate,
  loadQueue,
  pushToQueue,
  saveQueue,
  seedFromServer,
  serverSnapshotFor,
  type PlanSeed,
  subscribe,
  touchToday,
  update,
} from './persisted-store';
import { createClient } from './supabase/client';
/*
 * Connects the shared content layer to this browser's Supabase client, for its
 * side effect. It has to be imported from here, a client module every signed-in
 * page loads, and not from the (app) layout: a server component importing a
 * client module for its side effect does not put that module in the browser
 * bundle, so the content layer was never connected, every browser read fell
 * back to the bundle, and "Start" on a practice set said there were no
 * questions for every chapter.
 */
import './content';
import { readLanguageCookie, writeLanguageCookie, writeThemeCookie } from './ui-language';

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
  /** Sends what is still queued (briefly), then takes this account's data off the browser. */
  signOut: () => Promise<void>;
  /**
   * Records onboarding choices here at once, and on the account. Resolves to
   * whether the account took them, so a step that must not move on without
   * them (the class, the subjects) can wait and say so when it fails.
   */
  setOnboarding: (o: Partial<Onboarding>) => Promise<boolean>;
  /** Server-enforced class change; 'cooldown' when the 7-day wall says no. */
  switchClass: (next: 9 | 10) => Promise<'ok' | 'cooldown' | 'error'>;
  /** A board change, with every safeguard a class change has. See switchBoard. */
  switchBoard: (next: Board) => Promise<'ok' | 'error'>;
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
  /** Resolves false, with nothing changed here, when the server could not be cleared. */
  resetDemo: () => Promise<boolean>;
  /** Re-reads entitlement from the server. Returns whether premium is on. */
  refreshPremium: () => Promise<boolean>;
};

type Ctx = {
  state: State;
  hydrated: boolean;
  /**
   * True once this account's saved setup and history have been read from the
   * server, or the read gave up. `hydrated` only says this browser's own copy
   * has loaded, and on a new browser that copy is empty: a screen that writes
   * a choice back (the onboarding steps) waits for this, or it saves the
   * defaults over what the account already had.
   */
  synced: boolean;
  actions: Actions;
  derived: {
    streak: number;
    level: number;
    aiLeft: number;
    aiLimit: number;
    /** What the plan opens: tier, AI, a trial's subject. See accessFor in core. */
    access: Access;
    plan: PlanTask[];
    /** The subjects the student can study now: all of theirs, or a trial's one. */
    subjects: string[];
    /** Their other subjects during a trial, shown locked. Empty otherwise. */
    lockedSubjects: string[];
    /**
     * The chapter index's version (core's contentVersion). Screens that read
     * chapters synchronously while rendering key a memo on it, so they read
     * again when the index lands or changes.
     */
    contentReady: number;
  };
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
 * upsert, so the cost is at most one redundant upsert per session. Reset again
 * whenever the history is wiped, which deletes today's row with the rest.
 */
let activeDaySynced: string | null = null;

function markDayActive(): void {
  const day = todayKey();
  if (activeDaySynced === day) return;
  activeDaySynced = day;
  queueAndFlush(syncActiveDay(day));
}

/* ------------------------------------------------------- the account setup */

/**
 * Class, board, medium and subjects, as the account holds them.
 *
 * Every write here changes only the fields a student actually chose, merged
 * into the record the account already has. They used to send this browser's
 * whole copy, filled out with defaults wherever it had nothing: a browser that
 * had never loaded the account saved `board: 'fbise'`, `medium: 'en'` and no
 * subjects over a Punjab student's real setup, and the database followed the
 * board to FBISE on the spot (migration 0036).
 *
 * One at a time, in order. Each write reads the record and then saves it, and
 * two of those overlapping (the board step saving while the medium step
 * starts) would let the second put back what the first had just changed.
 */
let setupChain: Promise<unknown> = Promise.resolve();
/** Writes started since the page loaded, and how many have not finished. See syncStudyState. */
let setupWrites = 0;
let setupPending = 0;

type Client = ReturnType<typeof createClient>;
type Setup = Record<string, unknown>;

async function signedInId(supabase: Client): Promise<string | null> {
  if (syncedFor) return syncedFor;
  // The class step can be pressed before the store has heard who is signed
  // in. The old code quietly skipped the write then, and the class was lost.
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function writeSetup<T>(fallback: T, write: (supabase: Client, uid: string, current: Setup) => Promise<T>): Promise<T> {
  setupWrites += 1;
  setupPending += 1;
  const run = setupChain
    .then(async () => {
      const supabase = createClient();
      const uid = await signedInId(supabase);
      if (!uid) return fallback;
      const { data, error } = await supabase.from('profiles').select('onboarding').eq('id', uid).maybeSingle();
      if (error || !data) return fallback;
      return write(supabase, uid, (data.onboarding as Setup | null) ?? {});
    })
    .catch(() => fallback)
    .finally(() => {
      setupPending -= 1;
    });
  setupChain = run;
  return run;
}

/** Only what was set: an undefined field is not a choice, and must not reach the account as one. */
function defined(patch: Partial<Onboarding>): Setup {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
}

function saveSetup(patch: Partial<Onboarding>): Promise<boolean> {
  const fields = defined(patch);
  return writeSetup(false, async (supabase, uid, current) => {
    // The class also lives on profiles.grade, which row level security reads.
    // Nothing derives it from the record, so it is sent alongside every time.
    const grade = fields.classLevel === 9 || fields.classLevel === 10 ? { grade: fields.classLevel } : {};
    const unchanged = Object.entries(fields).every(([k, v]) => JSON.stringify(current[k]) === JSON.stringify(v));
    if (unchanged && !('grade' in grade)) return true;
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding: { ...current, ...fields }, ...grade })
      .eq('id', uid);
    return !error;
  });
}

/**
 * The fields of a saved record this app understands, and only those. The
 * class comes from the record (gradeChoice), not from profiles.grade: that
 * column defaults to 9, so it cannot tell "chose Class 9" from "never chose".
 */
function setupFrom(raw: unknown): Partial<Onboarding> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Setup;
  const out: Partial<Onboarding> = {};
  const classLevel = gradeChoice(o);
  if (classLevel) out.classLevel = classLevel;
  const board = boardChoice(o);
  if (board) out.board = board;
  if (o.medium === 'en' || o.medium === 'ur') out.medium = o.medium;
  if (o.group === 'science' || o.group === 'arts') out.group = o.group as Group;
  if (Array.isArray(o.subjects)) {
    const subjects = o.subjects.filter((s): s is string => typeof s === 'string');
    if (subjects.length) out.subjects = subjects;
  }
  return out;
}

/**
 * A full record from partial ones, later layers winning. An empty subject list
 * is not a choice either: web accounts saved `[]` for months (see
 * setOnboarding), and taking that over a real list would wipe it.
 */
function composeSetup(...layers: (Partial<Onboarding> | null | undefined)[]): Onboarding {
  const out: Onboarding = { classLevel: 9, medium: 'en', group: 'science', subjects: [] };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) {
      if (v === undefined || (k === 'subjects' && (!Array.isArray(v) || v.length === 0))) continue;
      (out as Setup)[k] = v;
    }
  }
  return out;
}

/** The language follows the medium: they are one switch. */
function withMedium(settings: Settings, medium: Language): Settings {
  return settings.language === medium && settings.contentMedium === medium ? settings : { ...settings, language: medium, contentMedium: medium };
}

/**
 * The name the account holds, once read, so a token refresh does not put the
 * signup name back. Edit profile writes profiles.name, and every sign-in event
 * rebuilt the name from the auth metadata, which nothing had changed, so an
 * edited name reverted on the next load.
 */
let profileName: { id: string; name: string } | null = null;

const actions: Actions = {
  setName: (name) => {
    const uid = getSnapshot().user?.id;
    if (uid) profileName = { id: uid, name };
    update((s) => (s.user ? { ...s, user: { ...s.user, name } } : s));
  },
  /**
   * Signing out takes this account's data off the machine.
   *
   * It used to null the user and the plan and leave everything else: the
   * class, the subjects, every attempt, the streak, the notifications. The
   * hydrate merges rather than replaces and prefers local onboarding, so the
   * next account to sign in here inherited all of it permanently, and a brand
   * new one skipped onboarding because the subjects were already "chosen".
   * On a shared computer that is one student reading another's marks. The AI
   * count goes too: the next student started with the last one's, and if that
   * was fifty, with a disabled chat box for the rest of the day.
   */
  signOut: async () => {
    /*
     * Answers still queued are sent first, with a short wait: the student is
     * told their progress is saved to the account, and a queue left behind
     * here would only go out if they signed in on this browser again. Then
     * the queue, the chapter index and the AI count go, all of them this
     * account's.
     */
    const uid = syncedFor;
    if (uid) {
      await Promise.race([flush(uid), new Promise((resolve) => setTimeout(resolve, 3000))]);
      saveQueue(uid, clearSyncQueue());
    }
    setQuotaUser(null);
    clearQuota();
    clearContentCache();
    // Forgotten here too: the server action ends the session, and this tab
    // hears nothing of it, so the same student signing straight back in
    // looked already synced and got no history and no chapters.
    syncedFor = null;
    pulledFor = null;
    update((s) => ({ ...EMPTY, hydrated: true, settings: devicePrefs(s.settings) }));
  },
  /**
   * Written on every call, not only when the class or board changes.
   *
   * The subjects step sends only the subjects, and the old guard wrote only
   * when a class or board was in the change, so every web signup's subjects
   * stayed `[]` on the account. Everything that reads them there then fell
   * back to defaults: the practice tiles' starting chapter, the report PDF,
   * the coach, and every other device.
   */
  setOnboarding: (o) => {
    update((s) => ({ ...s, onboarding: composeSetup({ medium: s.settings.language }, s.onboarding, o) }));
    return saveSetup(o);
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
    const uid = snap.user?.id;
    if (!uid) return 'error';
    const saved = await writeSetup<Setup | 'cooldown' | 'error'>('error', async (supabase, id, current) => {
      const onboarding = { ...current, classLevel: next };
      const { error } = await supabase.from('profiles').update({ grade: next, onboarding }).eq('id', id);
      if (error) return String(error.message).includes('grade_cooldown') ? 'cooldown' : 'error';
      return onboarding;
    });
    if (typeof saved === 'string') return saved;
    // This browser's choices over the account's, since the student is here;
    // the account fills in what this browser has never held.
    await startOver(uid, composeSetup({ medium: snap.settings.language }, setupFrom(saved), snap.onboarding, { classLevel: next }));
    return 'ok';
  },
  /**
   * Change board, the way switchClass changes class.
   *
   * It went through the plain onboarding write, with no confirm, no wipe and
   * nothing reset. Row level security moved to the new board at once, but this
   * browser kept the old board's answers and last chapter, so the plan pointed
   * at chapters the database no longer served, under blank names; and every
   * other device found the board changed and reset itself while the old
   * history was still on the server. The screen that calls this confirms
   * first, because the history goes.
   */
  switchBoard: async (next) => {
    const snap = getSnapshot();
    const uid = snap.user?.id;
    if (!uid) return 'error';
    const saved = await writeSetup<Setup | null>(null, async (supabase, id, current) => {
      const onboarding = { ...current, board: next };
      const { error } = await supabase.from('profiles').update({ onboarding }).eq('id', id);
      return error ? null : onboarding;
    });
    if (!saved) return 'error';
    await startOver(uid, composeSetup({ medium: snap.settings.language }, setupFrom(saved), snap.onboarding, { board: next }));
    return 'ok';
  },
  recordAttempt: (a) => {
    // A uuid, which the server row takes as its own id, so the copy here and
    // the copy that comes back on the next sync are recognisably one answer
    // rather than two, and XP is not counted twice.
    const full: Attempt = { ...a, id: newRowId(), at: Date.now() };
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
    const full = list.map((a) => ({ ...a, id: newRowId(), at }));
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
    const full: TestResult = { ...r, id: newRowId(), at: Date.now() };
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
      const limit = accessOf(s.premium).aiLimit;
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
       * re-render, so it is set here directly. The cookie is what makes the
       * next cold load paint dark immediately rather than flashing white
       * first (see readUiTheme).
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
   * One choice now writes all three places: the store, the cookie the server
   * renders from, and the account, so another device can pick it up.
   */
  setLanguage: (next) => {
    update((s) => ({
      ...s,
      settings: withMedium(s.settings, next),
      onboarding: s.onboarding ? { ...s.onboarding, medium: next } : s.onboarding,
    }));
    /*
     * The cookie is what the server renders from: `Localized`, anything a
     * server component put through `t()`, and which medium the notes it
     * fetches are in. Direction on screen does not wait for it; AppProvider's
     * own wrapper flips in this same render.
     */
    writeLanguageCookie(next);
    /*
     * And re-render the server tree, which the cookie alone does not do.
     * Writing it changes what the NEXT request would produce and nothing about
     * the page already on screen. An event rather than a call, because this is
     * a plain module and `useRouter` is a hook: `LanguageRefresh` in each shell
     * listens and calls `router.refresh()`, which re-fetches the server tree in
     * place instead of throwing the page away.
     */
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mm:language'));
    /*
     * The chapter index carries per-medium counts (questions, cards,
     * sections), so it is loaded again in the new medium. The medium is set
     * here rather than left to the next render, which would come after this
     * read had already gone out in the old one.
     */
    setContentMedium(next);
    void primeAllContent(createClient());
    /*
     * And the account, so the student's other devices and the server jobs
     * that write to them (the coach report, reminders) follow the switch.
     * Merged into whatever the account holds, so a browser that never loaded
     * the account's setup still saves this and nothing else.
     */
    void saveSetup({ medium: next });
  },
  /**
   * The server first, then this browser. Progress syncs, so clearing only this
   * browser is undone by the next hydration, and a button that appears to do
   * nothing is worse than no button. When the server cannot be cleared, this
   * browser keeps its copy too, so the screen never shows a clean slate that
   * the next load takes back.
   */
  resetDemo: async () => {
    const uid = getSnapshot().user?.id;
    if (uid) {
      dropQueue(uid);
      await flushing;
      if (!(await wipeStudyHistory(createClient(), uid))) return false;
    }
    activeDaySynced = null;
    /* Notifications survive. They belong to the account, nothing here can
       delete them, and blanking them locally only made the inbox look
       cleared until the next hydration read every one of them back. */
    update((s) => ({
      ...EMPTY,
      hydrated: true,
      ownerId: s.ownerId,
      user: s.user,
      premium: s.premium,
      onboarding: s.onboarding,
      settings: s.settings,
      notifications: s.notifications,
    }));
    return true;
  },
  refreshPremium: () => refreshPremium(),
};

/**
 * A new start on a new syllabus, once the account has already moved to it.
 *
 * The order matters. Writes still queued from the old syllabus are dropped,
 * and any already on their way are let land, before the history is wiped: an
 * answer arriving after the wipe would put the old class back on the server,
 * and every device would read it there. Then the browser's chapter index is
 * loaded again, because it was loaded once, at startup, for the old syllabus:
 * until a hard reload the plan read 0/0, the coach said "Open  and read the
 * notes" and the chapter picker was empty.
 */
async function startOver(uid: string, onboarding: Onboarding): Promise<void> {
  const supabase = createClient();
  dropQueue(uid);
  await flushing;
  await wipeStudyHistory(supabase, uid);
  activeDaySynced = null;
  setContentGrade(onboarding.classLevel);
  setContentBoard(onboarding.board ?? 'fbise');
  update((s) => ({
    ...EMPTY,
    ownerId: s.ownerId,
    user: s.user,
    premium: s.premium,
    settings: s.settings,
    hydrated: true,
    onboarding,
  }));
  /*
   * After the state, not before it: a render still holding the old class
   * would set the old syllabus back while this read was out, and the read
   * would then land as nothing. The plan re-derives when it lands.
   */
  await primeAllContent(supabase);
}

/**
 * Entitlement is read, never written, on the client.
 *
 * The row is written by the payment webhook under the service role, and RLS
 * gives the student SELECT and nothing else, so this mirrors the database into
 * the UI; it cannot invent access. A past valid_till counts as inactive even
 * while the column still says active, because nothing runs at midnight to flip
 * it, and so does no valid_till at all: the same rule as planIsActive in
 * lib/entitlement.ts, which the paywall uses. Counting a plan with no end date
 * as live here showed Premium to an account the layout had just sent to the
 * upgrade page.
 */
async function refreshPremium(): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.from('entitlements').select('active, plan, valid_till, trial_subject').maybeSingle();
  // A read that failed says nothing about the plan. It used to be taken as
  // "no plan", which locked a paying student out of everything until a reload
  // happened to succeed.
  if (error) return getSnapshot().premium.active;
  const till = data?.valid_till ? new Date(data.valid_till).getTime() : null;
  const active = Boolean(data?.active) && till !== null && Number.isFinite(till) && till > Date.now();
  update((s) => ({
    ...s,
    premium: active
      ? { active: true, plan: data?.plan ?? undefined, validTill: till, trialSubject: data?.trial_subject ?? undefined }
      : { active: false, validTill: null },
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
/** Whose server state has actually landed. Behind `synced` on the context. */
let pulledFor: string | null = null;

let flushing: Promise<void> | null = null;

/**
 * Throws the queue away: a reset, a class or board change. clearSyncQueue
 * also stops a flush that is already sending, after the write it is on, so
 * nothing from the old syllabus follows the wipe onto the server.
 */
function dropQueue(userId: string): void {
  saveQueue(userId, clearSyncQueue());
}

/**
 * Sends whatever is queued for `userId`. Called after every enqueue and on
 * an online/visibility signal, never on a timer: there is nothing to poll for,
 * only a queue to drain the moment a connection plausibly exists.
 */
function flush(userId: string): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    let more = false;
    try {
      const { settled, remaining, cancelled } = await flushQueue(createClient(), userId, getQueue());
      // Dropped while this was sending, or a different student since: what
      // it returns belongs to a queue that no longer exists.
      if (cancelled || syncedFor !== userId) return;
      /*
       * Exactly the ops that left, taken out of the live queue. Saving what
       * could not be sent used to replace the queue and lose every answer
       * queued while this batch was on the network: a quick tap through a set
       * while an earlier answer was still sending dropped the later ones.
       */
      const gone = new Set(settled);
      const live = getQueue().filter((op) => !gone.has(op.id));
      saveQueue(userId, live);
      more = remaining.length === 0 && live.length > 0;
    } finally {
      flushing = null;
    }
    if (more) void flush(userId);
  })();
  return flushing;
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

async function readProfileName(supabase: Client, userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    return name || null;
  } catch {
    return null;
  }
}

async function readSetup(supabase: Client, userId: string): Promise<Pick<HydratedStudyState, 'onboarding' | 'grade'> | null> {
  const { data, error } = await supabase.from('profiles').select('onboarding,grade').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return {
    onboarding: (data.onboarding as Setup | null) ?? null,
    grade: typeof data.grade === 'number' ? data.grade : null,
  };
}

/** The account's setup as a hydrate result with no history in it, for when the full read timed out. */
async function readSetupOnly(supabase: Client, userId: string): Promise<HydratedStudyState | null> {
  const setup = await readSetup(supabase, userId).catch(() => null);
  if (!setup) return null;
  return {
    ...setup,
    readSections: [],
    attempts: [],
    results: [],
    cardsKnown: [],
    activeDays: [],
    planDone: [],
    notifications: [],
    accountPrefs: null,
    lastSectionIndex: 0,
  };
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
  pulledFor = null;
  loadQueue(userId);
  const supabase = createClient();
  /*
   * The chapter index, loaded under this student's session. The load at
   * startup usually runs before the session is known and gets nothing back,
   * so without this a Punjab or Class 10 student browsed empty lists until
   * something else happened to load them. Not awaited: the index announces
   * itself (contentVersion) and the plan re-derives when it lands.
   */
  void primeAllContent(supabase);
  const writesBefore = setupWrites;
  const [pulled, name] = await Promise.all([hydrateStudyState(supabase, userId), readProfileName(supabase, userId)]);
  if (syncedFor !== userId) return; // a different user signed in while this was in flight
  /*
   * The full pull is eight queries against a deadline. When it gives up, the
   * setup alone is still worth one more small read: the onboarding screens
   * wait on this to know the account's class and board, and saving over a
   * setup they never saw would move a Class 10 or Punjab student back to the
   * defaults.
   */
  let server = pulled ?? (await readSetupOnly(supabase, userId));
  /*
   * The class step can be pressed while this read is still out. Its write
   * then lands after the read did, and the read's older class looked like a
   * switch made on another device: the student was reset to Class 9 a second
   * after picking Class 10. So a read that overlapped a setup write waits for
   * it and reads the setup again.
   */
  if (server && (setupPending > 0 || setupWrites !== writesBefore)) {
    await setupChain;
    const fresh = await readSetup(supabase, userId);
    if (syncedFor !== userId) return;
    if (fresh) server = { ...server, ...fresh };
  }
  if (name) profileName = { id: userId, name };
  await applyServerState(userId, server);
  if (syncedFor !== userId) return;
  /*
   * And the index once more, on the syllabus and medium the account has just
   * settled. Adopting a class, board or medium moves the content layer's
   * epoch, and a load already in flight then lands as nothing (it was read
   * for the old one), which left a Punjab student on a new browser with
   * empty lists. Set here rather than at the next render, which would come
   * after this read had gone out. Identical rows do not move the version.
   */
  const settled = getSnapshot();
  setContentGrade(settled.onboarding?.classLevel ?? 9);
  setContentBoard(settled.onboarding?.board ?? 'fbise');
  setContentMedium(settled.settings.language);
  void primeAllContent(supabase);
  pulledFor = userId;
  // Also what flips `synced` for the screens waiting on it.
  update((s) => (s.user?.id === userId && name && s.user.name !== name ? { ...s, user: { ...s.user, name } } : { ...s }));
  void flush(userId);
}

async function applyServerState(userId: string, pulled: HydratedStudyState | null): Promise<void> {
  let server = pulled;
  const local = getSnapshot().onboarding;
  /*
   * The account has no class saved and this browser has one: an account from
   * before choices synced, or a class step whose write never landed. Sent up
   * and waited for before anything is compared, so profiles.grade, which row
   * level security serves content by, matches the class on screen. The
   * column's own default (9) is not a choice, which is why the saved record
   * decides here and not the column (gradeChoice).
   */
  if (server && local && gradeChoice(server.onboarding) === null) {
    const patch: Partial<Onboarding> = { classLevel: local.classLevel };
    if (local.board && !boardChoice(server.onboarding)) patch.board = local.board;
    if (await saveSetup(patch)) {
      server = { ...server, onboarding: { ...(server.onboarding ?? {}), ...patch }, grade: local.classLevel };
    }
    if (syncedFor !== userId) return;
  }
  const snap = getSnapshot();
  const account = server?.onboarding ? setupFrom(server.onboarding) : null;
  /**
   * The class on the SERVER wins, always. A switch made on the phone must
   * reset this browser too, or one subscription quietly serves two classes.
   */
  const serverGrade = gradeChoice(server?.onboarding);
  const localGrade = snap.onboarding?.classLevel ?? 9;
  // And the board: the database serves whichever board the account chose, so
  // a choice made on the phone has to reach this browser too.
  const serverBoard = boardChoice(server?.onboarding);
  const localBoard = snap.onboarding?.board ?? 'fbise';
  if ((serverGrade && serverGrade !== localGrade) || (serverBoard && serverBoard !== localBoard)) {
    /*
     * Built from the account's record, not from defaults. It used to keep
     * only the class and board, so a Class 10 or Punjab student opening a new
     * browser lost their subjects and was put back on English.
     */
    const onboarding = composeSetup({ medium: snap.settings.language }, snap.onboarding, account, {
      classLevel: serverGrade ?? localGrade,
      board: serverBoard ?? snap.onboarding?.board,
    });
    setContentGrade(onboarding.classLevel);
    setContentBoard(onboarding.board ?? 'fbise');
    // Anything still queued here belongs to the syllabus the account left.
    dropQueue(userId);
    activeDaySynced = null;
    const history = server;
    update((s) => {
      const fresh: State = {
        ...EMPTY,
        ownerId: s.ownerId,
        user: s.user,
        premium: s.premium,
        hydrated: true,
        onboarding,
        settings: withMedium(history?.accountPrefs ? { ...s.settings, ...history.accountPrefs } : s.settings, onboarding.medium),
      };
      // The account's history on the new syllabus comes with it, rather than
      // waiting for the next load to appear.
      if (!history) return fresh;
      const merged = mergeHydratedState(fresh, history, getQueue());
      return { ...merged, xp: hydratedXp(merged, history, getQueue()) };
    });
    return;
  }
  if (!server) return;
  const history = server;
  update((s) => {
    // The queue rides along, so a tick or a card this browser has not sent
    // yet is neither lost to the server's older copy nor counted twice.
    const pending = getQueue();
    const merged = mergeHydratedState(s, history, pending);
    /*
     * Choices made on this browser win; the account's copy is for a browser
     * that has none, which is every new one. Nothing read it before, so a
     * student signing in somewhere new got the default subjects (no Pakistan
     * Studies, no Computer Science) and an English app over their Urdu notes,
     * until they happened to save a choice, which then overwrote the account
     * with those defaults. The same rule as the Android app.
     */
    const adopt = !s.onboarding?.subjects?.length && account;
    const onboarding = adopt ? composeSetup({ medium: s.settings.language }, s.onboarding, account) : s.onboarding;
    // The nudge preferences belong to the account, so the server's copy
    // wins. Null means never set, and this browser's defaults stand.
    const prefs = history.accountPrefs ? { ...s.settings, ...history.accountPrefs } : s.settings;
    const settings = adopt && account?.medium ? withMedium(prefs, account.medium) : prefs;
    return { ...merged, onboarding, settings, xp: hydratedXp(merged, history, pending) };
  });
  // The account has no saved choices but this browser does: an account made
  // before choices synced. Send them up, so the next browser starts from them.
  const onb = getSnapshot().onboarding;
  if (onb?.subjects?.length && !account?.subjects?.length) {
    void saveSetup({ board: onb.board, medium: onb.medium, group: onb.group, subjects: onb.subjects });
  }
}

type AuthUser = { id: string; email?: string; user_metadata?: { name?: string } };

function nameFor(u: AuthUser): string {
  if (profileName?.id === u.id) return profileName.name;
  return u.user_metadata?.name?.trim() || (u.email ?? '').split('@')[0] || 'Student';
}

export function AppProvider({
  children,
  initialLanguage = 'en',
  initialPlan = null,
}: {
  children: React.ReactNode;
  /**
   * What the server rendered with, read from the language cookie by the
   * layout. Without it the server always renders English and an Urdu student
   * watches the page rewrite itself on hydration.
   */
  initialLanguage?: Language;
  /**
   * The plan the layout found. The paywall already decided on it, so inside
   * the app there is almost always one, and starting from it is what keeps a
   * paying student from seeing locks, and a Basic one from seeing the AI
   * tutor, until the browser has asked again.
   */
  initialPlan?: PlanSeed | null;
}) {
  seedFromServer(initialLanguage, initialPlan);
  const seedKey = initialPlan?.active ? `${initialPlan.plan ?? ''}|${initialPlan.trialSubject ?? ''}` : '';
  // Keyed on the seed's contents, not its identity: the layout builds a new
  // object on every render, and the snapshot has to stay the same one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const serverSnapshot = useCallback(() => serverSnapshotFor(initialLanguage, initialPlan), [initialLanguage, seedKey]);
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
   * Reconcile the server's copy of the language with the store.
   *
   * The server dressed the page from a cookie, and the cookie can be behind:
   * an account that chose Urdu on another device, or before this cookie
   * existed at all. The store's own wrapper already shows the right direction;
   * writing the cookie back makes the next cold load right from the first
   * byte, and re-fetching the server tree now brings its text and notes into
   * line instead of leaving them in the other language until a reload. Here,
   * once, rather than in every component that reads a string.
   */
  const lang = state.settings.language;
  useEffect(() => {
    const cookie = readLanguageCookie();
    if (cookie === lang) return;
    writeLanguageCookie(lang);
    // No cookie means the server rendered English, so English needs no redo.
    if ((cookie ?? 'en') !== lang) window.dispatchEvent(new CustomEvent('mm:language'));
  }, [lang]);

  /**
   * Identity comes from Supabase, not from localStorage.
   *
   * proxy.ts already refuses protected routes server-side, so this is not the
   * access control; it is how the UI learns the student's name and keeps in
   * step when a session is refreshed, or ends in another tab.
   */
  useEffect(() => {
    const supabase = createClient();

    const apply = (u: AuthUser | null) => {
      const s = getSnapshot();
      // Whose AI count the shared quota is. A different account clears it,
      // so nobody starts the day on the last student's fifty.
      setQuotaUser(u?.id ?? null);
      /*
       * Signed out, by whatever route: the action below, an expired session,
       * or another tab. This account's data leaves the machine either way.
       * It used to null the user and leave the class, the subjects, every
       * attempt and the streak behind, and since the hydrate merges rather
       * than replaces and prefers local onboarding, the next account to sign
       * in here inherited all of it. On a shared computer that is one
       * student reading another's marks.
       */
      if (!u) {
        if (s.user || s.ownerId) {
          clearQuota();
          // The chapter index was this account's syllabus.
          clearContentCache();
          update((cur) => ({ ...EMPTY, hydrated: true, settings: devicePrefs(cur.settings) }));
        }
        return;
      }

      const user = { id: u.id, name: nameFor(u), contact: u.email ?? '' };

      /*
       * A different student in the same browser. Checked before anything
       * else, so it also catches the tab being closed mid-sign-out and
       * signing in as somebody else directly.
       */
      if (s.ownerId && s.ownerId !== user.id) {
        clearQuota();
        // Loaded again under the new session by syncStudyState.
        clearContentCache();
        update((cur) => ({ ...EMPTY, hydrated: true, ownerId: user.id, user, settings: devicePrefs(cur.settings) }));
        return;
      }

      /*
       * Note what does NOT happen here: signing in is not studying. This
       * used to mark today active, which inflated the streak and, because
       * it did not queue the matching write, burned the "is this a new day"
       * flag before any real study action could claim it. That is why
       * active_days sat empty while attempts landed normally, and why every
       * streak in the product read zero.
       */
      if (s.ownerId === user.id && s.user?.id === user.id && s.user.name === user.name && s.user.contact === user.contact) return;
      update((cur) => ({ ...cur, ownerId: user.id, user }));
    };

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
        pulledFor = null;
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

  /**
   * The home screen, live.
   *
   * Same reasoning as the Android side: streak, today's plan and the week
   * chips all read from synced rows, so the two apps agreed eventually but not
   * promptly. A question answered on the phone did not move this page's streak
   * until a reload. The broadcast (migration 0016) carries only which table
   * moved, never a row, so the re-read happens through the student's own
   * session. Debounced, because a ten question set writes ten rows.
   *
   * Here, once, and not in every screen that reads a string. realtime-js hands
   * every subscriber of a topic the same channel, so when this lived in the
   * translation hook the first screen to unmount removed it for all of them,
   * the shell included, and live updates stopped without a word.
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
          /*
           * With the queue, plan ticks and known cards follow the server plus
           * what this browser has not sent yet, so a tick taken back on the
           * phone comes off here too, and one made here a second ago stays.
           */
          const pending = getQueue();
          const merged = mergeHydratedState(s, server, pending);
          return {
            ...merged,
            // A switch turned off on the phone must turn off here, and a
            // merge would never let it.
            settings: server.accountPrefs ? { ...s.settings, ...server.accountPrefs } : s.settings,
            xp: hydratedXp(merged, server, pending),
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

  /*
   * Keep the content layer on the student's syllabus: their class, their
   * board and their medium.
   *
   * Set while rendering, not in an effect: the chapter lookups these steer are
   * module reads, and an effect lands after the screens below have already
   * read the old syllabus, with nothing to make them read again. That would
   * leave a Punjab student looking at FBISE's chapters, and a language switch
   * fetching in the old medium. Here, before `derived` below, because the plan
   * reads chapters too: set any later and the first plan after a class or
   * board change was built from the previous syllabus.
   */
  setContentGrade(state.onboarding?.classLevel ?? 9);
  setContentBoard(state.onboarding?.board ?? 'fbise');
  setContentMedium(lang);

  /*
   * The chapter index moves on its own: loaded after sign-in, again after a
   * switch or a language change. Nothing in the store changes when it lands,
   * so the plan below also answers to this, or it stays built from whatever
   * the index held on the first render: 0/0 for a Punjab student, whose
   * chapters were not there yet.
   */
  const contentReady = useSyncExternalStore(subscribeContent, contentVersion, contentVersion);

  const derived = useMemo(() => {
    const access = accessOf(state.premium);
    const aiLimit = access.aiLimit;
    const usedToday = state.ai.day === todayKey() ? state.ai.used : 0;
    const chosen = state.onboarding?.subjects?.length
      ? state.onboarding.subjects
      : ['phy', 'chem', 'bio', 'math', 'eng', 'urd', 'isl'];
    /*
     * On a trial the one subject it opens is the student's whole syllabus for
     * three days: today's plan, the practice pickers and the tutor's starters
     * all build from this list, and none of them should point at a subject
     * the database will refuse. The rest are kept to show as locked.
     */
    const subjects = access.tier === 'trial' && access.trialSubject ? [access.trialSubject] : chosen;
    const lockedSubjects = access.tier === 'trial' ? chosen.filter((s) => s !== access.trialSubject) : [];
    return {
      streak: streakFrom(state.activeDays),
      level: level(state.xp),
      aiLeft: Math.max(0, aiLimit - usedToday),
      aiLimit,
      access,
      subjects,
      lockedSubjects,
      plan: buildPlan({
        subjectIds: subjects,
        // The student's own class, so the plan can never point at the other
        // one's syllabus. See planChapterId.
        grade: state.onboarding?.classLevel ?? 9,
        board: state.onboarding?.board ?? 'fbise',
        lastChapterId: state.lastChapterId,
        attempts: state.attempts,
        doneIds: state.planDone,
        // Real work counts as completion, and all three of these sync, so the
        // plan reads the same on every device without storing anything extra.
        readSections: state.readSections,
        cardsKnown: state.cardsKnown,
      }),
      contentReady,
    };
  }, [state, contentReady]);

  const synced = pulledFor !== null && pulledFor === state.user?.id;
  const value = useMemo(() => ({ state, hydrated: state.hydrated, synced, actions, derived }), [state, synced, derived]);

  /*
   * The direction the store knows about, around everything it renders.
   *
   * The layout's `Localized` wrapper takes its `dir` from the language cookie,
   * on the server, so it only changes when the server tree is fetched again.
   * The shell's sidebar sits in a flex row under it, and flex rows follow the
   * nearest `dir`, so a switch to Urdu left the sidebar on the left until that
   * round trip landed, and for a student it read as needing a reload. This one
   * is rendered from the store and flips in the same render as the words.
   * The server snapshot starts from the cookie, so the first paint agrees with
   * `Localized` and hydration has nothing to correct.
   */
  return (
    <AppCtx.Provider value={value}>
      <div lang={lang} dir={lang === 'ur' ? 'rtl' : 'ltr'} className="contents">
        {children}
      </div>
    </AppCtx.Provider>
  );
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
    setLang: (next: Language) => a.setLanguage(next),
  };
}
