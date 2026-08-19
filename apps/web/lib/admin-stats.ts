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

export async function adminStats(): Promise<AdminStats> {
  const admin = createAdminClient();
  const HEAD = { count: 'exact' as const, head: true };

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [students, paidStudents, teachers, referred, today] = await Promise.all([
    admin.from('profiles').select('*', HEAD).eq('role', 'student'),
    admin.from('entitlements').select('*', HEAD).eq('active', true),
    admin.from('affiliates').select('*', HEAD),
    admin.from('profiles').select('*', HEAD).not('referred_by', 'is', null),
    admin.from('active_days').select('*', HEAD).eq('day', dayKey()),
  ]);

  /*
   * The week is distinct students, not rows. Somebody who studied on five of
   * the last seven days is one active student, and counting rows would call
   * them five.
   */
  const weekUsers = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin.from('active_days').select('user_id').gte('day', dayKey(6)).range(from, from + PAGE - 1);
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
    const { data } = await admin.from('payments').select('amount, at').eq('status', 'paid').range(from, from + PAGE - 1);
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
    const { data } = await admin.from('profiles').select('id').not('referred_by', 'is', null).range(from, from + PAGE - 1);
    const rows = (data ?? []) as { id: string }[];
    referredIds.push(...rows.map((r) => r.id));
    if (rows.length < PAGE) break;
  }
  let referredPaid = 0;
  for (let i = 0; i < referredIds.length; i += 200) {
    const { count } = await admin
      .from('entitlements')
      .select('*', HEAD)
      .eq('active', true)
      .in('user_id', referredIds.slice(i, i + 200));
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
