import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify, welcome } from '@/lib/notify';
import { JobError, chunks, cronAuthorised, eachLimited, pageAll, withRetry } from '@/lib/notify/jobs';

/**
 * Say hello to anybody who has just put the app on a phone.
 *
 * Runs every fifteen minutes. There is no install hook to hang this on: the
 * first true signal we get is a device registering a push token, which both
 * apps do through claim_push_token the first time somebody opens and signs
 * into them. So this sweeps for accounts that have a device and have never
 * been welcomed.
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

/** Enough for any realistic quarter hour, and a ceiling on a runaway sweep. */
const MAX_PER_RUN = 200;
const CONCURRENCY = 8;

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

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
    if (!withDevice.length) return NextResponse.json({ candidates: 0, welcomed: 0 });

    const pending: string[] = [];
    for (const slice of chunks(withDevice)) {
      if (pending.length >= MAX_PER_RUN) break;
      const { data, error } = await withRetry((signal) =>
        admin.from('profiles').select('id').in('id', slice).is('welcomed_at', null).eq('role', 'student').abortSignal(signal),
      );
      if (error) throw new JobError('profiles', error.message);
      pending.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
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
      const report = await notify(id, welcome());
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
