import { NextRequest, NextResponse } from 'next/server';
import { formatDate } from '@matricmate/core';
import { loadRecipient, notify, planEnded, planEnding, trialEnded, trialEnding } from '@/lib/notify';
import type { Notice } from '@/lib/notify';
import { JobError, chunks, cronAuthorised, eachLimited, pageAll, withRetry } from '@/lib/notify/jobs';
import { plansLink } from '@/lib/signin-link';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Plan reminders, hourly (pg_cron, migration 0045).
 *
 * Nothing used to tell a student their plan was ending, or had ended: a trial
 * got one push on its last afternoon, and only if the daily tip reached them,
 * and a paid month simply ran out and the app locked. Now:
 *
 *   trial_ending  the last day of a free trial
 *   trial_ended   a free trial that has just ended
 *   plan_ending   a paid plan in its last three days
 *   plan_ended    a paid plan that has just ended
 *
 * Each goes once per plan end date: claimed in plan_notices before it is
 * sent, so a second run the same hour sends nothing, and a renewal (a new end
 * date) gets reminders of its own. In the app's inbox and as a push it says
 * what is happening and nothing about buying (Google Play); by email it says
 * where to renew, with a button that signs the student in on the plans page.
 *
 * Quiet at night: between 21:00 and 08:00 in Karachi nothing goes out, and
 * each reminder's window (a day at least) is wide enough to land in daylight.
 * `?force=1` (with the cron secret) sends at any hour, for a run by hand.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CONCURRENCY = 6;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** A reminder about an ending that is further back than this is no longer news. */
const ENDED_WINDOW = 3 * DAY;
const ENDING_WINDOW = 3 * DAY;

type Kind = 'trial_ending' | 'trial_ended' | 'plan_ending' | 'plan_ended';
type Row = { user_id: string; plan: string | null; valid_till: string; trial_subject: string | null };

const karachiHour = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', hour12: false }).format(d));

/** Which reminder, if any, this plan is due, at `now`. */
function due(row: Row, now: number): Kind | null {
  const till = Date.parse(row.valid_till);
  if (!Number.isFinite(till)) return null;
  const left = till - now;
  const trial = row.plan === 'trial';
  if (left > 0) {
    if (trial) return left <= DAY ? 'trial_ending' : null;
    return left <= ENDING_WINDOW ? 'plan_ending' : null;
  }
  if (-left <= ENDED_WINDOW) return trial ? 'trial_ended' : 'plan_ended';
  return null;
}

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const nowDate = new Date();
  const hour = karachiHour(nowDate);
  // ?force=1 sends at any hour: for running it by hand (the secret is still required).
  const force = req.nextUrl.searchParams.get('force') === '1';
  if (!force && (hour < 8 || hour >= 21)) return NextResponse.json({ quiet: true, hour });

  const admin = createAdminClient();
  const now = nowDate.getTime();
  try {
    // Every plan ending in the next three days or ended in the last three.
    const from = new Date(now - ENDED_WINDOW).toISOString();
    const to = new Date(now + ENDING_WINDOW).toISOString();
    const rows = await pageAll<Row>('entitlements', (a, b, signal) =>
      admin
        .from('entitlements')
        .select('user_id, plan, valid_till, trial_subject')
        .not('plan', 'is', null)
        .gte('valid_till', from)
        .lte('valid_till', to)
        .order('user_id')
        .range(a, b)
        .abortSignal(signal),
    );

    const candidates = rows.map((r) => ({ row: r, kind: due(r, now) })).filter((c): c is { row: Row; kind: Kind } => !!c.kind);
    if (!candidates.length) return NextResponse.json({ candidates: 0, sent: 0 });

    // Students only: staff have no plan to remind anyone of.
    const students = new Set<string>();
    for (const slice of chunks(candidates.map((c) => c.row.user_id))) {
      const { data, error } = await withRetry((signal) =>
        admin.from('profiles').select('id').in('id', slice).eq('role', 'student').abortSignal(signal),
      );
      if (error) throw new JobError('profiles', error.message);
      for (const p of (data ?? []) as { id: string }[]) students.add(p.id);
    }

    const { data: subjects } = await admin.from('subjects').select('id, name, urdu_name');
    const subjectRow = new Map(((subjects ?? []) as { id: string; name: string; urdu_name: string | null }[]).map((s) => [s.id, s]));

    let claimed = 0;
    let sent = 0;
    await eachLimited(
      candidates.filter((c) => students.has(c.row.user_id)),
      CONCURRENCY,
      async ({ row, kind }) => {
        // Claim first: only the run that inserts the row sends.
        const { data: claim, error } = await admin
          .from('plan_notices')
          .upsert({ user_id: row.user_id, kind, until: row.valid_till }, { onConflict: 'user_id,kind,until', ignoreDuplicates: true })
          .select('user_id');
        if (error || !claim?.length) return;
        claimed++;

        const recipient = await loadRecipient(row.user_id, { email: true });
        if (!recipient) return;
        const link = plansLink(row.user_id);
        const s = row.trial_subject ? subjectRow.get(row.trial_subject) : undefined;
        const subject = s ? (recipient.lang === 'ur' && s.urdu_name) || s.name : '';
        const date = formatDate(row.valid_till, recipient.lang, { day: 'numeric', month: 'long' });
        const notice: Notice =
          kind === 'trial_ending'
            ? trialEnding(subject, link)
            : kind === 'trial_ended'
              ? trialEnded(link)
              : kind === 'plan_ending'
                ? planEnding(date, link)
                : planEnded(date, link);
        const report = await notify(recipient, notice);
        if (report.inbox === 'sent' || report.push === 'sent' || report.email === 'sent') sent++;
      },
    );

    return NextResponse.json({ candidates: candidates.length, claimed, sent });
  } catch (e) {
    console.error('[cron/plans] run failed', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'incomplete', stage: e instanceof JobError ? e.stage : 'unknown', detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
