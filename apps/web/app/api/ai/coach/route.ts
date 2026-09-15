import { NextRequest, NextResponse } from 'next/server';
import { guardAi } from '@/lib/ai/guard';

/**
 * The coach card's read. Reports are written by the nightly job
 * (/api/cron/coach) and only ever read here.
 *
 * There used to be a POST beside this that wrote a report on demand from a
 * digest the client sent. Nothing has called it since the nightly job took
 * over, but it still answered anyone who did, spending a question of quota and
 * a model call, keyed on the week while the job keys on the day. It is gone;
 * a POST now gets the framework's 405.
 */

/**
 * How old a report may be and still be shown. The card reads "this week", so
 * a report from a fortnight ago, about a week the student no longer
 * remembers, is worse than the card's own welcome.
 */
const MAX_AGE_DAYS = 7;

/**
 * The card reads through here and never generates.
 *
 * Generation moved to the nightly cron (/api/cron/coach), because having the
 * dashboard trigger it meant whoever opened it first waited on a model call to
 * see their own home screen. Reading is free, costs no quota, and returns null
 * rather than an error when there is no report yet: a student with no history
 * has nothing to report on, and the card says something welcoming instead.
 */
export async function GET(req: NextRequest) {
  const g = await guardAi(req, 0);
  if (g instanceof NextResponse) return g;

  const oldest = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - MAX_AGE_DAYS * 864e5));
  const [{ data, error }, { data: profile, error: profileError }] = await Promise.all([
    g.admin
      .from('coach_reports')
      .select('body,period,created_at')
      .eq('user_id', g.userId)
      .gte('period', oldest)
      .order('period', { ascending: false })
      .limit(1)
      .maybeSingle(),
    g.admin.from('profiles').select('grade_changed_at, progress_reset_at').eq('id', g.userId).maybeSingle(),
  ]);
  if (error || profileError) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });

  /*
   * A report written before the student changed class is about the other
   * class's chapters and topics, so it is not shown. The next night's report
   * is about the class they are in. The same for one written before their
   * history was wiped (a reset, or a board switch: progress_reset_at): it
   * describes work that is no longer there.
   */
  const since = Math.max(
    Date.parse((profile?.grade_changed_at as string | null) ?? '') || 0,
    Date.parse((profile?.progress_reset_at as string | null) ?? '') || 0,
  );
  const stale = !!data && since > 0 && Date.parse(data.created_at as string) < since;
  const report = data && !stale ? data : null;

  return NextResponse.json({ report: report?.body ?? null, period: report?.period ?? null, quota: g.quota });
}
