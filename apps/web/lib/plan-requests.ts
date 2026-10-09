import 'server-only';
import { tierOf } from '@matricmate/core';
import { planIsActive } from '@/lib/entitlement';
import { PAY_WHATSAPP, accountLines } from '@/lib/manual-pay';
import { notify, planRequested } from '@/lib/notify';
import { emailStaff } from '@/lib/notify/channels/email';
import { THE_PLAN, rupees } from '@/lib/plans';
import { SITE_URL } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * A student asking for Premium while plans are switched on by hand.
 *
 * Pressing the Premium button with no gateway live lands here: the request is
 * recorded, the team is emailed at once (the promise to the student is "within
 * 5 minutes", which only holds if somebody hears about it), and the student is
 * sent the payment details by email. Giving Premium from the admin pages
 * closes the request (closePlanRequests, called from markPaidAndGrant).
 *
 * Everything here uses the server key. The caller has already worked out who
 * the student is from their session or access token.
 */

export type PlanRequest = { id: string; createdAt: string };

export type RequestOutcome =
  | { state: 'requested' | 'pending'; request: PlanRequest }
  | { state: 'already' }
  | { state: 'staff' }
  | { state: 'error' };

const at = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' });

/** The student's open request, if there is one. */
export async function openPlanRequest(userId: string): Promise<PlanRequest | null> {
  const { data, error } = await createAdminClient()
    .from('plan_requests')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) console.error('plan-requests: read failed', error.message);
  return data ? { id: String(data.id), createdAt: String(data.created_at) } : null;
}

/**
 * Ask for Premium. Pressing again while a request is open answers with that
 * one: no second row, no second email to the team.
 */
export async function requestPremium(userId: string, via: 'web' | 'app'): Promise<RequestOutcome> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: ent }] = await Promise.all([
    admin.from('profiles').select('name, phone, role').eq('id', userId).maybeSingle(),
    admin.from('entitlements').select('active, valid_till, plan').eq('user_id', userId).maybeSingle(),
  ]);
  if (profile?.role && profile.role !== 'student') return { state: 'staff' };
  if (planIsActive(ent) && tierOf(ent?.plan) === 'premium') return { state: 'already' };

  const open = await openPlanRequest(userId);
  if (open) return { state: 'pending', request: open };

  const { data, error } = await admin.from('plan_requests').insert({ user_id: userId, plan: THE_PLAN.id, via }).select('id, created_at').single();
  if (error) {
    // Two presses at once: the unique index let one through, which is the one to report.
    if (error.code === '23505') {
      const raced = await openPlanRequest(userId);
      if (raced) return { state: 'pending', request: raced };
    }
    console.error('plan-requests: insert failed', error.message);
    return { state: 'error' };
  }
  const request = { id: String(data.id), createdAt: String(data.created_at) };

  // Both are side effects of the request and must not fail it: logged inside.
  const { data: auth } = await admin.auth.admin.getUserById(userId);
  const email = auth?.user?.email ?? null;
  await Promise.all([
    notify(userId, planRequested({ amount: rupees(THE_PLAN.price), accounts: accountLines(), whatsapp: PAY_WHATSAPP })),
    emailStaff(
      `Premium request: ${profile?.name?.trim() || email || 'a student'}`,
      [
        `${profile?.name?.trim() || 'A student'} asked for Premium (${rupees(THE_PLAN.price)}) on ${at(request.createdAt)}, from the ${via === 'app' ? 'Android app' : 'website'}.`,
        `Phone: ${profile?.phone || 'not given'}\nEmail: ${email || 'not given'}`,
        via === 'app'
          ? 'They asked in the Android app, which cannot show the payment details. They have been emailed them; message them on WhatsApp as well.'
          : 'They have been shown the payment details. Switch Premium on when their screenshot arrives on WhatsApp.',
      ].join('\n\n'),
      { label: 'Open plan requests', href: `${SITE_URL}/admin/follow-up` },
    ),
  ]).catch((e) => console.error('plan-requests: telling someone failed', e));

  return { state: 'requested', request };
}

/** Premium was given: the student's open request is answered. */
export async function closePlanRequests(userId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from('plan_requests')
    .update({ status: 'done', handled_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (error) console.error('plan-requests: close failed', error.message);
}

/** Set aside without giving a plan: a test, a duplicate, nobody ever paid. */
export async function dismissPlanRequest(id: string): Promise<boolean> {
  const { error } = await createAdminClient()
    .from('plan_requests')
    .update({ status: 'dismissed', handled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) console.error('plan-requests: dismiss failed', error.message);
  return !error;
}
