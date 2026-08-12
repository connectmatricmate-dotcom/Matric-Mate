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
import { Attempt, Confidence, TestResult } from './types';

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
  | { id: string; kind: 'active_day'; day: string };

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

export const syncAttempt = (attempt: Attempt): SyncOp => ({ id: randomSyncId(), kind: 'attempt', attempt });
export const syncResult = (result: TestResult): SyncOp => ({ id: randomSyncId(), kind: 'result', result });
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
 * whether this function throws. Any other status means the request reached
 * Postgres and Postgres answered, an RLS denial, a bad column, a constraint
 * that will never pass, and that answer will not change on retry, so it is
 * dropped and logged instead of jamming every op queued behind it.
 */
function classify(error: unknown, status: number): SyncOutcome {
  if (!error) return 'ok';
  if (status === 0) return 'retry';
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
            id: op.id,
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
            id: op.id,
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
    }
    return classify(result.error, result.status);
  } catch {
    return 'retry';
  }
}

export type FlushResult = { remaining: SyncOp[]; flushed: number; dropped: number };

/**
 * Sends queued ops in order and stops at the first one that must be retried,
 * rather than skipping over it. Two reasons: it keeps ops for the same row
 * (a section read, then re-read with a later index) applying in the order
 * they happened, and it means a genuinely offline device fails fast on op one
 * instead of paying the timeout cost of trying all five hundred.
 */
export async function flushQueue(client: SyncClient, userId: string, queue: SyncOp[]): Promise<FlushResult> {
  const remaining: SyncOp[] = [];
  let flushed = 0;
  let dropped = 0;
  let blocked = false;
  for (const op of queue) {
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
    }
  }
  return { remaining, flushed, dropped };
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

export type HydratedStudyState = {
  /**
   * The student's saved class/board/subjects choices, opaque to core. The app
   * owns the shape; this layer only ferries it, which is also why it is not
   * merged by mergeHydratedState below.
   */
  onboarding: Record<string, unknown> | null;
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  cardsKnown: string[];
  activeDays: string[];
  lastChapterId?: string;
  lastSectionIndex: number;
};

/** How long a hydration attempt is allowed to hang before giving up on it. */
const HYDRATE_TIMEOUT_MS = 8000;

async function fetchStudyState(client: SyncClient, userId: string): Promise<HydratedStudyState> {
  const [attemptsRes, resultsRes, sectionsRes, cardsRes, daysRes, profileRes] = await Promise.all([
    client.from('attempts').select('id,mcq_id,chapter_id,subject_id,topic,correct,confidence,mode,at').eq('user_id', userId).order('at', { ascending: true }).limit(1000),
    client.from('results').select('id,subject_id,chapter_id,label,score,total,xp,mode,at').eq('user_id', userId).order('at', { ascending: false }).limit(100),
    client.from('read_sections').select('section_id,chapter_id,section_index,at').eq('user_id', userId).order('at', { ascending: true }),
    client.from('cards_known').select('card_id').eq('user_id', userId),
    client.from('active_days').select('day').eq('user_id', userId).order('day', { ascending: true }).limit(400),
    client.from('profiles').select('onboarding').eq('id', userId).maybeSingle(),
  ]);

  const error = attemptsRes.error ?? resultsRes.error ?? sectionsRes.error ?? cardsRes.error ?? daysRes.error ?? profileRes.error;
  if (error) throw error;

  // Ordered ascending by `at`, so the last row is the most recently read
  // section: exactly the reading position a reinstall or a second device
  // needs to pick up from. No separate "last position" table needed for that.
  const sections = (sectionsRes.data ?? []) as { section_id: string; chapter_id: string; section_index: number; at: string }[];
  const last = sections[sections.length - 1];

  return {
    onboarding: ((profileRes.data as { onboarding?: Record<string, unknown> | null } | null)?.onboarding) ?? null,
    attempts: ((attemptsRes.data ?? []) as AttemptRow[]).map(fromAttemptRow),
    results: ((resultsRes.data ?? []) as ResultRow[]).map(fromResultRow),
    readSections: sections.map((s) => s.section_id),
    cardsKnown: ((cardsRes.data ?? []) as { card_id: string }[]).map((c) => c.card_id),
    activeDays: ((daysRes.data ?? []) as { day: string }[]).map((d) => d.day),
    lastChapterId: last?.chapter_id,
    lastSectionIndex: last?.section_index ?? 0,
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
export function mergeHydratedState<S extends SyncableState>(local: S, server: HydratedStudyState): S {
  const byId = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const seen = new Set(a.map((x) => x.id));
    return [...a, ...b.filter((x) => !seen.has(x.id))];
  };
  const union = (a: string[], b: string[]): string[] => Array.from(new Set([...a, ...b]));

  return {
    ...local,
    readSections: union(local.readSections, server.readSections),
    attempts: byId(local.attempts, server.attempts).sort((a, b) => a.at - b.at),
    results: byId(local.results, server.results).sort((a, b) => b.at - a.at),
    cardsKnown: union(local.cardsKnown, server.cardsKnown),
    activeDays: union(local.activeDays, server.activeDays),
    // Local wins whenever it already has a reading position: either this
    // device is mid-session and knows something the last sync does not, or
    // nothing has been read here yet, in which case the server's last
    // position is exactly what a reinstalled or second device needs.
    lastChapterId: local.lastChapterId ?? server.lastChapterId,
    lastSectionIndex: local.lastChapterId ? local.lastSectionIndex : server.lastSectionIndex,
  };
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
