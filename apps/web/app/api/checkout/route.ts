import { NextResponse } from 'next/server';
import { z } from 'zod';
import { gateway } from '@/lib/gateway';
import { recordPendingPayment } from '@/lib/payments';
import { PLANS, THE_PLAN, planById } from '@/lib/plans';
import { SITE_URL } from '@/lib/site';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Starts a Safepay hosted checkout and hands the browser a URL to go to.
 *
 * Two things this route will not take from the caller. The **price** comes from
 * PLANS by id, never from the body, or anyone could buy a year for one rupee.
 * The **payer** comes from the session, never from the body, or anyone could
 * buy a subscription for somebody else's account, or worse, attribute their own
 * payment to a stranger. Security checklist, guards 1 and 3.
 */

const Body = z.object({
  plan: z.enum(PLANS.map((p) => p.id) as [string, ...string[]]).optional(),
});

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to start a plan.' }, { status: 401 });
  }

  if (!gateway.isConfigured) {
    return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  const plan = planById(parsed.success ? (parsed.data.plan ?? THE_PLAN.id) : THE_PLAN.id);

  /**
   * No phone number is asked for any more.
   *
   * It was collected because Safepay refuses to mint a guest session without
   * one, and that session was supposed to pin the payer's email at checkout. It
   * does not: the hosted page reads `auth_token` only when there is no tracker,
   * which is the subscribe flow, so on this route it was ignored. With the
   * session gone the number had no remaining job, and asking a fifteen year old
   * for their mobile to no purpose is a field that only loses conversions.
   */
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle();

  // Unique per attempt, so a retry after a failure is its own order rather than
  // a duplicate of the last one.
  const orderId = `MM-${plan.id}-${Date.now().toString(36)}`;

  const email = user.email ?? '';
  const name = profile?.name?.trim() || (user.user_metadata?.name as string | undefined)?.trim() || email.split('@')[0] || 'Student';

  try {
    /**
     * Everything gateway-shaped happens behind this one call: reserving the
     * payment, whatever directory record the provider keeps, and building the
     * URL. This route's job is deciding who is paying and for what, which is
     * the part that stays true whoever processes the money.
     *
     * The payer types their own email on the provider's page and we cannot
     * prefill it. The payment is tied to the account by the pending row below,
     * keyed on the reference, never by what they type.
     */
    const { url, reference } = await gateway.startCheckout({
      amountRupees: plan.price,
      orderId,
      redirectUrl: `${SITE_URL}/checkout/return`,
      cancelUrl: `${SITE_URL}/checkout?cancelled=1&plan=${plan.id}`,
      payer: { userId: user.id, email, name },
    });

    // Written before the student leaves, because nothing in the payment itself
    // says who they are. The webhook joins back to this row.
    await recordPendingPayment({
      userId: user.id,
      tracker: reference,
      orderId,
      planId: plan.id,
      amountRupees: plan.price,
    });

    return NextResponse.json({ url, orderId });
  } catch (err) {
    console.error('checkout: could not start payment', err);
    return NextResponse.json({ error: 'Could not reach the payment gateway. Try again in a moment.' }, { status: 502 });
  }
}
