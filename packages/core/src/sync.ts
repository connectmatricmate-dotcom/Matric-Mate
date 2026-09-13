/**
 * Study-state sync: attempts, results, read sections, known cards and active
 * days, written through to Postgres from an offline queue.
 *
 * The shape mirrors store/auth.tsx's entitlement cache, with one inversion.
 * Entitlement is a *read* cache: last known value in storage, server refreshes
 * it, a bad connection falls back to what was cached. Study-state writes go
 * the other way, so this is a *write* queue: an action happens, it is applied
 * to local state immediately (never blocked on the network), and a matching
 * op is appended here to be sent when a connection exists. Both exist so a
 * flaky connection never costs a student either their plan or their answers.
 *
 * This file owns the data shape and the pure queue/merge logic only. Storage
 * (AsyncStorage vs localStorage) and the triggers that call flushQueue (app
 * foreground, browser online event, right after enqueuing) are per-app,
 * because those APIs differ and core has no dependency on either.
 */
import { Attempt, Confidence, Notification, TestResult, parseNotificationTarget } from './types';
import { XP, todayKey, totalXp, xpForAttempt } from './domain';

/**
 * The slice of a Supabase client this file needs to write with.
 *
 * Loosely typed for the same reason ContentClient in db.ts is: the real
 * PostgREST builder is a deeply generic chain from a package core does not
 * depend on, and reproducing its type here would be a lie that goes stale on
 * the next @supabase/supabase-js release. Both apps' real clients already
 * satisfy this structurally (see connectContent in db.ts for the read side).
 */
export type SyncClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  /** Optional so a bare mock still fits; every real client has it. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc?(fn: string, args?: Record<string, unknown>): any;
};

/* ------------------------------------------------------------------ ops */

/**
 * One write a screen made that has not been confirmed by Postgres yet.
 *
 * Each carries its own `id`, assigned on the device before the write is ever
 * sent. That is what makes a retried insert safe to send twice: applySyncOp
 * upserts on this id with ignoreDuplicates, so a request whose response was
 * lost to a dropped connection can be resent without creating a second row.
 */
export type SyncOp =
  | { id: string; kind: 'attempt'; attempt: Attempt }
  | { id: string; kind: 'result'; result: TestResult }
  | { id: string; kind: 'read_section'; sectionId: string; chapterId: string; sectionIndex: number; at: number }
  | { id: string; kind: 'card_known'; cardId: string; at: number }
  | { id: string; kind: 'card_unknown'; cardId: string }
  | { id: string; kind: 'active_day'; day: string }
  | { id: string; kind: 'plan_task'; taskId: string; day: string; done: boolean };

/**
 * A row id assigned on the device, before the write ever reaches Postgres.
 *
 * Not from a platform crypto API on purpose: core has no dependency on one,
 * and `crypto.randomUUID` is not reliably present across Hermes versions. This
 * id has exactly one job, letting a retried write recognise its own earlier
 * attempt, so Math.random is short of cryptographic is fine: nothing security
 * sensitive keys off it.
 */
function randomSyncId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The id for a new attempt or result: minted once, kept on the device, and
 * used as the row's own id in Postgres.
 *
 * The apps used to name an answer `a-<time>` locally while the queue sent it
 * under a fresh uuid, so the next hydrate found two rows that did not share an
 * id and kept both. Every synced answer came back twice: twice in the history,
 * twice the XP, a weak topic after two real answers instead of three. One id
 * for both places ends that; mergeHydratedState repairs devices that already
 * hold the pairs.
 *
 * The platform's own uuid where there is one, which Postgres wants for these
 * columns; the Math.random one otherwise (see randomSyncId).
 */
export function newRowId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  try {
    const id = c?.randomUUID?.();
    if (id && UUID.test(id)) return id;
  } catch {
    /* fall through to the portable one */
  }
  return randomSyncId();
}

/*
 * An answer minted by newRowId keeps its id all the way to Postgres. One from
 * an older build (`a-<time>`), or already sitting in a queue, is not a uuid and
 * cannot be a row id, so it goes under the op's own id as before.
 */
export const syncAttempt = (attempt: Attempt): SyncOp => ({
  id: UUID.test(attempt.id) ? attempt.id : randomSyncId(),
  kind: 'attempt',
  attempt,
});
export const syncResult = (result: TestResult): SyncOp => ({
  id: UUID.test(result.id) ? result.id : randomSyncId(),
  kind: 'result',
  result,
});
export const syncReadSection = (sectionId: string, chapterId: string, sectionIndex: number): SyncOp => ({
  id: randomSyncId(),
  kind: 'read_section',
  sectionId,
  chapterId,
  sectionIndex,
  at: Date.now(),
});
export const syncCardKnown = (cardId: string): SyncOp => ({ id: randomSyncId(), kind: 'card_known', cardId, at: Date.now() });
export const syncCardUnknown = (cardId: string): SyncOp => ({ id: randomSyncId(), kind: 'card_unknown', cardId });
export const syncActiveDay = (day: string): SyncOp => ({ id: randomSyncId(), kind: 'active_day', day });
/**
 * A ticked or unticked task on today's plan.
 *
 * The plan_done table has existed since the first migration and nothing ever
 * wrote to it, so ticks lived only on the device that made them: three tasks
 * ticked on a phone were three empty boxes on the laptop, for the same student
 * on the same day.
 */
export const syncPlanTask = (taskId: string, day: string, done: boolean): SyncOp => ({
  id: randomSyncId(),
  kind: 'plan_task',
  taskId,
  day,
  done,
});

/** The natural key a duplicate op would share. Used to dedupe the queue, not the row. */
function opKey(op: SyncOp): string {
  switch (op.kind) {
    case 'attempt':
      return `attempt:${op.attempt.id}`;
    case 'result':
      return `result:${op.result.id}`;
    case 'read_section':
      return `read_section:${op.sectionId}`;
    case 'card_known':
      return `card_known:${op.cardId}`;
    case 'card_unknown':
      return `card_unknown:${op.cardId}`;
    case 'active_day':
      return `active_day:${op.day}`;
    // Keyed without `done`, so ticking and unticking the same task collapses
    // to the latest intent instead of queueing a contradictory pair.
    case 'plan_task':
      return `plan_task:${op.taskId}`;
  }
}

const QUEUE_CAP = 500;

/**
 * Appends an op to the queue, in place of a duplicate rather than beside it.
 *
 * A student re-opening a section they already marked read, or crossing into a
 * new day on two answers in a row, would otherwise queue the same fact twice.
 * Harmless once it lands (every write below is an idempotent upsert) but
 * pointless to store and send twice, so the newer copy replaces the older one
 * under the same key. attempt/result keys carry their own generated id, so two
 * genuinely different answers never collide here.
 */
export function enqueueOp(queue: SyncOp[], op: SyncOp, cap = QUEUE_CAP): SyncOp[] {
  const key = opKey(op);
  const next = [...queue.filter((q) => opKey(q) !== key), op];
  // A guard, not an expectation: this only bites after roughly a week of
  // continuous offline use at normal answering speed. Oldest first, because
  // the newest activity is what a student who just came back online is
  // waiting to see land, the same trade CAP makes on the synced state itself
  // (see persisted-store.ts).
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/* -------------------------------------------------------------- applying */

export type SyncOutcome = 'ok' | 'retry' | 'drop';

/**
 * core has no @types/node and runs in a browser, in Hermes and in Node.
 * Mirrors the same helper in db.ts; not shared across the two because neither
 * is worth a third file over three lines.
 */
const isDev = (): boolean =>
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production';

type WriteResult = { error: unknown; status: number };

async function write(client: SyncClient, table: string, row: Record<string, unknown>, onConflict: string): Promise<WriteResult> {
  const { error, status } = await client.from(table).upsert(row, { onConflict, ignoreDuplicates: true });
  return { error, status };
}

async function remove(client: SyncClient, table: string, match: Record<string, string>): Promise<WriteResult> {
  let q = client.from(table).delete();
  for (const [col, val] of Object.entries(match)) q = q.eq(col, val);
  const { error, status } = await q;
  return { error, status };
}

/**
 * postgrest-js does not reject its promise for a network failure (offline,
 * DNS, a dropped connection): it resolves with `status: 0` and an error
 * object built from the fetch failure, specifically so a caller does not have
 * to wrap every query in try/catch. That makes `status` the retry signal, not
 * whether this function throws.
 *
 * Some answers are the server saying "not now" rather than "no": an expired
 * token (401), a timeout (408), a rate limit (429), and anything 500 or above,
 * which is what the database gateway returns while it is overloaded. Those
 * used to be dropped with the rest, so a bad minute on the server permanently
 * lost whatever was queued in it. They are retried now. Everything else means
 * Postgres answered and will answer the same way again (an RLS denial, a bad
 * column, a constraint that will never pass), so it is dropped and logged
 * instead of jamming every op queued behind it.
 */
function classify(error: unknown, status: number): SyncOutcome {
  if (!error) return 'ok';
  if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return 'retry';
  if (isDev()) console.warn('[sync] write rejected, dropping from queue:', error);
  return 'drop';
}

/**
 * Sends one queued op. Wrapped in try/catch as a last resort, not the primary
 * signal (see classify): postgrest-js is expected to resolve rather than
 * throw even when offline, but nothing here should be able to take the whole
 * flush down if a future version, or a client mock in a test, throws anyway.
 */
export async function applySyncOp(client: SyncClient, userId: string, op: SyncOp): Promise<SyncOutcome> {
  try {
    let result: WriteResult;
    switch (op.kind) {
      case 'attempt': {
        const a = op.attempt;
        result = await write(
          client,
          'attempts',
          {
            // The answer's own id when it has one Postgres can take; see newRowId.
            id: UUID.test(a.id) ? a.id : op.id,
            user_id: userId,
            mcq_id: a.mcqId,
            chapter_id: a.chapterId,
            subject_id: a.subjectId,
            topic: a.topic,
            correct: a.correct,
            confidence: a.confidence,
            mode: a.mode,
            at: new Date(a.at).toISOString(),
          },
          'id',
        );
        break;
      }
      case 'result': {
        const r = op.result;
        result = await write(
          client,
          'results',
          {
            id: UUID.test(r.id) ? r.id : op.id,
            user_id: userId,
            subject_id: r.subjectId,
            chapter_id: r.chapterId,
            label: r.label,
            score: r.score,
            total: r.total,
            xp: r.xp,
            mode: r.mode,
            at: new Date(r.at).toISOString(),
          },
          'id',
        );
        break;
      }
      case 'read_section': {
        result = await write(
          client,
          'read_sections',
          {
            user_id: userId,
            section_id: op.sectionId,
            chapter_id: op.chapterId,
            section_index: op.sectionIndex,
            at: new Date(op.at).toISOString(),
          },
          'user_id,section_id',
        );
        break;
      }
      case 'card_known': {
        result = await write(
          client,
          'cards_known',
          { user_id: userId, card_id: op.cardId, at: new Date(op.at).toISOString() },
          'user_id,card_id',
        );
        break;
      }
      case 'card_unknown': {
        result = await remove(client, 'cards_known', { user_id: userId, card_id: op.cardId });
        break;
      }
      case 'active_day': {
        result = await write(client, 'active_days', { user_id: userId, day: op.day }, 'user_id,day');
        break;
      }
      case 'plan_task': {
        result = op.done
          ? await write(client, 'plan_done', { user_id: userId, task_id: op.taskId, day: op.day }, 'user_id,task_id,day')
          : await remove(client, 'plan_done', { user_id: userId, task_id: op.taskId, day: op.day });
        break;
      }
    }
    return classify(result.error, result.status);
  } catch {
    return 'retry';
  }
}

export type FlushResult = {
  remaining: SyncOp[];
  flushed: number;
  dropped: number;
  /**
   * Ids of the ops that have left the queue, sent or dropped. Remove exactly
   * these from the app's queue rather than replacing it with `remaining`: an
   * op queued while this flush was in flight is in neither list, and
   * replacing the queue with `remaining` quietly lost it.
   */
  settled: string[];
  /** True when clearSyncQueue ran while this flush was sending. Keep nothing it returns. */
  cancelled: boolean;
};

/**
 * Moves whenever the queue is thrown away, so a flush already in flight stops
 * rather than sending the rest of a queue that no longer exists.
 */
let queueEpoch = 0;

/**
 * Throw the queue away: on sign-out, and on a class or board switch, alongside
 * wipeStudyHistory. Returns the empty queue for the app to store in place of
 * its own, and stops a flush that is already sending after the write it is on.
 *
 * Without this, a switch reset the student's state and kept the queue, so
 * Class 9 answers still waiting to send were written after the wipe and came
 * back in Class 10, and a signed-out student's answers were sent under the
 * next account to sign in. Send what can be sent first (flushQueue, with a
 * short wait) when losing it would matter, as on sign-out.
 */
export function clearSyncQueue(): SyncOp[] {
  queueEpoch += 1;
  return [];
}

/**
 * Sends queued ops in order and stops at the first one that must be retried,
 * rather than skipping over it. Two reasons: it keeps ops for the same row
 * (a section read, then re-read with a later index) applying in the order
 * they happened, and it means a genuinely offline device fails fast on op one
 * instead of paying the timeout cost of trying all five hundred.
 */
export async function flushQueue(client: SyncClient, userId: string, queue: SyncOp[]): Promise<FlushResult> {
  const started = queueEpoch;
  const remaining: SyncOp[] = [];
  const settled: string[] = [];
  let flushed = 0;
  let dropped = 0;
  let blocked = false;
  for (const op of queue) {
    if (queueEpoch !== started) return { remaining: [], flushed, dropped, settled, cancelled: true };
    if (blocked) {
      remaining.push(op);
      continue;
    }
    const outcome = await applySyncOp(client, userId, op);
    if (outcome === 'ok') flushed++;
    else if (outcome === 'drop') dropped++;
    else {
      blocked = true;
      remaining.push(op);
      continue;
    }
    settled.push(op.id);
  }
  if (queueEpoch !== started) return { remaining: [], flushed, dropped, settled, cancelled: true };
  return { remaining, flushed, dropped, settled, cancelled: false };
}

/* ------------------------------------------------------------- hydrating */

type AttemptRow = {
  id: string;
  mcq_id: string;
  chapter_id: string;
  subject_id: string;
  topic: string;
  correct: boolean;
  confidence: number | null;
  mode: string;
  at: string;
};

type ResultRow = {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  label: string;
  score: number;
  total: number;
  xp: number;
  mode: string;
  at: string;
};

const fromAttemptRow = (r: AttemptRow): Attempt => ({
  id: r.id,
  mcqId: r.mcq_id,
  chapterId: r.chapter_id,
  subjectId: r.subject_id,
  topic: r.topic,
  correct: r.correct,
  confidence: (r.confidence as Confidence | null) ?? null,
  mode: r.mode as Attempt['mode'],
  at: Date.parse(r.at),
});

const fromResultRow = (r: ResultRow): TestResult => ({
  id: r.id,
  subjectId: r.subject_id,
  chapterId: r.chapter_id,
  label: r.label,
  score: r.score,
  total: r.total,
  xp: r.xp,
  mode: r.mode as TestResult['mode'],
  at: Date.parse(r.at),
  // Never stored server-side (the results table has no column for it, and no
  // screen has ever read a real value out of it, see ResultScreen). Kept as an
  // empty array purely so the type matches what a freshly recorded result has.
  attemptIds: [],
});

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  target: string | null;
  read: boolean;
  at: string;
};

/** The column is free text; only the destinations both apps can route to survive. */
const fromNotificationRow = (r: NotificationRow): Notification => ({
  id: r.id,
  kind: r.kind as Notification['kind'],
  title: r.title,
  body: r.body ?? '',
  at: Date.parse(r.at),
  ...parseNotificationTarget(r.target),
  read: r.read,
});

export type HydratedStudyState = {
  /**
   * The student's saved class/board/subjects choices, opaque to core. The app
   * owns the shape; this layer only ferries it, which is also why it is not
   * merged by mergeHydratedState below.
   */
  onboarding: Record<string, unknown> | null;
  /** The account's class from profiles.grade, the anti-sharing source of truth. */
  grade: number | null;
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  cardsKnown: string[];
  activeDays: string[];
  /** Task ids ticked on today's plan, from any device. */
  planDone: string[];
  /**
   * The student's inbox.
   *
   * Both apps have always had a notifications screen, and the payment webhook
   * has always written rows into the table it reads from. Nothing ever
   * connected the two: the stores initialised `notifications` to an empty
   * array and no code path ever filled it, so five real payment receipts sat
   * in the database while both inboxes told the student they had nothing.
   */
  notifications: Notification[];
  /** Null when the student has never touched them, meaning "use the defaults". */
  accountPrefs: AccountPrefs | null;
  lastChapterId?: string;
  lastSectionIndex: number;
  /**
   * The account's whole XP as the server sums it (study_xp, migration 0039),
   * or null when it could not say. See hydratedXp for how to use it.
   */
  xp?: number | null;
};

/**
 * The settings that belong to the account rather than to one device.
 *
 * Text size and which avatar are properties of the screen you are looking at.
 * These are properties of the person: when they want to be nudged, and whether
 * they read in the dark. They lived in device storage only, which had two
 * visible consequences. The same student saw the reminder switches on in the
 * website and off in the phone, and nothing anywhere ever read either one.
 *
 * `dark` is here for the first reason rather than the second: nothing on the
 * server cares about it, but a student who turns the lights off on their phone
 * should not have to do it again on the laptop.
 */
/**
 * The evening slots a student may pick for their reminder.
 *
 * Evening only, and deliberately few. A reminder at 3am helps nobody, and a
 * free-form clock invites a choice the delivery side cannot honour: the job
 * that sends these runs on the hour, so every option here has to be one of the
 * hours it runs at. See the cron in apps/web/vercel.json.
 *
 * Stored as the label rather than a number because it is also what the
 * settings row displays, and one representation cannot drift from the other.
 */
export const REMINDER_TIMES = ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'] as const;

export const DEFAULT_REMINDER_TIME = '7:00 PM';

/**
 * The hour, 0 to 23, that a stored reminder time means in Karachi.
 *
 * Falls back to the default rather than throwing: a value written by an older
 * build, or by hand, should send at a sensible hour instead of never sending.
 */
export function reminderHour(value: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((value ?? '').trim());
  if (!m) return 19;
  const raw = Number(m[1]) % 12;
  return m[3].toUpperCase() === 'PM' ? raw + 12 : raw;
}

export type AccountPrefs = {
  reminders: boolean;
  streakAlerts: boolean;
  reminderTime: string;
  dark: boolean;
  /**
   * Which channels may carry a notification, as opposed to which notifications
   * exist. `reminders` and `streakAlerts` above answer "should we tell them";
   * these answer "how". Kept apart because a student who wants a streak nudge
   * on their phone but not in their email has said two different things, and
   * one switch cannot hold both.
   *
   * The in-app inbox is deliberately absent: it is free, it is the record
   * inside the app, and there is nothing to opt out of.
   */
  channelPush: boolean;
  channelEmail: boolean;
};

const readAccountPrefs = (settings: unknown): AccountPrefs | null => {
  if (!settings || typeof settings !== 'object') return null;
  const s = settings as Record<string, unknown>;
  // Nothing stored yet reads as "never set", not as "all off".
  const known = ['reminders', 'streakAlerts', 'dark', 'channelPush', 'channelEmail'].some(
    (k) => typeof s[k] === 'boolean',
  );
  if (!known) return null;
  return {
    reminders: s.reminders !== false,
    streakAlerts: s.streakAlerts !== false,
    reminderTime: typeof s.reminderTime === 'string' ? s.reminderTime : '7:00 PM',
    dark: s.dark === true,
    // Both on unless turned off. Same defaults the server applies in
    // notify/index.ts.
    channelPush: s.channelPush !== false,
    channelEmail: s.channelEmail !== false,
  };
};

/**
 * Write the nudge preferences to the account.
 *
 * Merged into the existing jsonb rather than replacing it, so a future setting
 * stored alongside them is not wiped by someone flipping a switch. Silent on
 * failure: a preference that did not reach the server is retried the next time
 * it is touched, and is not worth interrupting anyone over.
 */
export async function syncAccountPrefs(client: SyncClient, userId: string, prefs: AccountPrefs): Promise<void> {
  try {
    const { data } = await client.from('profiles').select('settings').eq('id', userId).maybeSingle();
    const current = ((data as { settings?: Record<string, unknown> | null } | null)?.settings ?? {}) as Record<string, unknown>;
    await client.from('profiles').update({ settings: { ...current, ...prefs } }).eq('id', userId);
  } catch {
    /* Deliberately silent, see above. */
  }
}

/** How long a hydration attempt is allowed to hang before giving up on it. */
const HYDRATE_TIMEOUT_MS = 8000;

/**
 * Every row of a table that can outgrow a page, not the first thousand.
 *
 * PostgREST answers at most a thousand rows and does not say that it
 * truncated, which is the trap the content audit script was written around and
 * the same one this file had: read_sections and cards_known were read with no
 * limit at all, and a student who finishes a subject can pass a thousand known
 * cards. One request for anyone normal, because a short page ends the loop.
 */
const PAGE = 1000;
const PAGE_LIMIT = 10;

async function pageAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let i = 0; i < PAGE_LIMIT; i += 1) {
    const { data, error } = await page(i * PAGE, (i + 1) * PAGE - 1);
    if (error) return { data: rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return { data: rows, error: null };
}

/**
 * The server's own sum of the account's XP, or null when it cannot say: the
 * function is not there yet, the client has no rpc, or the call failed. Never
 * throws, and never fails the hydrate around it.
 */
async function serverXp(client: SyncClient): Promise<number | null> {
  if (typeof client.rpc !== 'function') return null;
  try {
    const { data, error } = await client.rpc('study_xp');
    return error || data == null || !Number.isFinite(Number(data)) ? null : Number(data);
  } catch {
    return null;
  }
}

async function fetchStudyState(client: SyncClient, userId: string): Promise<HydratedStudyState> {
  const [attemptsRes, resultsRes, sectionsRes, cardsRes, daysRes, planRes, profileRes, notifsRes, xp] = await Promise.all([
    /* Newest first, then capped. It was oldest first, so a student past a
       thousand answers rebuilt their history on a new device from their first
       thousand: months-old work, and the recent months missing entirely. */
    client.from('attempts').select('id,mcq_id,chapter_id,subject_id,topic,correct,confidence,mode,at').eq('user_id', userId).order('at', { ascending: false }).limit(1000),
    client.from('results').select('id,subject_id,chapter_id,label,score,total,xp,mode,at').eq('user_id', userId).order('at', { ascending: false }).limit(100),
    /* A second, unique column after `at`: paging by offset over a column two
       rows can share let a row slip between pages and never be read. */
    pageAll<{ section_id: string; chapter_id: string; section_index: number; at: string }>((from, to) =>
      client.from('read_sections').select('section_id,chapter_id,section_index,at').eq('user_id', userId).order('at', { ascending: false }).order('section_id').range(from, to),
    ),
    pageAll<{ card_id: string }>((from, to) =>
      client.from('cards_known').select('card_id').eq('user_id', userId).order('at', { ascending: false }).order('card_id').range(from, to),
    ),
    /* Newest first: the cap keeps the last 400 days, the ones a streak is
       counted from. Oldest first, a student past 400 days had no recent days
       at all on a new device, and a streak of zero. */
    client.from('active_days').select('day').eq('user_id', userId).order('day', { ascending: false }).limit(400),
    // Today only: yesterday's ticks belong to yesterday's plan, and the task
    // ids carry the date anyway.
    client.from('plan_done').select('task_id').eq('user_id', userId).eq('day', todayKey()),
    client.from('profiles').select('onboarding,grade,settings').eq('id', userId).maybeSingle(),
    // Capped at the same 50 the screens show. An inbox is a recent list, not
    // an archive, and nobody scrolls to a receipt from four months ago.
    client.from('notifications').select('id,kind,title,body,target,read,at').eq('user_id', userId).order('at', { ascending: false }).limit(50),
    serverXp(client),
  ]);

  const error =
    attemptsRes.error ?? resultsRes.error ?? sectionsRes.error ?? cardsRes.error ?? daysRes.error ?? planRes.error ?? profileRes.error ?? notifsRes.error;
  if (error) throw error;

  // Ordered newest first, so the first row is the most recently read section:
  // exactly the reading position a reinstall or a second device needs to pick
  // up from. No separate "last position" table needed for that.
  const sections = sectionsRes.data;
  const last = sections[0];

  return {
    onboarding: ((profileRes.data as { onboarding?: Record<string, unknown> | null } | null)?.onboarding) ?? null,
    grade: ((profileRes.data as { grade?: number | null } | null)?.grade) ?? null,
    attempts: ((attemptsRes.data ?? []) as AttemptRow[]).map(fromAttemptRow),
    results: ((resultsRes.data ?? []) as ResultRow[]).map(fromResultRow),
    readSections: sections.map((s) => s.section_id),
    cardsKnown: ((cardsRes.data ?? []) as { card_id: string }[]).map((c) => c.card_id),
    activeDays: ((daysRes.data ?? []) as { day: string }[]).map((d) => d.day),
    planDone: ((planRes.data ?? []) as { task_id: string }[]).map((r) => r.task_id),
    notifications: ((notifsRes.data ?? []) as NotificationRow[]).map(fromNotificationRow),
    accountPrefs: readAccountPrefs((profileRes.data as { settings?: unknown } | null)?.settings),
    lastChapterId: last?.chapter_id,
    lastSectionIndex: last?.section_index ?? 0,
    xp,
  };
}

/**
 * Pulls a signed-in student's server-side study state, for merging into
 * whatever the device already has. Never throws and never hangs indefinitely:
 * a fresh sign-in on a new device is exactly the moment a stalled request
 * would otherwise leave a student staring at a splash screen, so any failure,
 * including one that just times out, resolves to null and the caller
 * continues on local state alone.
 */
export async function hydrateStudyState(client: SyncClient, userId: string): Promise<HydratedStudyState | null> {
  try {
    return await Promise.race([
      fetchStudyState(client, userId),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), HYDRATE_TIMEOUT_MS)),
    ]);
  } catch (e) {
    if (isDev()) console.warn('[sync] hydrate failed, continuing on local state only:', e);
    return null;
  }
}

/** The slice of either app's State that study-state sync reads and writes. */
export type SyncableState = {
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  cardsKnown: string[];
  activeDays: string[];
  planDone: string[];
  notifications: Notification[];
  lastChapterId?: string;
  lastSectionIndex: number;
};

/**
 * Folds server rows into whatever the device already has, rather than
 * replacing it. On a fresh install or a second device, local is empty, so
 * this is effectively "adopt the server's answer", which is the point of
 * requirement 2. On a device that already has local state, this is a
 * cross-device merge: a union of both, so a queued-but-not-yet-flushed local
 * write is never erased by a hydration that ran before it landed.
 */
export function mergeHydratedState<S extends SyncableState>(
  local: S,
  server: HydratedStudyState,
  /**
   * The ops this device has queued and not yet sent. Pass it, and known cards
   * and plan ticks follow the server except where this device has something
   * still on its way; leave it out and both stay a plain union, as before.
   */
  pending?: SyncOp[],
): S {
  const byId = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const seen = new Set(a.map((x) => x.id));
    return [...a, ...b.filter((x) => !seen.has(x.id))];
  };
  /*
   * The same answer under two ids, one local and one the server's, is one
   * answer. Before newRowId every synced attempt and result came back like
   * that, so this also repairs devices already holding the pairs: the first
   * (local) copy is kept.
   */
  const once = <T>(list: T[], key: (x: T) => string): T[] => {
    const seen = new Set<string>();
    return list.filter((x) => {
      const k = key(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const union = (a: string[], b: string[]): string[] => Array.from(new Set([...a, ...b]));

  /*
   * Undoable sets. A card marked unknown, or a tick taken back, on any device
   * must stay undone here, and a union brought it back from whichever copy
   * still had it: the card was known again forever and its XP counted back
   * in. So the server's set, plus what this device has added and not sent,
   * minus what it has taken away and not sent.
   */
  const followServer = (serverSet: string[], added: string[], removed: string[]): string[] => {
    const out = new Set([...serverSet, ...added]);
    removed.forEach((id) => out.delete(id));
    return Array.from(out);
  };
  const cardsKnown = pending
    ? followServer(
        server.cardsKnown,
        pending.flatMap((op) => (op.kind === 'card_known' ? [op.cardId] : [])),
        pending.flatMap((op) => (op.kind === 'card_unknown' ? [op.cardId] : [])),
      )
    : union(local.cardsKnown, server.cardsKnown);
  const planDone = pending
    ? followServer(
        server.planDone,
        pending.flatMap((op) => (op.kind === 'plan_task' && op.done ? [op.taskId] : [])),
        pending.flatMap((op) => (op.kind === 'plan_task' && !op.done ? [op.taskId] : [])),
      )
    : // A union, like the rest: ticking on the phone and on the laptop should
      // add up rather than one device's view erasing the other's.
      union(local.planDone, server.planDone);

  return {
    ...local,
    readSections: union(local.readSections, server.readSections),
    attempts: once(byId(local.attempts, server.attempts), (a) => `${a.mcqId}|${a.at}|${a.mode}`).sort((a, b) => a.at - b.at),
    results: once(
      byId(local.results, server.results),
      (r) => `${r.subjectId}|${r.chapterId ?? ''}|${r.mode}|${r.at}|${r.score}|${r.total}`,
    ).sort((a, b) => b.at - a.at),
    cardsKnown,
    activeDays: union(local.activeDays, server.activeDays),
    planDone,
    // The server is the only writer of notifications, so this is a straight
    // adopt rather than a union: nothing on the device can be newer. Newest
    // first, matching the order both inboxes render in.
    notifications: byId(server.notifications, local.notifications).sort((a, b) => b.at - a.at),
    // Local wins whenever it already has a reading position: either this
    // device is mid-session and knows something the last sync does not, or
    // nothing has been read here yet, in which case the server's last
    // position is exactly what a reinstalled or second device needs.
    lastChapterId: local.lastChapterId ?? server.lastChapterId,
    lastSectionIndex: local.lastChapterId ? local.lastSectionIndex : server.lastSectionIndex,
  };
}

/**
 * The XP to show after a hydrate.
 *
 * Recomputing from history (totalXp) only sees the history this device holds,
 * and both the hydrate read and the device's own store stop at a thousand
 * answers, so past that a student's XP stalled, then fell as old answers
 * rolled out of the window. The server can sum all of it. Its sum, plus the
 * answers and cards this device has queued and not yet sent, is the whole
 * total. Where the server could not say (the function not deployed yet, a
 * failed call), this falls back to recomputing from the merged history.
 */
export function hydratedXp(
  merged: Pick<SyncableState, 'attempts' | 'cardsKnown'>,
  server: HydratedStudyState,
  pending: SyncOp[] = [],
): number {
  if (server.xp == null) return totalXp(merged.attempts, merged.cardsKnown);
  const serverCards = new Set(server.cardsKnown);
  // A write whose reply was lost is still queued but already summed.
  const serverRows = new Set(server.attempts.map((a) => a.id));
  let xp = server.xp;
  for (const op of pending) {
    if (op.kind === 'attempt') {
      if (!serverRows.has(UUID.test(op.attempt.id) ? op.attempt.id : op.id)) xp += xpForAttempt(op.attempt);
    }
    else if (op.kind === 'card_known' && !serverCards.has(op.cardId)) xp += XP.card;
    else if (op.kind === 'card_unknown' && serverCards.has(op.cardId)) xp -= XP.card;
  }
  return Math.max(0, xp);
}


/**
 * Mark every unread notification read, on the server as well as on screen.
 *
 * Both apps flipped `read` in local state only, so opening the inbox cleared
 * it until the next hydration brought all of them back unread. Not queued
 * through the offline queue on purpose: if this write is lost the worst case
 * is a badge that reappears, which is a great deal cheaper than a lost answer.
 */
export async function markNotificationsRead(client: SyncClient, userId: string): Promise<void> {
  try {
    await client.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  } catch {
    /* Deliberately silent: a stale badge is not worth an error message. */
  }
}

/* ------------------------------------------------------------ hard reset */

/**
 * Delete this student's entire study history from the server.
 *
 * "Reset app data" used to clear device storage only, which was coherent when
 * nothing synced. Now that progress is on the server, a local clear is undone
 * by the next hydration: the student presses reset, sees zero, reopens the app
 * and their old history is back. A button that appears to do nothing is worse
 * than no button.
 *
 * Attempts and results are append-only everywhere else in this file, and that
 * rule holds for the app. It was never a promise to the student. This is their
 * own data, RLS scopes every one of these tables to them, and a person asking
 * to start over is entitled to actually start over.
 *
 * This is NOT account deletion. The account, the subscription and the payment
 * history all survive, because a content reset is not a refund. Removing the
 * account is a separate flow at /delete-account, which Play requires.
 *
 * Returns false if any table failed, so the caller can keep the local state
 * rather than show a success it cannot back up.
 */
export async function wipeStudyHistory(client: SyncClient, userId: string): Promise<boolean> {
  const tables = ['attempts', 'results', 'read_sections', 'cards_known', 'active_days', 'plan_done'];
  let ok = true;
  for (const t of tables) {
    try {
      const { error } = await client.from(t).delete().eq('user_id', userId);
      if (error) ok = false;
    } catch {
      ok = false;
    }
  }
  return ok;
}
