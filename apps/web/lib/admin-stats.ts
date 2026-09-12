import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const [students, paidStudents, teachers, referred, today] = (
    await Promise.all([
      admin.from('profiles').select('*', HEAD).eq('role', 'student'),
      admin.from('entitlements').select('*', HEAD).eq('active', true).gt('valid_till', nowIso),
      admin.from('affiliates').select('*', HEAD),
      admin.from('profiles').select('*', HEAD).not('referred_by', 'is', null),
      admin.from('active_days').select('*', HEAD).eq('day', dayKey()),
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
