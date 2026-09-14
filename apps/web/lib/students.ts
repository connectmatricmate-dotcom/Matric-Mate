import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * The student list behind the admin panel.
 *
 * One call to `admin_student_list()`, a security-definer function that joins
 * profiles to auth.users and reports the plan. Doing it in the database rather
 * than here is what makes the page quick: the email lives in auth.users, which
 * PostgREST will not join, so the alternative was paging the auth admin API
 * and matching in memory.
 *
 * Read with the caller's OWN session, never the service key. The function
 * refuses anyone whose profile is not an administrator, so the guard is in the
 * database and does not depend on remembering to check it here as well.
 */

export type StudentRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  joined: string;
  plan: string | null;
  active: boolean;
  validTill: string | null;
  paidTotal: number;
  teacher: string | null;
  grade: 9 | 10;
  board: 'fbise' | 'punjab';
  /** As the student typed it at signup or in their account; null when they skipped it. */
  school: string | null;
};

/**
 * Paged, in a stable order. An RPC's rows are capped at a thousand like any
 * other read, and without paging the thousand-and-first student would simply
 * not be on the page.
 */
const PAGE = 1000;

export const allStudents = cache(async (): Promise<StudentRow[]> => {
  const supabase = await createClient();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc('admin_student_list')
      .order('joined', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1);

    if (error) {
      // Loud, and nothing rather than a half list: a students page that
      // silently shows nine of eleven accounts is worse than one that says it
      // broke.
      console.error('students: list failed', error.message);
      throw new Error('Could not load the students.');
    }
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    email: String(r.email ?? ''),
    phone: (r.phone as string | null) ?? null,
    joined: String(r.joined ?? ''),
    plan: (r.plan as string | null) ?? null,
    active: Boolean(r.active),
    validTill: (r.valid_till as string | null) ?? null,
    paidTotal: Number(r.paid_total ?? 0),
    teacher: (r.teacher as string | null) ?? null,
    grade: Number(r.grade) === 10 ? 10 : 9,
    board: r.board === 'punjab' ? 'punjab' : 'fbise',
    school: (r.school as string | null) ?? null,
  }));
});

export type SchoolCount = { school: string; students: number; paying: number; trials: number };

/**
 * Students per school, for the admin's inventory: admin_school_counts()
 * groups the typed names case-insensitively and shows the commonest spelling.
 */
export const schoolCounts = cache(async (): Promise<SchoolCount[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_school_counts');
  if (error) {
    console.error('students: school counts failed', error.message);
    throw new Error('Could not load the schools.');
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    school: String(r.school ?? ''),
    students: Number(r.students ?? 0),
    paying: Number(r.paying ?? 0),
    trials: Number(r.trials ?? 0),
  }));
});
