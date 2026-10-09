import 'server-only';
import { formatDate, tierOf } from '@matricmate/core';
import { loadRecipient, notify, paymentReceived } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { gateway, onlinePayments } from '@/lib/gateway';
import { BASIC_PLAN, THE_PLAN, planById, type Plan } from '@/lib/plans';
import { planIsActive } from '@/lib/entitlement';
import { closePlanRequests } from '@/lib/plan-requests';

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
 * What is left of the running plan, in milliseconds of the plan being bought.
 *
 * Renewing early adds to the plan rather than restarting it, which is what the
 * old rule did and still does for the same plan. With two prices a change of
 * plan carries its remainder over at its value: ten unused days of Basic
 * (Rs 500) become five of Premium (Rs 1,000), and the other way round they
 * double. A trial's days are free and are not carried. Anything else, a plan
 * that has run out or no plan, starts from today.
 */
function carriedOver(current: { valid_till?: string | null; active?: boolean | null; plan?: string | null } | null, next: Plan): number {
  if (!planIsActive(current)) return 0;
  const remaining = Date.parse(current!.valid_till!) - Date.now();
  const now = tierOf(current!.plan);
  if (now === 'trial') return 0;
  const perMonth = (tier: string) => (tier === 'basic' ? BASIC_PLAN.perMonth : THE_PLAN.perMonth);
  return remaining * (perMonth(now) / perMonth(tierOf(next.id)));
}

export type SettleResult =
  | { handled: true; userId?: string; alreadySettled?: true; validTill?: string }
  | { handled: false; error?: string };

/**
 * Settle a payment and grant access. Safe to run repeatedly.
 *
 * Webhooks are at-least-once, and Safepay retries on any non-2xx, so this will
 * be called again for payments that already settled. Every step is written to
 * be idempotent rather than guarded by a "have we seen this?" flag that can go
 * stale.
 *
 * The two writes, payment paid and plan on, happen in one database
 * transaction (settle_payment, migration 0062), and a failure comes back as
 * `handled: false` with the reason. They were two unchecked writes: a failed
 * second one left revenue counted for a plan that never started, the admin
 * was told it worked, and a retry found the payment paid and granted nothing.
 */
export async function markPaidAndGrant(input: { tracker: string; reference?: string; raw: unknown }): Promise<SettleResult> {
  const admin = createAdminClient();

  const { data: payment, error: readError } = await admin
    .from('payments')
    .select('id, user_id, plan, status, amount')
    .eq('tracker', input.tracker)
    .maybeSingle();

  if (readError) {
    console.error('payments: could not read the payment', input.tracker, readError.message);
    return { handled: false, error: readError.message };
  }
  if (!payment) {
    // A tracker we never issued. Either a stale sandbox test or someone poking
    // the endpoint. Nothing to do, and nothing to grant.
    console.warn('payments: webhook for an unknown tracker', input.tracker);
    return { handled: false };
  }

  /**
   * Already settled, so stop here.
   *
   * This is the guard that makes redelivery safe. Safepay retries, and it also
   * sends more than one success-shaped event for a single payment
   * (authorization.succeeded then payment.succeeded). Without this, each one
   * extended the plan by another period and posted another receipt: a student
   * who paid for three months quietly got six. settle_payment checks it again
   * under a row lock, for two deliveries arriving at the same moment.
   *
   * A genuine second purchase is a different tracker, so it is unaffected.
   */
  if (payment.status === 'paid') {
    return { handled: true, userId: payment.user_id ?? undefined, alreadySettled: true };
  }

  const plan = planById(payment.plan ?? 'monthly');
  // A plan the admin switched on by hand is recorded as one, not as a card payment.
  const source = input.tracker.startsWith('MANUAL-') ? 'manual' : 'safepay';

  /*
   * The end date is worked out here, where the plan rules live, from the plan
   * as it stands. settle_payment writes it only if that plan has not changed
   * since it was read, and says "stale" otherwise, so a second payment
   * settling at the same moment is extended from, not overwritten. Three
   * tries is far more than that race ever needs.
   */
  let validTill = '';
  let userId: string | undefined;
  let settled = false;
  for (let attempt = 0; attempt < 3 && !settled; attempt++) {
    let seen: string | null = null;
    if (payment.user_id) {
      const { data: current, error: entError } = await admin
        .from('entitlements')
        .select('valid_till, active, plan')
        .eq('user_id', payment.user_id)
        .maybeSingle();
      if (entError) {
        console.error('payments: could not read the plan', input.tracker, entError.message);
        return { handled: false, error: entError.message };
      }
      seen = current?.valid_till ?? null;
      validTill = new Date(Date.now() + carriedOver(current, plan) + plan.months * 30 * 864e5).toISOString();
    }

    const { data, error } = await admin.rpc('settle_payment', {
      p_tracker: input.tracker,
      p_reference: input.reference ?? null,
      p_raw: input.raw ?? null,
      p_plan: plan.id,
      p_valid_till: validTill || null,
      p_seen_valid_till: seen,
      p_source: source,
    });
    if (error) {
      console.error('payments: settle failed', input.tracker, error.message);
      return { handled: false, error: error.message };
    }
    const out = (data ?? {}) as { outcome?: string; user_id?: string | null };
    if (out.outcome === 'already') return { handled: true, userId: out.user_id ?? undefined, alreadySettled: true };
    if (out.outcome === 'unknown') return { handled: false };
    if (out.outcome === 'granted') {
      settled = true;
      userId = out.user_id ?? undefined;
    }
  }
  if (!settled) {
    console.error('payments: plan kept changing while settling', input.tracker);
    return { handled: false, error: 'The plan changed while it was being saved. Try again.' };
  }

  if (!userId) return { handled: true };

  // Premium is on, so a request for it is answered (lib/plan-requests.ts).
  if (plan.ai) await closePlanRequests(userId);

  /*
   * Through the dispatcher, not straight into the table. A receipt should
   * reach the student wherever they are: the inbox always, a push if the app
   * is installed, an email because this is the one message they may want to
   * keep, and WhatsApp once that is switched on. It was a hardcoded English
   * row, which nobody noticed because until recently no app read the table.
   */
  // With the address: loaded without it, the email channel had nobody to
  // write to and every receipt email was skipped.
  // The plan is already on by here, so a receipt that fails to send must not
  // turn a done grant into a reported failure. Logged, not thrown.
  try {
    const to = await loadRecipient(userId, { email: true });
    if (to) {
      const date = formatDate(validTill, to.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' });
      // The amount and reference go into the emailed receipt only.
      await notify(
        to,
        paymentReceived(date, plan.id === 'basic' ? 'basic' : 'premium', { amount: Number(payment.amount ?? plan.price), reference: input.tracker }),
      );
    }
  } catch (err) {
    console.error('payments: receipt not sent', input.tracker, err);
  }

  return { handled: true, userId, validTill };
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

/**
 * Asks the gateway what happened, and settles the payment if it really paid.
 *
 * The webhook is meant to do this. On this account it never has: not one live
 * payment has ever been settled by a delivered webhook, and the student is left
 * watching a screen that says "checking" while Safepay's own records show the
 * money arrived, the fee taken and the receipt issued. A webhook that has to be
 * configured correctly by somebody else is not a thing to make access depend on.
 *
 * So this runs on the way back from checkout, and the webhook becomes the fast
 * path rather than the only one. Whichever gets there first wins; the second is
 * a no-op, because markPaidAndGrant already refuses to settle a payment twice.
 *
 * Three things make this safe to call from a page a student can reload:
 *
 *   · the payment must already exist here, with a user_id we wrote before they
 *     left, so nobody can conjure one by inventing a reference
 *   · it must belong to the caller, checked again here even though the page
 *     read it under RLS, because defence that only exists in one layer is not
 *     defence
 *   · the gateway's amount must match what the plan actually costs, so a paid
 *     100-rupee tracker cannot be redeemed against a 9,000-rupee plan
 */
/**
 * The same settlement, initiated by the server rather than a returning payer.
 *
 * PayFast's notification is a doorbell without a checkable signature, so the
 * route that receives it cannot pass a userId it never had. The payment row
 * itself says whose it is; everything else, existence, amount, single
 * settlement, is checked exactly as in confirmWithGateway below.
 */
export async function reconcilePayment(tracker: string) {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from('payments')
    .select('user_id, status')
    .eq('tracker', tracker)
    .maybeSingle();
  if (!payment?.user_id || payment.status === 'paid') return;
  await confirmWithGateway({ tracker, userId: payment.user_id }).catch((err) => {
    console.error('payments: reconcile failed', tracker, err);
  });
}

export async function confirmWithGateway(input: { tracker: string; userId: string }) {
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from('payments')
    .select('id, user_id, plan, amount, status')
    .eq('tracker', input.tracker)
    .maybeSingle();

  if (!payment) return { settled: false as const, reason: 'unknown tracker' };
  if (payment.status === 'paid') return { settled: true as const, alreadySettled: true };
  if (payment.user_id !== input.userId) {
    console.warn('payments: confirm attempted by the wrong account', input.tracker);
    return { settled: false as const, reason: 'not yours' };
  }

  // A test gateway's "paid" is not money: on the production site it grants
  // nothing. See onlinePayments in lib/gateway.
  if (!onlinePayments()) return { settled: false as const, reason: 'online payments are off' };

  const status = await gateway.getPaymentStatus(input.tracker);
  if (status.kind !== 'paid') return { settled: false as const, reason: status.kind };

  const expected = payment.amount ?? planById(payment.plan ?? 'monthly').price;
  if (status.amountRupees !== expected) {
    // Never settle on a mismatch. It means the tracker was created for one
    // thing and paid for another, and guessing which is right is how a student
    // gets a year of Premium for the price of a month.
    console.error('payments: amount mismatch on confirm', {
      tracker: input.tracker,
      expected,
      got: status.amountRupees,
    });
    return { settled: false as const, reason: 'amount mismatch' };
  }

  const result = await markPaidAndGrant({
    tracker: input.tracker,
    reference: status.receipt,
    raw: { source: 'gateway-confirm', status },
  });
  return { settled: Boolean(result.handled) };
}
