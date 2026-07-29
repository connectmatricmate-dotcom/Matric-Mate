import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { planById } from '@/lib/plans';

/**
 * Money, written server-side only.
 *
 * The shape of the problem: Safepay knows about a tracker, and we know which
 * student asked for it. Nothing in the payment itself identifies the payer, so
 * we write our own row at checkout time and the webhook joins back to it. That
 * is also what gives us something to reconcile against when a student says they
 * paid and the entitlement did not arrive.
 *
 * Everything here uses the admin client, because `payments` and `entitlements`
 * have no write policy at all: RLS lets a student read their own rows and
 * nothing more. A student who can write their own entitlement makes the paywall
 * a decoration.
 */

/** Called when checkout starts, before the student ever reaches Safepay. */
export async function recordPendingPayment(input: {
  userId: string;
  tracker: string;
  orderId: string;
  planId: string;
  amountRupees: number;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('payments').insert({
    user_id: input.userId,
    tracker: input.tracker,
    order_id: input.orderId,
    plan: input.planId,
    amount: input.amountRupees,
    currency: 'PKR',
    status: 'pending',
  });

  // A failure here must not block the payment: the student can still pay, and
  // the webhook will tell us about it. Loud in the log, silent to the student.
  if (error) console.error('payments: could not record pending row', error.message);
}

/**
 * Settle a payment and grant access. Safe to run repeatedly.
 *
 * Webhooks are at-least-once, and Safepay retries on any non-2xx, so this will
 * be called again for payments that already settled. Every step is written to
 * be idempotent rather than guarded by a "have we seen this?" flag that can go
 * stale.
 */
export async function markPaidAndGrant(input: { tracker: string; reference?: string; raw: unknown }) {
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from('payments')
    .select('id, user_id, plan, status')
    .eq('tracker', input.tracker)
    .maybeSingle();

  if (!payment) {
    // A tracker we never issued. Either a stale sandbox test or someone poking
    // the endpoint. Nothing to do, and nothing to grant.
    console.warn('payments: webhook for an unknown tracker', input.tracker);
    return { handled: false as const };
  }

  /**
   * Already settled, so stop here.
   *
   * This is the guard that makes redelivery safe. Safepay retries, and it also
   * sends more than one success-shaped event for a single payment
   * (authorization.succeeded then payment.succeeded). Without this, each one
   * extended the plan by another period and posted another receipt: a student
   * who paid for three months quietly got six.
   *
   * A genuine second purchase is a different tracker, so it is unaffected.
   */
  if (payment.status === 'paid') {
    return { handled: true as const, userId: payment.user_id ?? undefined, alreadySettled: true };
  }

  await admin
    .from('payments')
    .update({ status: 'paid', reference: input.reference ?? null, raw: input.raw as never })
    .eq('id', payment.id);

  if (!payment.user_id) return { handled: true as const };

  const plan = planById(payment.plan ?? 'monthly');

  // Extend from whichever is later: an existing expiry, or now. Renewing early
  // should add to the plan, not restart it and quietly lose the paid remainder.
  const { data: current } = await admin
    .from('entitlements')
    .select('valid_till, active')
    .eq('user_id', payment.user_id)
    .maybeSingle();

  const existing = current?.active && current.valid_till ? new Date(current.valid_till).getTime() : 0;
  const from = Math.max(existing, Date.now());
  const validTill = new Date(from + plan.months * 30 * 864e5).toISOString();

  await admin.from('entitlements').upsert(
    { user_id: payment.user_id, active: true, plan: plan.id, valid_till: validTill, source: 'safepay' },
    { onConflict: 'user_id' }
  );

  await admin.from('notifications').insert({
    user_id: payment.user_id,
    kind: 'payment',
    title: 'Payment received',
    body: `Premium is active until ${new Date(validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    target: 'payments',
  });

  return { handled: true as const, userId: payment.user_id };
}

/** A payment that did not go through. Access is untouched. */
export async function markPaymentStatus(input: {
  tracker: string;
  status: 'failed' | 'refunded' | 'cancelled';
  raw: unknown;
}) {
  const admin = createAdminClient();
  await admin
    .from('payments')
    .update({ status: input.status, raw: input.raw as never })
    .eq('tracker', input.tracker);

  // A refund takes access away; a failure never had it to take.
  if (input.status === 'refunded') {
    const { data: payment } = await admin
      .from('payments')
      .select('user_id')
      .eq('tracker', input.tracker)
      .maybeSingle();
    if (payment?.user_id) {
      await admin
        .from('entitlements')
        .update({ active: false, valid_till: null })
        .eq('user_id', payment.user_id);
    }
  }
}
