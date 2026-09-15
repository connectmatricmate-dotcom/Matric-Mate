import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * What every scheduled job needs and none of them had.
 *
 * The jobs are called by pg_cron through pg_net, which fires and forgets: it
 * records whatever the route answers and never tries again. So when the
 * database gateway timed out under a bulk content run, 16 of 26 job calls in
 * one day ended on their first failed read, the 4pm nudge among them, and
 * pg_cron logged every run as succeeded. A student whose reminder was set for
 * four o'clock simply got nothing.
 *
 * The rules, in the order they bite:
 *  - a read or write that times out or meets a 5xx is tried again, with a
 *    growing wait, before the run gives up on it;
 *  - a run that could not finish says so with a non-200 status, so the failure
 *    is at least visible in net._http_response;
 *  - anything that can pass a thousand rows is paged, because select() stops
 *    at a thousand without saying so;
 *  - the secret is compared in constant time.
 */

type DbError = { message: string; code?: string } | null;
type DbResult = { error: DbError; status?: number };

/** How long one attempt gets before it is abandoned and tried again. */
const ATTEMPT_MS = 20_000;
const ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Worth another try: the gateway timed out or the database was overloaded
 * (5xx), the request was throttled, or no answer came back at all (status 0,
 * which is how supabase-js reports a network failure or an abort).
 */
function transient(r: DbResult): boolean {
  const status = r.status ?? 0;
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/**
 * Runs a Supabase call, and runs it again on a transient failure.
 *
 * Takes a function rather than a query so each attempt builds a fresh one, and
 * hands it a signal so an attempt that hangs is cut off rather than eating the
 * whole run: `(signal) => admin.from('x').select('y').abortSignal(signal)`.
 *
 * Only for calls that are safe to repeat. A read always is, and so is an
 * upsert or an update that sets a value. A plain insert is not, unless it
 * carries its own id so a repeat collides rather than duplicating: see the
 * inbox channel.
 */
export async function withRetry<T extends DbResult>(run: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  let result = { error: { message: 'not attempted' }, status: 0 } as T;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // 0.8s, then 2.4s, with a little jitter so parallel callers spread out.
    if (attempt) await sleep(800 * 3 ** (attempt - 1) + Math.random() * 400);
    try {
      result = await run(AbortSignal.timeout(ATTEMPT_MS));
    } catch (e) {
      result = { error: { message: e instanceof Error ? e.message : String(e) }, status: 0 } as T;
    }
    if (!result.error || !transient(result)) return result;
  }
  return result;
}

/** A read the run could not do without. Carries which one, for the log. */
export class JobError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
  ) {
    super(`${stage}: ${message}`);
  }
}

/**
 * Every row a query returns, a thousand at a time.
 *
 * The query must carry a stable `.order()`, ending on a unique column, or rows
 * can be skipped or repeated between pages. Throws JobError when a page cannot
 * be read even after retrying: a job working from half a list is worse than
 * one that stops and says so.
 */
export async function pageAll<Row>(
  stage: string,
  page: (from: number, to: number, signal: AbortSignal) => PromiseLike<{ data: Row[] | null; error: DbError; status?: number }>,
  size = 1000,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await withRetry((signal) => page(from, from + size - 1, signal));
    if (error) throw new JobError(stage, error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/**
 * A long id list in pieces. An `.in()` filter travels in the URL, and a few
 * hundred UUIDs is where a gateway starts refusing the request.
 */
export function chunks<T>(list: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Works through `items` a few at a time, and stops taking new ones once
 * `stop()` says the run is out of time. Returns how many it started.
 *
 * Sequential was the old way and it put a ceiling on every job: at about three
 * seconds a student, one run could reach roughly ninety of them and the rest
 * were dropped without a word.
 */
export async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, stop: () => boolean = () => false): Promise<number> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !stop()) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return next;
}

/**
 * Is this request from our own scheduler.
 *
 * Both sides are hashed first so they are the same length, which is what lets
 * the comparison take the same time whatever the header holds: a plain `!==`
 * stops at the first wrong character, and how long it took says how many were
 * right.
 */
export function cronAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(req.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`));
}

/**
 * A job route that leaves a record of every run (table job_runs, migration
 * 0054): the job, the status it answered and its summary. pg_cron says
 * "succeeded" whatever happens and pg_net forgets the answer after six hours,
 * so this is the only lasting trace of a run that sent nothing. Dry runs and
 * refused calls are not recorded. The write is awaited: a lambda freezes as
 * soon as the response is sent.
 */
export function logged(job: string, handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const res = await handler(req);
    if (res.status === 401 || req.nextUrl.searchParams.get('dry') === '1' || req.nextUrl.searchParams.get('push') === 'check') return res;
    try {
      const summary = await res
        .clone()
        .json()
        .catch(() => null);
      const { error } = await createAdminClient().from('job_runs').insert({ job, status: res.status, summary });
      if (error) console.error(`[${job}] could not record the run`, error.message);
    } catch (e) {
      console.error(`[${job}] could not record the run`, e instanceof Error ? e.message : e);
    }
    return res;
  };
}
