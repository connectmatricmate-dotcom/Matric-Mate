'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { currentRole, emailAllowedAsAdmin } from '@/lib/roles';

/**
 * Everything the admin panel can do. Three actions, all of them privileged.
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
