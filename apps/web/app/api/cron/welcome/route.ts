import { NextRequest, NextResponse } from 'next/server';
import { AI_QUOTA } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify, welcome } from '@/lib/notify';
import { plansLink } from '@/lib/signin-link';
import { SITE_URL } from '@/lib/site';
import { JobError, chunks, cronAuthorised, eachLimited, pageAll, withRetry, logged } from '@/lib/notify/jobs';

/**
 * Say hello to every new student: a line in the app and a push, and the email
 * that explains the free trial, what comes after it and the plans (welcome in
 * lib/notify/notices.ts).
 *
 * Runs every fifteen minutes. There is no install hook to hang this on, so it
 * sweeps two ways: accounts made in the last two days (which catches somebody
 * who signed up on the website and never allowed notifications), and accounts
 * with a device, which both apps register through claim_push_token the first
 * time somebody opens and signs into them. Either way, only those never
 * welcomed.
 *
 * Once each, guaranteed by profiles.welcomed_at rather than by looking for an
 * existing notification. A row can be cleared from an inbox and the wording
 * can change; a timestamp is the fact we actually mean.
 *
 * The stamp is written BEFORE the message goes out. Getting no welcome is a
 * small disappointment; getting the same one every fifteen minutes because a
 * send failed halfway is the kind of thing that makes somebody uninstall.
 *
 * Students only: a teacher or an administrator signing into the app is not
 * someone to welcome to their studies.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * How recent an account must be to be welcomed without a device. Somebody who
 * signs up on the website and never allows notifications has no push token,
 * and used to be welcomed never; now the email reaches them. Recent only, so
 * the day this shipped did not greet every old account at once.
 */
const NEW_ACCOUNT = 2 * 24 * 60 * 60 * 1000;

/** Enough for any realistic quarter hour, and a ceiling on a runaway sweep. */
const MAX_PER_RUN = 200;
const CONCURRENCY = 8;

export const GET = logged('welcome', handle);

async function handle(req: NextRequest) {
  if (!cronAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // ?user=<id> welcomes that one account only (if it has not been already): a
  // support check or a test that must not greet everybody else who is new.
  const only = req.nextUrl.searchParams.get('user');
  const admin = createAdminClient();

  try {
    /*
     * Devices first, then the accounts behind them. Two reads rather than a
     * join: PostgREST cannot filter one table on another's column without an
     * embed, and an embed here would pull every profile to find a handful.
     * Paged in a stable order: this read used to stop at a thousand rows in
     * no particular order, and past that newer installs were never welcomed.
     */
    const devices = await pageAll<{ user_id: string }>('push_tokens', (from, to, signal) =>
      admin.from('push_tokens').select('user_id').order('token').range(from, to).abortSignal(signal),
    );

    const withDevice = [...new Set(devices.map((d) => d.user_id))];

    const pending: string[] = [];
    // New accounts first, device or not.
    {
      const { data, error } = await withRetry((signal) => {
        let q = admin
          .from('profiles')
          .select('id')
          .is('welcomed_at', null)
          .eq('role', 'student')
          .gte('created_at', new Date(Date.now() - NEW_ACCOUNT).toISOString());
        if (only) q = q.eq('id', only);
        return q.order('created_at').limit(MAX_PER_RUN).abortSignal(signal);
      });
      if (error) throw new JobError('profiles', error.message);
      pending.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
    }
    const seen = new Set(pending);
    for (const slice of chunks(only ? withDevice.filter((id) => id === only) : withDevice)) {
      if (pending.length >= MAX_PER_RUN) break;
      const { data, error } = await withRetry((signal) =>
        admin.from('profiles').select('id').in('id', slice).is('welcomed_at', null).eq('role', 'student').abortSignal(signal),
      );
      if (error) throw new JobError('profiles', error.message);
      for (const r of (data ?? []) as { id: string }[]) if (!seen.has(r.id)) pending.push(r.id);
    }

    if (!pending.length) return NextResponse.json({ candidates: 0, welcomed: 0 });

    const ids = pending.slice(0, MAX_PER_RUN);

    // Claim them before sending, so a failure halfway cannot repeat the greeting
    // on the next sweep. Setting a value is safe to retry.
    const stamp = new Date().toISOString();
    const { error: claimError } = await withRetry((signal) =>
      admin.from('profiles').update({ welcomed_at: stamp }).in('id', ids).abortSignal(signal),
    );
    if (claimError) throw new JobError('claim', claimError.message);

    let welcomed = 0;
    await eachLimited(ids, CONCURRENCY, async (id) => {
      // notify never throws: a channel that fails is reported, not raised.
      // Without the secret no link can be signed; the email then points at sign-in.
      const link = plansLink(id) ?? `${SITE_URL}/login?next=/upgrade`;
      const report = await notify(id, welcome(link, AI_QUOTA.trial));
      if (report.inbox === 'sent') welcomed++;
    });

    // A welcome that failed after its claim is not sent again, by design, but
    // the run says it did not reach everyone.
    const summary = { candidates: ids.length, welcomed };
    if (welcomed < ids.length) return NextResponse.json({ error: 'incomplete', ...summary }, { status: 503 });
    return NextResponse.json(summary);
  } catch (e) {
    console.error('[cron/welcome] run failed', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'incomplete', stage: e instanceof JobError ? e.stage : 'unknown', detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
