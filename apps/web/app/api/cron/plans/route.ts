import { NextRequest, NextResponse } from 'next/server';
import { formatDate } from '@matricmate/core';
import { lapsed, loadRecipient, notify, planEnded, planEnding, planLastDay, trialDay2, trialEnded, trialEnding } from '@/lib/notify';
import type { Notice } from '@/lib/notify';
import { JobError, chunks, cronAuthorised, eachLimited, pageAll, withRetry, logged } from '@/lib/notify/jobs';
import { plansLink } from '@/lib/signin-link';
import { SITE_URL } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Plan reminders, hourly (pg_cron, migration 0045).
 *
 * Nothing used to tell a student their plan was ending, or had ended: a trial
 * got one push on its last afternoon, and only if the daily tip reached them,
 * and a paid month simply ran out and the app locked. Now:
 *
 *   trial_day2      a free trial with two days left (every trial day has its
 *                   message: the welcome on the first, this, then the last)
 *   trial_ending    the last day of a free trial
 *   trial_ended     a free trial that has just ended
 *   plan_ending     a paid plan in its last three days
 *   plan_last_day   a paid plan in its last day
 *   plan_ended      a paid plan that has just ended
 *   lapsed_3 .. 30  still no plan 3, 7, 14 and 30 days after either ended,
 *                   then nothing more (see lapsed in lib/notify/notices.ts)
 *
 * Each goes once per plan end date: claimed in plan_notices before it is
 * sent, so a second run the same hour sends nothing, and a renewal (a new end
 * date) gets reminders of its own, and buying one stops the ladder at once:
 * the end date moves into the future and nothing here is due any more. In the
 * app's inbox and as a push it names the website in plain words (Google Play
 * allows that much, core/billing.ts); by email it lists the plans with their
 * prices, with a button that signs the student in on the plans page.
 *
 * Each step is due only inside its own day, so a student whose plan ended
 * weeks before this ran for the first time gets the one step now due, not the
 * whole ladder at once.
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
/** How long after an end the "has ended" message may still go out, before the follow-ups take over. */
const ENDED_WINDOW = 2 * DAY;
const ENDING_WINDOW = 3 * DAY;
/** The follow-ups, in days after the end. Each is due for one day from then. */
const LAPSED_STEPS = [3, 7, 14, 30] as const;
/** The furthest back an ending can be and still owe a message. */
const LOOKBACK = (LAPSED_STEPS[LAPSED_STEPS.length - 1] + 1) * DAY;

type Kind =
  | 'trial_day2'
  | 'trial_ending'
  | 'trial_ended'
  | 'plan_ending'
  | 'plan_last_day'
  | 'plan_ended'
  | 'lapsed_3'
  | 'lapsed_7'
  | 'lapsed_14'
  | 'lapsed_30';
type Row = { user_id: string; plan: string | null; valid_till: string; trial_subject: string | null };

const KARACHI = 'Asia/Karachi';
const karachiHour = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: KARACHI, hour: '2-digit', hour12: false }).format(d));
/** The calendar day in Karachi, for "today" versus "tomorrow". The server runs on UTC. */
const karachiDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: KARACHI }).format(d);

/** Which reminder, if any, this plan is due, at `now`. */
function due(row: Row, now: number): Kind | null {
  const till = Date.parse(row.valid_till);
  if (!Number.isFinite(till)) return null;
  const left = till - now;
  const trial = row.plan === 'trial';
  if (left > 0) {
    // A trial is three days: the last day, then the one before it.
    if (trial) return left <= DAY ? 'trial_ending' : left <= 2 * DAY ? 'trial_day2' : null;
    return left <= DAY ? 'plan_last_day' : left <= ENDING_WINDOW ? 'plan_ending' : null;
  }
  const since = -left;
  if (since <= ENDED_WINDOW) return trial ? 'trial_ended' : 'plan_ended';
  for (const step of LAPSED_STEPS) {
    if (since >= step * DAY && since < (step + 1) * DAY) return `lapsed_${step}`;
  }
  return null;
}

export const GET = logged('plans', handle);

async function handle(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const nowDate = new Date();
  const hour = karachiHour(nowDate);
  // ?force=1 sends at any hour: for running it by hand (the secret is still required).
  const force = req.nextUrl.searchParams.get('force') === '1';
  if (!force && (hour < 8 || hour >= 21)) return NextResponse.json({ quiet: true, hour });
  // ?user=<id> runs it for one account only: a support check that must not
  // remind everyone else whose plan happens to be ending.
  const only = req.nextUrl.searchParams.get('user');

  const admin = createAdminClient();
  const now = nowDate.getTime();
  try {
    // Every plan ending in the next three days or ended in the last month.
    const from = new Date(now - LOOKBACK).toISOString();
    const to = new Date(now + ENDING_WINDOW).toISOString();
    const rows = await pageAll<Row>('entitlements', (a, b, signal) => {
      let q = admin
        .from('entitlements')
        .select('user_id, plan, valid_till, trial_subject')
        // Switched on: a plan revoked by hand keeps its end date, and must not
        // be told it "ends soon" or has "ended".
        .eq('active', true)
        .not('plan', 'is', null)
        .gte('valid_till', from)
        .lte('valid_till', to);
      if (only) q = q.eq('user_id', only);
      return q.order('user_id').range(a, b).abortSignal(signal);
    });

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
    let failed = 0;
    let skipped = 0;
    let emailFailed = 0;
    /** Not sent after all: the next hourly run tries again. */
    const release = (row: Row, kind: Kind) =>
      admin.from('plan_notices').delete().eq('user_id', row.user_id).eq('kind', kind).eq('until', row.valid_till);
    await eachLimited(
      candidates.filter((c) => students.has(c.row.user_id)),
      CONCURRENCY,
      async ({ row, kind }) => {
        // Claim first: only the run that inserts the row sends.
        const { data: claim, error } = await withRetry((signal) =>
          admin
            .from('plan_notices')
            .upsert({ user_id: row.user_id, kind, until: row.valid_till }, { onConflict: 'user_id,kind,until', ignoreDuplicates: true })
            .select('user_id')
            .abortSignal(signal),
        );
        if (error) {
          failed++;
          return;
        }
        if (!claim?.length) return;
        claimed++;

        const recipient = await loadRecipient(row.user_id, { email: true });
        if (!recipient) {
          failed++;
          await release(row, kind);
          return;
        }
        // Without the secret no link can be signed; the email then points at sign-in.
        const link = plansLink(row.user_id) ?? `${SITE_URL}/login?next=/upgrade`;
        const s = row.trial_subject ? subjectRow.get(row.trial_subject) : undefined;
        const subject = s ? (recipient.lang === 'ur' && s.urdu_name) || s.name : '';
        // In Karachi time: the server's own clock is UTC, which put a plan
        // ending after 7 pm on the day before.
        const date = formatDate(row.valid_till, recipient.lang, { day: 'numeric', month: 'long', timeZone: KARACHI });
        const ends = new Date(row.valid_till);
        const time = ends.toLocaleTimeString(recipient.lang === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: KARACHI,
        });
        const notice: Notice =
          kind === 'trial_day2'
            ? trialDay2(subject, date, link)
            : kind === 'trial_ending'
              ? trialEnding(subject, time, karachiDay(ends) === karachiDay(nowDate), link)
              : kind === 'trial_ended'
                ? trialEnded(link)
                : kind === 'plan_ending'
                  ? planEnding(date, link)
                  : kind === 'plan_last_day'
                    ? planLastDay(date, link)
                    : kind === 'plan_ended'
                      ? planEnded(date, link)
                      : lapsed(Number(kind.slice('lapsed_'.length)) as 3 | 7 | 14 | 30, link);
        const report = await notify(recipient, notice);
        const results = Object.values(report);
        if (results.includes('sent')) sent++;
        // An email-only follow-up to somebody who has switched emails off (or
        // whose address cannot receive mail) has nowhere to go. That is done,
        // not failed: releasing it would retry, and fail, every hour.
        else if (results.length && results.every((r) => r === 'skipped' || r === 'unconfigured')) skipped++;
        else {
          failed++;
          await release(row, kind);
        }
        // The email is the only one with the button to renew, so its failure
        // is worth a status of its own even when the inbox row landed.
        if (report.email === 'failed') emailFailed++;
      },
    );

    const summary = { candidates: candidates.length, claimed, sent, skipped, failed, emailFailed };
    // pg_cron records every run as a success; this status is the only trace.
    if (failed || emailFailed) return NextResponse.json({ error: 'incomplete', ...summary }, { status: 503 });
    return NextResponse.json(summary);
  } catch (e) {
    console.error('[cron/plans] run failed', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'incomplete', stage: e instanceof JobError ? e.stage : 'unknown', detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
