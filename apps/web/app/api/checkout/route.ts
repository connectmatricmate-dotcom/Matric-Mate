import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkoutUrl, createTracker, isSafepayConfigured } from '@/lib/safepay';
import { recordPendingPayment } from '@/lib/payments';
import { PLANS, planById } from '@/lib/plans';
import { SITE_URL } from '@/lib/site';
import { getUser } from '@/lib/supabase/server';

/**
 * Starts a Safepay hosted checkout and hands the browser a URL to go to.
 *
 * Two things this route will not take from the caller. The **price** comes from
 * PLANS by id, never from the body, or anyone could buy a year for one rupee.
 * The **payer** comes from the session, never from the body, or anyone could
 * buy a subscription for somebody else's account, or worse, attribute their own
 * payment to a stranger. Security checklist, guards 1 and 3.
 */

const Body = z.object({ plan: z.enum(PLANS.map((p) => p.id) as [string, ...string[]]).optional() });

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to start a plan.' }, { status: 401 });
  }

  if (!isSafepayConfigured) {
    return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  const plan = planById(parsed.success ? (parsed.data.plan ?? 'quarter') : 'quarter');

  // Unique per attempt, so a retry after a failure is its own order rather than
  // a duplicate of the last one.
  const orderId = `MM-${plan.id}-${Date.now().toString(36)}`;

  try {
    const tracker = await createTracker({ amountRupees: plan.price, orderId });

    // Written before the student leaves, because nothing in the payment itself
    // says who they are. The webhook joins back to this row.
    await recordPendingPayment({
      userId: user.id,
      tracker,
      orderId,
      planId: plan.id,
      amountRupees: plan.price,
    });

    return NextResponse.json({
      url: checkoutUrl({
        tracker,
        orderId,
        redirectUrl: `${SITE_URL}/checkout/return`,
        cancelUrl: `${SITE_URL}/checkout?cancelled=1&plan=${plan.id}`,
      }),
      orderId,
    });
  } catch (err) {
    console.error('checkout: could not start payment', err);
    return NextResponse.json({ error: 'Could not reach the payment gateway. Try again in a moment.' }, { status: 502 });
  }
}
