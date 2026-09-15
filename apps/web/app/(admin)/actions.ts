'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { currentRole, emailAllowedAsAdmin } from '@/lib/roles';
import { markPaidAndGrant } from '@/lib/payments';
import { PLANS, THE_PLAN, planById } from '@/lib/plans';

/**
 * Everything the admin panel can do. All of it privileged.
 *
 * Each one re-checks who is calling. The layout guard is what stops the page
 * rendering, and a server action is a public HTTP endpoint that does not go
 * through the layout: anybody who knows the action id can post to it. Guarding
 * only the page would leave "create an account with any role" open to the
 * internet.
 */

export type AdminState = {
  error?: string;
  ok?: string;
  code?: string;
  /**
   * What was typed, handed back with an error. React 19 resets an
   * uncontrolled form once its action returns, so without this a rejected
   * teacher form came back empty and every field had to be typed again.
   */
  values?: Record<string, string>;
};

/** The text fields of a submission, for handing back with an error. */
const typed = (formData: FormData): Record<string, string> => {
  const values: Record<string, string> = {};
  formData.forEach((v, k) => {
    // `$ACTION_` keys are React's own bookkeeping, not fields.
    if (typeof v === 'string' && !k.startsWith('$')) values[k] = v;
  });
  return values;
};

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
  // Adnan sets this and hands it over himself, and the teacher changes it
  // under Settings once they are in.
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.', values: typed(formData) };
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
    return {
      error: already ? 'An account with that email already exists.' : `Could not create the account: ${authError?.message}`,
      values: typed(formData),
    };
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
    return { error: `Could not mint a referral code: ${codeError?.message}`, values: typed(formData) };
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
    return { error: `Could not save the teacher: ${rowError.message}`, values: typed(formData) };
  }

  // Last, because it is what decides where they land when they sign in. A
  // teacher whose role never got set would be sent to the student dashboard
  // and hit the paywall.
  const { error: roleError } = await admin.from('profiles').update({ role: 'affiliate' }).eq('id', userId);
  if (roleError) {
    await admin.from('affiliates').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    return { error: `Could not set the role: ${roleError.message}`, values: typed(formData) };
  }

  revalidatePath('/admin/teachers');
  return { ok: `${t.fullName} is set up.`, code };
}

const Payout = z.object({
  affiliateId: z.string().uuid(),
  amount: z.coerce.number().int('Enter whole rupees.').positive('Enter an amount above zero.').max(10_000_000),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

const rs = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

/** A date as the admin reads it: "15 Oct 2026", in Karachi. */
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });

/** Record money actually handed over, so both sides read the same number. */
export async function recordPayoutAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const parsed = Payout.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the amount.' };

  const admin = createAdminClient();
  const { data: teacher } = await admin.from('affiliates').select('full_name').eq('user_id', parsed.data.affiliateId).maybeSingle();
  if (!teacher) return { error: 'Unknown teacher.' };

  const { error } = await admin.from('affiliate_payouts').insert({
    affiliate_id: parsed.data.affiliateId,
    amount: parsed.data.amount,
    note: blank(parsed.data.note),
    recorded_by: who.id,
  });
  if (error) return { error: `Could not record the payout: ${error.message}` };

  revalidatePath(`/admin/teachers/${parsed.data.affiliateId}`);
  revalidatePath('/admin/teachers');
  return { ok: `Recorded ${rs(parsed.data.amount)} paid to ${teacher.full_name}. It shows on their dashboard now.` };
}

/** How long a payout stays deletable: long enough to catch a typo, short
 *  enough that a teacher never watches money they were shown disappear. */
const PAYOUT_UNDO_MS = 24 * 3600 * 1000;

/**
 * Take back a payout recorded by mistake: a wrong amount, the wrong teacher,
 * the same transfer entered twice. Only within a day of recording it, checked
 * in the same statement that deletes, so an older row cannot slip through.
 */
export async function deletePayoutAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const id = String(formData.get('payoutId') ?? '');
  const affiliateId = String(formData.get('affiliateId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(affiliateId)) return { error: 'Unknown payout.' };

  const cutoff = new Date(Date.now() - PAYOUT_UNDO_MS).toISOString();
  const { data, error } = await createAdminClient()
    .from('affiliate_payouts')
    .delete()
    .eq('id', id)
    .eq('affiliate_id', affiliateId)
    .gt('at', cutoff)
    .select('amount');
  if (error) return { error: `Could not delete it: ${error.message}` };
  if (!data?.length) return { error: 'A payout can only be deleted on the day it was recorded. This one stays.' };

  revalidatePath(`/admin/teachers/${affiliateId}`);
  revalidatePath('/admin/teachers');
  return { ok: `Deleted the payout of ${rs(Number(data[0].amount))}.` };
}

const Grant = z.object({
  userId: z.string().uuid('Unknown student.'),
  planId: z.enum(PLANS.map((p) => p.id) as [string, ...string[]]).optional(),
  /** Which button was pressed, for the wording of the answer only. */
  op: z.enum(['give', 'upgrade', 'extend', 'revoke']).optional(),
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
 *
 * "Add a month" is this same action with the plan the student already has:
 * markPaidAndGrant extends from the current end date, so a month is added to
 * it rather than starting again from today.
 *
 * The same plan for the same student twice within two minutes is one grant
 * (record_manual_payment, migration 0062). A second press, a double tap on a
 * slow phone or the page resubmitted, used to mint a second payment: two
 * months, double the revenue and double the teacher's commission.
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

  const admin = createAdminClient();
  const { data: slot, error: slotError } = await admin.rpc('record_manual_payment', {
    p_user: parsed.data.userId,
    p_plan: plan.id,
    p_amount: plan.price,
    p_tracker: `MANUAL-${stamp}`,
    p_order: `MM-manual-${stamp}`,
  });
  if (slotError) return { error: `Could not record that. Nothing was changed. (${slotError.message})` };

  const recorded = (slot ?? {}) as { state?: 'new' | 'pending' | 'done'; tracker?: string; at?: string };
  if (recorded.state === 'done') {
    return {
      error: `${plan.name} was already given to ${check.name} a moment ago, so nothing was added twice. To add another month, wait two minutes.`,
    };
  }
  if (!recorded.tracker) return { error: 'Could not record that. Nothing was changed.' };

  const result = await markPaidAndGrant({
    tracker: recorded.tracker,
    reference: 'manual',
    raw: { source: 'admin-grant', by: who.id, amount: plan.price },
  });
  if (!result.handled) {
    return { error: `Could not switch ${plan.name} on for ${check.name}. Press the button again to retry.${result.error ? ` (${result.error})` : ''}` };
  }
  if (result.alreadySettled) {
    return { error: `${plan.name} was already given to ${check.name} a moment ago, so nothing was added twice.` };
  }

  revalidatePath('/admin/students');
  revalidatePath(`/admin/students/${parsed.data.userId}`);
  revalidatePath('/admin');
  const until = result.validTill ? ` until ${day(result.validTill)}` : '';
  return {
    ok:
      parsed.data.op === 'extend'
        ? `Added a month. ${check.name} now has ${plan.name}${until}.`
        : `${check.name} now has ${plan.name}${until}. ${rs(plan.price)} is recorded as paid.`,
  };
}

/**
 * Take it away again.
 *
 * Access stops now: the entitlement is switched off rather than deleted, so
 * the row still says which plan they had and when it would have run out.
 *
 * The payment behind the current plan is marked refunded when it was given
 * from this page, because those rows are our own bookkeeping and a mistaken
 * grant should not sit in the revenue total or earn a teacher commission
 * forever. Only that one: it marked every manual payment the student ever
 * had, so revoking a student who had paid for six months took six months out
 * of the revenue and out of their teacher's commission. A real gateway
 * payment is left exactly as it is: money genuinely arrived, and rewriting
 * that history to switch off access would make the books disagree with the
 * bank.
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

  revalidatePath('/admin/students');
  revalidatePath(`/admin/students/${parsed.data.userId}`);
  revalidatePath('/admin');

  // The latest paid payment is the one that set the current end date. If it
  // came through the gateway there is nothing of ours to reverse.
  const { data: latest, error: readError } = await admin
    .from('payments')
    .select('id, tracker, amount, at')
    .eq('user_id', parsed.data.userId)
    .eq('status', 'paid')
    .order('at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let refundError = readError?.message;
  let refunded = '';
  if (!readError && latest?.tracker?.startsWith('MANUAL-')) {
    const { error: e } = await admin.from('payments').update({ status: 'refunded' }).eq('id', latest.id).eq('status', 'paid');
    if (e) refundError = e.message;
    else refunded = ` The ${rs(Number(latest.amount ?? 0))} recorded on ${day(latest.at)} is marked refunded.`;
  }

  // Access is already off by here, so say exactly that: a grant still counted
  // as revenue, and towards a teacher's commission, is worth knowing about.
  if (refundError) {
    return {
      error: `${check.name} no longer has a plan, but the payment could not be marked refunded: ${refundError}`,
    };
  }
  return { ok: `${check.name} no longer has a plan.${refunded}` };
}

/**
 * The revision sheet a report is about, thrown away so the next student who
 * opens it gets a freshly written one.
 *
 * Sheets are cached once per chapter and language for every student
 * (cheat_sheets, see api/ai/cheat-sheet), so a wrong one stayed wrong for
 * everybody until somebody ran SQL. The report kept the start of the sheet it
 * was about, which picks the right language when there are two; when it
 * matches neither, that sheet has already been replaced and nothing is
 * deleted.
 */
export async function resetSheetAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const id = String(formData.get('reportId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Unknown report.' };

  const admin = createAdminClient();
  const { data: report } = await admin.from('ai_reports').select('surface, ref, excerpt').eq('id', id).maybeSingle();
  if (!report || report.surface !== 'sheet' || !report.ref) return { error: 'This report is not about a revision sheet.' };

  const { data: sheets, error } = await admin.from('cheat_sheets').select('medium, body').eq('chapter_id', report.ref);
  if (error) return { error: `Could not read the sheet: ${error.message}` };
  const start = (report.excerpt ?? '').trim().slice(0, 160);
  const match = ((sheets ?? []) as { medium: string; body: string }[]).find((s) => start && s.body.trim().startsWith(start));
  if (!match) return { ok: 'That sheet has already been replaced. Nothing to delete.' };

  const { error: delError } = await admin.from('cheat_sheets').delete().eq('chapter_id', report.ref).eq('medium', match.medium);
  if (delError) return { error: `Could not delete the sheet: ${delError.message}` };

  revalidatePath('/admin/reports');
  return { ok: 'Sheet deleted. The next student who opens it gets a newly written one.' };
}

/**
 * A reported AI answer, read (see /admin/reports).
 */
export async function markReportSeenAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };
  const id = String(formData.get('reportId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Unknown report.' };
  const { error } = await createAdminClient().from('ai_reports').update({ status: 'seen' }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };
  revalidatePath('/admin/reports');
  return { ok: 'Marked as seen.' };
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

/**
 * Deleting a student's account for them, on request: the email or the call
 * that /delete-account offers someone who cannot sign in to do it themselves.
 * The same deletion as the student's own button (api/account/delete): the
 * login account goes, and everything of theirs with it by cascade; payments
 * stay with no one attached, still earning their teacher's commission
 * (payments.referred_by). Recorded in account_deletions as done by the admin.
 */
export async function deleteStudentAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const who = await requireAdmin();
  if ('error' in who) return { error: who.error };

  const parsed = z.object({ userId: z.string().uuid('Unknown student.') }).safeParse({ userId: formData.get('userId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Unknown student.' };
  const check = await studentOrError(parsed.data.userId);
  if ('error' in check) return { error: check.error };

  const admin = createAdminClient();
  const [{ count: paid }, { data: profile }] = await Promise.all([
    admin.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', parsed.data.userId).eq('status', 'paid'),
    admin.from('profiles').select('referred_by').eq('id', parsed.data.userId).maybeSingle(),
  ]);
  await admin.from('account_deletions').insert({ had_paid: (paid ?? 0) > 0, referred: !!profile?.referred_by, via: 'admin' });

  const { error } = await admin.auth.admin.deleteUser(parsed.data.userId);
  if (error) return { error: `Could not delete the account: ${error.message}` };

  revalidatePath('/admin/students');
  revalidatePath('/admin');
  // Their page no longer exists, so the answer is given on the list.
  redirect('/admin/students?deleted=1');
}
