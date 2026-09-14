import 'server-only';
import { asBoard, parseDailyReport, type Board, type DailyReport } from '@matricmate/core';
import { planIsPaid } from '@/lib/entitlement';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/roles';

/**
 * The referral programme, server side.
 *
 * Every read here uses the admin client, which is unusual in this codebase and
 * is deliberate. A teacher's dashboard has to list other people's profiles and
 * other people's payments, which is precisely what row level security exists
 * to forbid, so the alternative would be policies that let one account read
 * another's payment history. Instead the caller's role is checked at the route
 * and every query below is scoped by the id of the teacher asking. The scoping
 * is the access control, so it is never optional and never derived from
 * anything the browser sent.
 *
 * No earnings are stored. They are computed from `payments` on every read,
 * because the client's rule is that a commission is earned when a payment is
 * confirmed and taken back when it is refunded. A stored total would need a
 * second writer on the refund path, and the day that writer is missed the
 * number goes quietly wrong with nothing to compare it against.
 */

/** Whole rupees, the unit `payments.amount` is already in. */
export type Money = number;

export type ReferredStudent = {
  id: string;
  name: string;
  email: string;
  grade: number | null;
  /** FBISE or Punjab, from profiles.board: the same student needs different
   *  help on each, and the class alone does not say which. */
  board: Board;
  joinedAt: string;
  /** On a plan right now, by the same rule as the paywall and the admin
   *  overview. Not "has ever paid": that is what `spend` says. */
  paid: boolean;
  /** What this student has paid us in total, net of refunds. */
  spend: Money;
  /** What they did on the day asked about; null when that read failed. */
  activity: StudentActivity | null;
};

/** One student's day, as their teacher sees it (students_activity, migration 0042). */
export type StudentActivity = {
  /** The app was opened that day. */
  opened: boolean;
  /** The day counts towards their streak: they answered or read something. */
  studied: boolean;
  /** Seconds in the app. */
  seconds: number;
  questions: number;
  /** The last day they opened the app or studied, YYYY-MM-DD. */
  lastActive: string | null;
};

export type AffiliateRow = {
  userId: string;
  code: string;
  commissionPct: number;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  institution: string | null;
  note: string | null;
  payoutMethod: string | null;
  payoutAccount: string | null;
  payoutName: string | null;
  active: boolean;
  createdAt: string;
};

export type AffiliateTotals = {
  students: number;
  paidStudents: number;
  /** What their students have paid us, net of refunds. */
  gross: Money;
  /** Their share of it. */
  earned: Money;
  /** What Adnan has recorded as handed over. */
  paidOut: Money;
  /** Earned minus paid out. What is owed right now. */
  outstanding: Money;
};

export type Payout = { id: string; amount: Money; note: string | null; at: string };

/**
 * A payment counts towards a commission only once Safepay has confirmed it,
 * and stops counting the moment it is refunded. `payments.status` carries
 * both, so the sum is a filter rather than a second table.
 */
const COUNTS = 'paid';

/** Rupees, rounded to the nearest whole one. Nobody pays out paisa. */
const share = (gross: Money, pct: number): Money => Math.round((gross * pct) / 100);

/**
 * Every payment made by a set of students, totalled per student.
 *
 * Paged with `.range()`, not `.limit()`. A `select()` stops at a thousand rows
 * without saying so, and a teacher with a few hundred students who have been
 * paying monthly for a year passes that quietly, which would understate what
 * they are owed. That is the worst direction for this particular number to be
 * wrong in.
 */
async function spendByStudent(admin: ReturnType<typeof createAdminClient>, ids: string[]): Promise<Map<string, Money>> {
  const out = new Map<string, Money>();
  if (!ids.length) return out;

  const PAGE = 1000;
  // Chunked by student too: a very long `in` list is a very long URL, and
  // PostgREST is served over one.
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from('payments')
        .select('user_id, amount')
        .in('user_id', slice)
        .eq('status', COUNTS)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`payments read failed: ${error.message}`);
      const rows = (data ?? []) as { user_id: string; amount: number | null }[];
      for (const r of rows) out.set(r.user_id, (out.get(r.user_id) ?? 0) + (r.amount ?? 0));
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

/**
 * Which of these students are on a plan right now.
 *
 * "Paying" meant three things on three screens: ever paid here, an `active`
 * flag nothing switches off at expiry on the admin overview, and a live plan
 * on the students page. After the first plans ran out they disagreed. This is
 * the paywall's rule, planIsActive, so all three now say the same.
 */
async function payingNow(admin: ReturnType<typeof createAdminClient>, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const PAGE = 1000;
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from('entitlements')
        .select('user_id, active, valid_till, plan')
        .in('user_id', slice)
        .order('user_id')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`entitlements read failed: ${error.message}`);
      const rows = (data ?? []) as { user_id: string; active: boolean | null; valid_till: string | null }[];
      // A free trial is not a sale: it would read as "has paid" to the teacher.
      for (const r of rows) if (planIsPaid(r)) out.add(r.user_id);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

/**
 * What each of these students did on one Karachi day (today when `day` is
 * not given): opened the app, studied, minutes, questions, last active day.
 *
 * Asked for by the client on 14 Sep 2026: a teacher who sends a class the
 * link wants to see who is actually using it. The database function takes
 * the ids it is given on trust, which is why it is service-role only and why
 * every caller here passes ids already scoped to this teacher's own students.
 * A failed read is an empty map rather than an error: the list of names and
 * money is still worth showing without it.
 */
async function activityByStudent(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
  day?: string,
): Promise<Map<string, StudentActivity>> {
  const out = new Map<string, StudentActivity>();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data, error } = await admin.rpc('students_activity', { p_users: slice, p_day: day ?? null });
    if (error) {
      console.error('[affiliates] activity read failed', error.message);
      continue;
    }
    for (const r of (data ?? []) as { user_id: string; opened: boolean; studied: boolean; seconds: number; questions: number; last_active: string | null }[]) {
      out.set(r.user_id, {
        opened: !!r.opened,
        studied: !!r.studied,
        seconds: r.seconds ?? 0,
        questions: r.questions ?? 0,
        lastActive: r.last_active,
      });
    }
  }
  return out;
}

/**
 * Every student a teacher brought, with what each has paid, and, when
 * `activity` is asked for, what they did that day: `true` for today or a
 * YYYY-MM-DD day. Totals and the admin's pages skip it; it costs a query.
 */
export async function referredStudents(affiliateId: string, opts: { activity?: true | string } = {}): Promise<ReferredStudent[]> {
  const admin = createAdminClient();

  const profiles: { id: string; name: string | null; contact: string | null; grade: number | null; board: string | null; referred_at: string | null }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, contact, grade, board, referred_at')
      .eq('referred_by', affiliateId)
      .order('referred_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`profiles read failed: ${error.message}`);
    const rows = data ?? [];
    profiles.push(...rows);
    if (rows.length < PAGE) break;
  }

  const ids = profiles.map((p) => p.id);
  const [spend, paying, activity] = await Promise.all([
    spendByStudent(admin, ids),
    payingNow(admin, ids),
    opts.activity ? activityByStudent(admin, ids, opts.activity === true ? undefined : opts.activity) : Promise.resolve(new Map<string, StudentActivity>()),
  ]);

  return profiles.map((p) => {
    const total = spend.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name?.trim() || 'Student',
      email: p.contact ?? '',
      grade: p.grade,
      board: asBoard(p.board),
      joinedAt: p.referred_at ?? '',
      paid: paying.has(p.id),
      spend: total,
      activity: activity.get(p.id) ?? null,
    };
  });
}

export type StudentDay = {
  student: { id: string; name: string; grade: number | null; board: Board; school: string | null };
  report: DailyReport;
  /** Chapter ids in the report, with their titles. */
  chapterTitles: Map<string, string>;
  /** The seven days up to and including `day`, newest first. */
  week: { day: string; activity: StudentActivity | null }[];
};

/**
 * One of a teacher's students, one day in full: the same report the student
 * sees of themselves, and the week around it.
 *
 * Null when the student is not this teacher's: the scoping is the access
 * control here, as everywhere in this file, so an id from the URL that was
 * not referred by this teacher reads as not found rather than as a report.
 */
export async function referredStudentDay(affiliateId: string, studentId: string, day: string, week: string[]): Promise<StudentDay | null> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, name, grade, board, school')
    .eq('id', studentId)
    .eq('referred_by', affiliateId)
    .maybeSingle();
  if (error) throw new Error(`profile read failed: ${error.message}`);
  if (!profile) return null;

  const [{ data: raw, error: reportError }, ...days] = await Promise.all([
    admin.rpc('daily_report', { p_day: day, p_user: studentId }),
    ...week.map((d) => activityByStudent(admin, [studentId], d)),
  ]);
  if (reportError) throw new Error(`report read failed: ${reportError.message}`);
  const report = parseDailyReport(raw);
  if (!report) throw new Error('report read failed: no report');

  const chapterTitles = new Map<string, string>();
  if (report.chapters.length) {
    const { data: rows } = await admin.from('chapters').select('id, title').in('id', report.chapters);
    for (const r of (rows ?? []) as { id: string; title: string }[]) chapterTitles.set(r.id, r.title);
  }

  return {
    student: {
      id: profile.id as string,
      name: (profile.name as string | null)?.trim() || 'Student',
      grade: profile.grade as number | null,
      board: asBoard(profile.board),
      school: (profile.school as string | null) ?? null,
    },
    report,
    chapterTitles,
    week: week.map((d, i) => ({ day: d, activity: days[i]?.get(studentId) ?? null })),
  };
}

export async function payouts(affiliateId: string): Promise<Payout[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('affiliate_payouts')
    .select('id, amount, note, at')
    .eq('affiliate_id', affiliateId)
    .order('at', { ascending: false })
    .range(0, 499);
  if (error) throw new Error(`payouts read failed: ${error.message}`);
  return (data ?? []) as Payout[];
}

export async function affiliateByUserId(userId: string): Promise<AffiliateRow | null> {
  const admin = createAdminClient();
  const [{ data: row }, { data: auth }] = await Promise.all([
    admin.from('affiliates').select('*').eq('user_id', userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  if (!row) return null;
  return toRow(row as Record<string, unknown>, auth?.user?.email ?? '');
}

function toRow(r: Record<string, unknown>, email: string): AffiliateRow {
  return {
    userId: String(r.user_id),
    code: String(r.code),
    commissionPct: Number(r.commission_pct),
    fullName: String(r.full_name ?? ''),
    email,
    phone: (r.phone as string) ?? null,
    city: (r.city as string) ?? null,
    institution: (r.institution as string) ?? null,
    note: (r.note as string) ?? null,
    payoutMethod: (r.payout_method as string) ?? null,
    payoutAccount: (r.payout_account as string) ?? null,
    payoutName: (r.payout_name as string) ?? null,
    active: Boolean(r.active),
    createdAt: String(r.created_at),
  };
}

/** One teacher's numbers: students, what they brought in, what they are owed. */
export async function totalsFor(affiliateId: string, commissionPct: number): Promise<AffiliateTotals> {
  const [students, paid] = await Promise.all([referredStudents(affiliateId), payouts(affiliateId)]);
  const gross = students.reduce((sum, s) => sum + s.spend, 0);
  const earned = share(gross, commissionPct);
  const paidOut = paid.reduce((sum, p) => sum + p.amount, 0);
  return {
    students: students.length,
    paidStudents: students.filter((s) => s.paid).length,
    gross,
    earned,
    paidOut,
    // Can go negative if Adnan pays ahead, or if a refund lands after a
    // payout. Shown as it is rather than clamped: a negative number is
    // information, and hiding it would be the start of a disagreement.
    outstanding: earned - paidOut,
  };
}

/** Every teacher, with their numbers, for the admin panel. Administrators only,
 *  checked here as well as on the page: see requireAdmin. */
export async function allAffiliates(): Promise<{ row: AffiliateRow; totals: AffiliateTotals }[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from('affiliates').select('*').order('created_at', { ascending: false }).range(0, 499);
  if (error) throw new Error(`affiliates read failed: ${error.message}`);

  const rows = (data ?? []) as Record<string, unknown>[];
  const emails = await Promise.all(rows.map((r) => admin.auth.admin.getUserById(String(r.user_id))));

  return Promise.all(
    rows.map(async (r, i) => {
      const row = toRow(r, emails[i]?.data?.user?.email ?? '');
      return { row, totals: await totalsFor(row.userId, row.commissionPct) };
    }),
  );
}
