import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/roles';

/**
 * The numbers on the admin overview.
 *
 * Deliberately few. Adnan asked for simple stats, and a wall of figures nobody
 * acts on is worse than a handful that answer the questions he actually has:
 * how many people are here, how many pay, how much came in, is anybody using
 * it, and are the teachers bringing anyone.
 *
 * Counted with `head: true` and an exact count wherever a count will do, so
 * the database counts instead of shipping every row here to be measured. That
 * also sidesteps the thousand-row cap, which turns a count into a wrong answer
 * rather than a slow one.
 */

export type AdminStats = {
  students: number;
  paidStudents: number;
  revenue: number;
  revenueThisMonth: number;
  activeToday: number;
  activeThisWeek: number;
  teachers: number;
  referredStudents: number;
  referredPaid: number;
  /** Accounts their owners deleted this Karachi month (account_deletions,
   *  migration 0048). A fact with no names attached, by design. */
  deletedThisMonth: number;
};

/** Asia/Karachi, because that is the day the students live in and the day
 *  `active_days` rows are stamped with. */
const dayKey = (offsetDays = 0): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - offsetDays * 86_400_000));

const PAGE = 1000;

/**
 * A failed read is thrown, not counted as nothing. A page that stopped early
 * used to end its loop as if it were the last one, and a head count that
 * failed read as zero: a revenue figure quietly short is the worst way for
 * this page to be wrong.
 */
function must<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) {
    console.error(`admin-stats: ${what} failed`, res.error.message);
    throw new Error('Could not load the overview.');
  }
  return res;
}

export async function adminStats(): Promise<AdminStats> {
  // The service key reads every account's money, so the caller is checked
  // here as well as on the page: see requireAdmin.
  await requireAdmin();
  const admin = createAdminClient();
  const HEAD = { count: 'exact' as const, head: true };

  /*
   * The month as the students and the admin live it. A UTC month began at
   * five in the morning on the 1st in Karachi, so the first hours of every
   * month counted towards the one before. Pakistan keeps +05:00 all year.
   */
  const monthStart = new Date(`${dayKey().slice(0, 7)}-01T00:00:00+05:00`);
  /*
   * Paying means a plan that is on and has not run out: planIsActive in
   * lib/entitlement, written as a filter so the database can count it. The
   * `active` column alone is never switched off when a plan expires, so it
   * counted every student who had ever paid.
   */
  const nowIso = new Date().toISOString();

  const [students, paidStudents, teachers, referred, today, deletions] = (
    await Promise.all([
      admin.from('profiles').select('*', HEAD).eq('role', 'student'),
      // A running plan that was paid for: the free trial is not a paying student.
      admin.from('entitlements').select('*', HEAD).eq('active', true).gt('valid_till', nowIso).or('plan.is.null,plan.neq.trial'),
      admin.from('affiliates').select('*', HEAD),
      admin.from('profiles').select('*', HEAD).not('referred_by', 'is', null),
      admin.from('active_days').select('*', HEAD).eq('day', dayKey()),
      admin.from('account_deletions').select('*', HEAD).gte('deleted_at', monthStart.toISOString()),
    ])
  ).map((res, i) => must(res, `count ${i}`));

  /*
   * The week is distinct students, not rows. Somebody who studied on five of
   * the last seven days is one active student, and counting rows would call
   * them five.
   */
  const weekUsers = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data } = must(
      await admin.from('active_days').select('user_id').gte('day', dayKey(6)).order('user_id').order('day').range(from, from + PAGE - 1),
      'active week',
    );
    const rows = (data ?? []) as { user_id: string }[];
    for (const r of rows) weekUsers.add(r.user_id);
    if (rows.length < PAGE) break;
  }

  /*
   * Revenue is a sum, so these rows do come here. Paged, because this is the
   * number that grows fastest and understating money is the worst way for a
   * figure on this page to be wrong.
   */
  let revenue = 0;
  let revenueThisMonth = 0;
  for (let from = 0; ; from += PAGE) {
    const { data } = must(
      await admin.from('payments').select('amount, at').eq('status', 'paid').order('id').range(from, from + PAGE - 1),
      'revenue',
    );
    const rows = (data ?? []) as { amount: number | null; at: string }[];
    for (const r of rows) {
      revenue += r.amount ?? 0;
      if (Date.parse(r.at) >= monthStart.getTime()) revenueThisMonth += r.amount ?? 0;
    }
    if (rows.length < PAGE) break;
  }

  /*
   * Referred students who are paying. Two reads rather than a join: PostgREST
   * cannot filter one table on another's column without an embed, and an embed
   * here would pull every profile row to count a handful of them.
   */
  const referredIds: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = must(
      await admin.from('profiles').select('id').not('referred_by', 'is', null).order('id').range(from, from + PAGE - 1),
      'referred',
    );
    const rows = (data ?? []) as { id: string }[];
    referredIds.push(...rows.map((r) => r.id));
    if (rows.length < PAGE) break;
  }
  let referredPaid = 0;
  for (let i = 0; i < referredIds.length; i += 200) {
    const { count } = must(
      await admin
        .from('entitlements')
        .select('*', HEAD)
        .eq('active', true)
        .gt('valid_till', nowIso)
        // Paying, as everywhere else on this page: a free trial is not a sale.
        .or('plan.is.null,plan.neq.trial')
        .in('user_id', referredIds.slice(i, i + 200)),
      'referred paying',
    );
    referredPaid += count ?? 0;
  }

  return {
    students: students.count ?? 0,
    paidStudents: paidStudents.count ?? 0,
    revenue,
    revenueThisMonth,
    activeToday: today.count ?? 0,
    activeThisWeek: weekUsers.size,
    teachers: teachers.count ?? 0,
    referredStudents: referred.count ?? 0,
    referredPaid,
    deletedThisMonth: deletions.count ?? 0,
  };
}

/**
 * Fourteen days of signups, money and study activity, for the overview chart.
 *
 * Grouped by the database, through `admin_daily_stats`, and read with the
 * caller's own session so the function's admin gate applies. Doing the
 * bucketing here instead would mean paging three growing tables in full to
 * draw fourteen bars.
 */
export type DailyPoint = { day: string; signups: number; revenue: number; studied: number };

export async function dailyStats(days = 14): Promise<DailyPoint[]> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_daily_stats', { days });

  if (error) {
    /*
     * Loud, and rethrown rather than swallowed.
     *
     * Returning an empty series here is what hid a broken function: the three
     * charts rendered as empty boxes, which reads as "nothing happened in a
     * fortnight" rather than "this query does not work". A Suspense boundary
     * with an error boundary above it can say so; a silent zero cannot.
     */
    console.error('admin-stats: daily failed', error.message);
    throw new Error('Could not load the last two weeks.');
  }

  /*
   * The column names are deliberately not `day`, `signups`… In a plpgsql
   * function the RETURNS TABLE names become variables for the whole body, and
   * `day` collided with `active_days.day`, so every call threw 42702 and the
   * chart drew an empty box. See migration 0032.
   */
  return (data ?? []).map((r: Record<string, unknown>) => ({
    day: String(r.bucket),
    signups: Number(r.signup_count ?? 0),
    revenue: Number(r.revenue_total ?? 0),
    studied: Number(r.studied_count ?? 0),
  }));
}

/**
 * The five automations (scheduled jobs), and how each one is doing.
 *
 * pg_cron calls every run a success whatever the route answered, so the
 * routes write their own answer to `job_runs` (migration 0054) and this reads
 * the latest two per job. `every` is how often a job runs, and `grace` how
 * late a run can be before it counts as missing.
 *
 * Judged for someone who is not a developer. The first version marked every
 * job "Needs a look" on the day recording began, before most had run once,
 * and a single run that could not reach a few phones looked the same as a
 * job that had stopped. Now: a job that has not run yet since recording
 * began is waiting, a job whose last run had trouble is retrying (every job
 * runs again soon, and the daily ones have a second run minutes later), and
 * only two troubled runs in a row, or a run that is overdue, says it is not
 * working.
 */
const HOUR = 3600 * 1000;
export const JOBS = [
  { job: 'daily', name: 'Daily tip and flashcard', when: '2 pm every day', first: 'after 2 pm', every: 24 * HOUR, grace: 3 * HOUR },
  { job: 'nudge', name: 'Evening study reminder', when: 'each evening, 4 to 9 pm', first: 'this evening', every: 24 * HOUR, grace: 3 * HOUR },
  { job: 'plans', name: 'Plan and trial reminders', when: 'every hour', first: 'within the hour', every: HOUR, grace: 2 * HOUR },
  { job: 'welcome', name: 'Welcome message', when: 'every 15 minutes', first: 'within 15 minutes', every: HOUR / 4, grace: HOUR },
  { job: 'coach', name: 'AI coach reports', when: '7:30 am every day', first: 'after 7:30 am', every: 24 * HOUR, grace: 3 * HOUR },
] as const;

/** When job_runs began (migration 0054). A job with no run since then is new, not broken, for its first cycle. */
const RECORDING_SINCE = Date.parse('2026-09-16T00:00:00+05:00');

export type JobState = 'working' | 'waiting' | 'retrying' | 'down' | 'unknown';

export type JobHealth = {
  job: string;
  name: string;
  when: string;
  /** The last run, or null for a job with no run recorded. */
  at: string | null;
  state: JobState;
  /** What the last run did, in words: "12 sent of 40", "Nobody due". */
  said: string;
};

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** A run's summary, in the words Adnan would use. Each route answers its own shape. */
function inWords(job: string, s: Record<string, unknown> | null): string {
  if (!s) return 'No details';
  if (s.quiet) return 'Quiet hours, nothing sent (9 pm to 8 am)';
  const done = n(s.sent ?? s.welcomed ?? s.written);
  const of = n(s.considered ?? s.candidates);
  const missed = n(s.failed) + n(s.pushFailed) + n(s.emailFailed) + n(s.unfinished) + n(s.dropped) + n(s.left);
  if (s.error && !of) return 'Could not finish; it runs again soon';
  if (!of) {
    const reason: Record<string, string> = {
      nobody_this_hour: 'Nobody due this hour',
      nobody_with_a_plan: 'Nobody due tonight',
      all_nudged_tonight: 'Everyone already reminded tonight',
    };
    return reason[String(s.reason)] ?? (job === 'welcome' ? 'Nobody new to welcome' : 'Nobody due');
  }
  const verb = job === 'welcome' ? 'welcomed' : job === 'coach' ? 'written' : 'sent';
  // A phone that is switched off or has uninstalled the app is the usual
  // reason a few do not go; the next run tries again.
  return `${done} ${verb} of ${of}${missed ? `, ${missed} to try again` : ''}`;
}

export async function jobHealth(): Promise<JobHealth[]> {
  await requireAdmin();
  const admin = createAdminClient();
  // A small read per job: the latest two rows each, by the (job, at desc) index.
  const reads = await Promise.all(
    JOBS.map((j) => admin.from('job_runs').select('at, status, summary').eq('job', j.job).order('at', { ascending: false }).limit(2)),
  );
  const now = Date.now();
  return JOBS.map((j, i) => {
    const { data, error } = reads[i];
    if (error) console.error(`admin-stats: job ${j.job} read failed`, error.message);
    const [last, before] = (data ?? []) as { at: string; status: number; summary: Record<string, unknown> | null }[];
    const base = { job: j.job, name: j.name, when: j.when, at: last?.at ?? null };
    if (error) return { ...base, state: 'unknown', said: 'Could not check just now' };
    if (!last) {
      return now - RECORDING_SINCE < j.every + j.grace
        ? { ...base, state: 'waiting', said: `Its first run shows here ${j.first}` }
        : { ...base, state: 'down', said: 'No run recorded' };
    }
    if (now - Date.parse(last.at) > j.every + j.grace) return { ...base, state: 'down', said: 'Its last run was too long ago' };
    const said = inWords(j.job, last.summary);
    if (last.status === 200) return { ...base, state: 'working', said };
    return before && before.status !== 200 ? { ...base, state: 'down', said } : { ...base, state: 'retrying', said };
  });
}

/** A problem with an outside service that only the admin can fix, seen in the last day (service_alerts, migration 0066). */
export type ServiceAlert = { kind: string; firstAt: string; lastAt: string; count: number; detail: string | null };

export async function serviceAlerts(): Promise<ServiceAlert[]> {
  await requireAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await createAdminClient()
    .from('service_alerts')
    .select('kind, first_at, last_at, count, detail')
    .gte('last_at', since)
    .order('last_at', { ascending: false });
  if (error) {
    // The banner is a warning on top of a working page: a failed read is
    // logged and shows nothing rather than taking the overview down.
    console.error('admin-stats: service alerts read failed', error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    kind: String(r.kind),
    firstAt: String(r.first_at),
    lastAt: String(r.last_at),
    count: Number(r.count ?? 1),
    detail: (r.detail as string | null) ?? null,
  }));
}

/**
 * How many reported AI answers are still new, for the overview's way in to
 * /admin/reports. Null when the count could not be read: the card then just
 * opens the page, without a number that might be wrong.
 */
export async function newReportCount(): Promise<number | null> {
  await requireAdmin();
  const { count, error } = await createAdminClient().from('ai_reports').select('id', { count: 'exact', head: true }).eq('status', 'new');
  if (error) {
    console.error('admin-stats: report count read failed', error.message);
    return null;
  }
  return count ?? 0;
}
