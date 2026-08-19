'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { currentRole, emailAllowedAsAdmin } from '@/lib/roles';
import { markPaidAndGrant, recordPendingPayment } from '@/lib/payments';
import { PLANS, planById } from '@/lib/plans';

/**
 * Everything the admin panel can do. Four actions, all of them privileged.
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
  email: z.string().trim().toLowerCase().email('Enter the student’s email address.'),
  planId: z.enum(PLANS.map((p) => p.id) as [string, ...string[]]),
  amount: z.coerce.number().int('Enter whole rupees.').min(0).max(10_000_000),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

  const admin = createAdminClient();
  const plan = planById(parsed.data.planId);

  /*
   * Find the account by email. There is no email column on `profiles`, so this
   * has to go through the auth admin API, which is paged: reading page one and
   * calling it a search works until the 201st student signs up and then fails
   * silently, telling Adnan an account does not exist while he is looking at
   * the person who owns it. Page until found.
   */
  let user: { id: string } | undefined;
  for (let page = 1; page <= 50 && !user; page++) {
    const { data: found, error: lookupError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (lookupError) return { error: `Could not look that account up: ${lookupError.message}` };
    user = found.users.find((u) => u.email?.toLowerCase() === parsed.data.email);
    if (found.users.length < 200) break;
  }
  if (!user) return { error: 'No account with that email. They need to sign up first.' };

  const { data: profile } = await admin.from('profiles').select('role, name').eq('id', user.id).maybeSingle();
  if (profile?.role && profile.role !== 'student') {
    // A plan buys chapters and a tutor. Staff have neither screen.
    return { error: 'That account is a teacher or an administrator, not a student.' };
  }

  const amount = parsed.data.amount || plan.price;
  const stamp = Date.now().toString(36);
  const tracker = `MANUAL-${stamp}`;

  await recordPendingPayment({
    userId: user.id,
    tracker,
    orderId: `MM-manual-${stamp}`,
    planId: plan.id,
    amountRupees: amount,
  });

  const result = await markPaidAndGrant({
    tracker,
    reference: `manual by admin`,
    raw: { source: 'admin-grant', by: who.id, note: parsed.data.note || null, amount },
  });

  if (!result.handled) return { error: 'Could not record that. Nothing was changed.' };

  revalidatePath('/admin');
  return {
    ok: `${profile?.name || parsed.data.email} now has ${plan.name} Premium. Rs ${amount.toLocaleString('en-PK')} recorded.`,
  };
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
