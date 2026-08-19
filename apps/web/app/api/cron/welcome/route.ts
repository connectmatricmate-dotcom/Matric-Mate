import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify, welcome } from '@/lib/notify';

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
 */

export const dynamic = 'force-dynamic';

/** Enough for any realistic quarter hour, and a ceiling on a runaway sweep. */
const MAX_PER_RUN = 200;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const admin = createAdminClient();

  /*
   * Devices first, then the accounts behind them. Two reads rather than a
   * join: PostgREST cannot filter one table on another's column without an
   * embed, and an embed here would pull every profile to find a handful.
   */
  const { data: devices, error: deviceError } = await admin
    .from('push_tokens')
    .select('user_id')
    .limit(5000);
  if (deviceError) return NextResponse.json({ error: deviceError.message }, { status: 500 });

  const withDevice = [...new Set((devices ?? []).map((d: { user_id: string }) => d.user_id))];
  if (!withDevice.length) return NextResponse.json({ candidates: 0, welcomed: 0 });

  const pending: string[] = [];
  for (let i = 0; i < withDevice.length && pending.length < MAX_PER_RUN; i += 200) {
    const { data, error } = await admin
      .from('profiles')
      .select('id')
      .in('id', withDevice.slice(i, i + 200))
      .is('welcomed_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    pending.push(...(data ?? []).map((r: { id: string }) => r.id));
  }

  if (!pending.length) return NextResponse.json({ candidates: 0, welcomed: 0 });

  const ids = pending.slice(0, MAX_PER_RUN);

  // Claim them before sending, so a failure halfway cannot repeat the greeting
  // on the next sweep.
  const { error: claimError } = await admin
    .from('profiles')
    .update({ welcomed_at: new Date().toISOString() })
    .in('id', ids);
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  let welcomed = 0;
  for (const id of ids) {
    // notify never throws: a channel that fails is reported, not raised.
    const report = await notify(id, welcome());
    if (report.inbox === 'sent') welcomed++;
  }

  return NextResponse.json({ candidates: ids.length, welcomed });
}
