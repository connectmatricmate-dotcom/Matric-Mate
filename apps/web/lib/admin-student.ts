import 'server-only';
import { cache } from 'react';
import { asBoard, type Board } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/roles';

/**
 * One student, everything the administrator acts on: who they are, their
 * plan and when it ends, what they have paid, and which teacher brought them.
 *
 * The page it feeds is where a row on the students list, the follow-up list
 * or a teacher's page leads. Adnan works from a phone, and a table row with
 * five columns and three buttons squeezed into it was the only place any of
 * this lived.
 *
 * Service key, so administrators only, checked here as well as on the page
 * (see requireAdmin).
 */

export type StudentPayment = {
  id: string;
  plan: string | null;
  amount: number;
  status: string;
  at: string;
  /** Given by hand from the admin panel, not paid through a gateway. */
  manual: boolean;
};

export type AdminStudent = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  grade: number | null;
  board: Board;
  joined: string;
  teacher: { id: string; name: string } | null;
  plan: string | null;
  /** The entitlement's own switch: false after a revoke, even with a date ahead. */
  active: boolean;
  validTill: string | null;
  trialUsed: boolean;
  payments: StudentPayment[];
};

/** Read once per request: the page's header and its delete panel both ask. */
export const adminStudent = cache(async (id: string): Promise<AdminStudent | null> => {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createAdminClient();

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, name, phone, school, grade, board, role, referred_by, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`profile read failed: ${error.message}`);
  if (!profile || (profile.role && profile.role !== 'student')) return null;

  const [auth, ent, teacher, payments] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('entitlements').select('active, plan, valid_till, trial_used_at').eq('user_id', id).maybeSingle(),
    profile.referred_by
      ? admin.from('affiliates').select('user_id, full_name').eq('user_id', profile.referred_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // A student's own payments are a handful, but paged all the same.
    (async () => {
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error: e } = await admin
          .from('payments')
          .select('id, plan, amount, status, at, tracker')
          .eq('user_id', id)
          .order('at', { ascending: false })
          .range(from, from + 999);
        if (e) throw new Error(`payments read failed: ${e.message}`);
        rows.push(...(data ?? []));
        if ((data ?? []).length < 1000) break;
      }
      return rows;
    })(),
  ]);
  if (ent.error) throw new Error(`plan read failed: ${ent.error.message}`);

  return {
    id,
    name: (profile.name as string | null)?.trim() || auth.data.user?.email?.split('@')[0] || 'Student',
    email: auth.data.user?.email ?? '',
    phone: (profile.phone as string | null) ?? null,
    school: (profile.school as string | null) ?? null,
    grade: (profile.grade as number | null) ?? null,
    board: asBoard(profile.board),
    joined: auth.data.user?.created_at ?? String(profile.created_at ?? ''),
    teacher: teacher.data ? { id: String(teacher.data.user_id), name: String(teacher.data.full_name ?? '') } : null,
    plan: (ent.data?.plan as string | null) ?? null,
    active: Boolean(ent.data?.active),
    validTill: (ent.data?.valid_till as string | null) ?? null,
    trialUsed: Boolean(ent.data?.trial_used_at),
    payments: payments.map((p) => ({
      id: String(p.id),
      plan: (p.plan as string | null) ?? null,
      amount: Number(p.amount ?? 0),
      status: String(p.status),
      at: String(p.at),
      manual: String(p.tracker ?? '').startsWith('MANUAL-'),
    })),
  };
});
