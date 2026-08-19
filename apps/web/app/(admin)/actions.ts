'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { currentRole, emailAllowedAsAdmin } from '@/lib/roles';
import { markPaidAndGrant, recordPendingPayment } from '@/lib/payments';
import { PLANS, THE_PLAN, planById } from '@/lib/plans';

/**
 * Everything the admin panel can do. Five actions, all of them privileged.
 *
 * Each one re-checks who is calling. The layout guard is what stops the page
 * rendering, and a server action is a public HTTP endpoint that does not go
 * through the layout: anybody who knows the action id can post to it. Guarding
 * only the page would leave "create an account with any role" open to the
 * internet.
 */

export type AdminState = { error?: string; ok?: string; code?: string };

async function requireAdmin(): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: 'Not signed in.' };
  const role = await currentRole();
  if (role !== 'admin' || !emailAllowedAsAdmin(data.user.email)) return { error: 'Not allowed.' };
  return { id: data.user.id };
}

const NewTeacher = z.object({
  fullName: z.string().trim().min(2, 'Name is required.').max(120),
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  // Adnan sets this and passes it on himself. Email to real people is still
  // blocked on the unverified domain, so an invite link would not arrive.
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72),
  commissionPct: z.coerce.number().min(0, 'Commission cannot be negative.').max(100, 'Commission cannot be over 100%.'),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  institution: z.string().trim().max(140).optional().or(z.literal('')),
  payoutMethod: z.string().trim().max(40).optional().or(z.literal('')),
  payoutAccount: z.string().trim().max(80).optional().or(z.literal('')),
  payoutName: z.string().trim().max(120).optional().or(z.literal('')),
  note: z.string().trim().max(600).optional().or(z.literal('')),
});

const blank = (v: string | undefined) => (v && v.length ? v : null);

/**
 * Create a teacher: an auth account, the affiliate row, and a code.
 *
 * The account is created already confirmed. There is no confirmation email to
 * send, because Adnan hands the password over himself, and an unconfirmed
 * account could not sign in to see the dashboard this exists for.
 */
export async function createTeacherAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const parsed = NewTeacher.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const t = parsed.data;

  const admin = createAdminClient();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: t.email,
    password: t.password,
    email_confirm: true,
    user_metadata: { name: t.fullName },
  });
  if (authError || !created.user) {
    const already = /already|registered|exists/i.test(authError?.message ?? '');
    return { error: already ? 'An account with that email already exists.' : `Could not create the account: ${authError?.message}` };
  }
  const userId = created.user.id;

  /*
   * From here the auth account exists, so a failure below would leave a
   * half-made teacher: an account that can sign in and lands nowhere. Each
   * step therefore undoes the account rather than returning an error over the
   * top of it.
   */
  const { data: codeRow, error: codeError } = await admin.rpc('mint_affiliate_code');
  if (codeError || !codeRow) {
    await admin.auth.admin.deleteUser(userId);
    return { error: `Could not mint a referral code: ${codeError?.message}` };
  }
  const code = String(codeRow);

  const { error: rowError } = await admin.from('affiliates').insert({
    user_id: userId,
    code,
    commission_pct: t.commissionPct,
    full_name: t.fullName,
    phone: blank(t.phone),
    city: blank(t.city),
    institution: blank(t.institution),
    payout_method: blank(t.payoutMethod),
    payout_account: blank(t.payoutAccount),
    payout_name: blank(t.payoutName),
    note: blank(t.note),
    created_by: who.id,
  });
  if (rowError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: `Could not save the teacher: ${rowError.message}` };
  }

  // Last, because it is what decides where they land when they sign in. A
  // teacher whose role never got set would be sent to the student dashboard
  // and hit the paywall.
  const { error: roleError } = await admin.from('profiles').update({ role: 'affiliate' }).eq('id', userId);
  if (roleError) {
    await admin.from('affiliates').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    return { error: `Could not set the role: ${roleError.message}` };
  }

  revalidatePath('/admin/teachers');
  return { ok: `${t.fullName} is set up.`, code };
}

const Payout = z.object({
  affiliateId: z.string().uuid(),
  amount: z.coerce.number().int('Enter whole rupees.').positive('Enter an amount above zero.').max(10_000_000),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

/** Record money actually handed over, so both sides read the same number. */
export async function recordPayoutAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const parsed = Payout.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the amount.' };

  const { error } = await createAdminClient().from('affiliate_payouts').insert({
    affiliate_id: parsed.data.affiliateId,
    amount: parsed.data.amount,
    note: blank(parsed.data.note),
    recorded_by: who.id,
  });
  if (error) return { error: `Could not record the payout: ${error.message}` };

  revalidatePath(`/admin/teachers/${parsed.data.affiliateId}`);
  revalidatePath('/admin/teachers');
  return { ok: `Recorded Rs ${parsed.data.amount.toLocaleString('en-PK')}.` };
}

const Grant = z.object({
  userId: z.string().uuid('Unknown student.'),
  planId: z.enum(PLANS.map((p) => p.id) as [string, ...string[]]).optional(),
});

/** The student exists, is a student, and is not staff wearing a student's URL. */
async function studentOrError(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, name').eq('id', userId).maybeSingle();
  if (!profile) return { error: 'No such account.' };
  if (profile.role && profile.role !== 'student') {
    // A plan buys chapters and a tutor. Staff have neither screen.
    return { error: 'That account is a teacher or an administrator, not a student.' };
  }
  return { name: profile.name ?? 'They' };
}

/**
 * Give a student Premium for money taken outside the app.
 *
 * This exists because the gateway cannot yet complete a payment, so the only
 * way anybody buys is a bank transfer, a wallet or cash in the office, and
 * Adnan needs to act on that without waiting for a developer to run SQL. It
 * stays useful afterwards: comped accounts, a support fix, a refund settled
 * as extra time.
 *
 * It writes a PAYMENT, not just an entitlement, and that is the whole point.
 * Revenue on the overview and every teacher's commission are computed from
 * `payments` where status is paid, so granting access on its own would show
 * Rs 0 collected and quietly pay a teacher nothing for a student who really
 * did pay. Same path as a real payment for exactly that reason: the row, then
 * markPaidAndGrant, which extends from whichever is later and sends the
 * receipt the student would have got anyway.
 */
export async function grantPremiumAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const parsed = Grant.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Unknown student.' };

  const check = await studentOrError(parsed.data.userId);
  if ('error' in check) return { error: check.error };

  const plan = planById(parsed.data.planId ?? THE_PLAN.id);
  const stamp = Date.now().toString(36);
  const tracker = `MANUAL-${stamp}`;

  await recordPendingPayment({
    userId: parsed.data.userId,
    tracker,
    orderId: `MM-manual-${stamp}`,
    planId: plan.id,
    amountRupees: plan.price,
  });

  const result = await markPaidAndGrant({
    tracker,
    reference: 'manual',
    raw: { source: 'admin-grant', by: who.id, amount: plan.price },
  });
  if (!result.handled) return { error: 'Could not record that. Nothing was changed.' };

  revalidatePath('/admin/students');
  revalidatePath('/admin');
  return { ok: `${check.name} now has Premium.` };
}

/**
 * Take it away again.
 *
 * Access stops now: the entitlement is switched off rather than deleted, so
 * the row still says which plan they had and when it would have run out.
 *
 * Manual grants are also marked refunded, because those rows are our own
 * bookkeeping and a mistaken grant should not sit in the revenue total or earn
 * a teacher commission forever. A real gateway payment is left exactly as it
 * is: money genuinely arrived, and rewriting that history to switch off access
 * would make the books disagree with the bank.
 */
export async function revokePremiumAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const parsed = Grant.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Unknown student.' };

  const check = await studentOrError(parsed.data.userId);
  if ('error' in check) return { error: check.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from('entitlements')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('user_id', parsed.data.userId);
  if (error) return { error: `Could not switch it off: ${error.message}` };

  await admin
    .from('payments')
    .update({ status: 'refunded' })
    .eq('user_id', parsed.data.userId)
    .eq('status', 'paid')
    .like('tracker', 'MANUAL-%');

  revalidatePath('/admin/students');
  revalidatePath('/admin');
  return { ok: `${check.name} no longer has Premium.` };
}

/**
 * Turn a teacher's link on or off.
 *
 * Off stops the code attributing anybody new. It does not touch the students
 * they already brought or anything they have earned, which is the difference
 * between suspending a link and erasing a working relationship.
 */
export async function setTeacherActiveAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const id = String(formData.get('affiliateId') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Unknown teacher.' };

  const { error } = await createAdminClient().from('affiliates').update({ active }).eq('user_id', id);
  if (error) return { error: `Could not update: ${error.message}` };

  revalidatePath(`/admin/teachers/${id}`);
  revalidatePath('/admin/teachers');
  return { ok: active ? 'Link switched on.' : 'Link switched off.' };
}
