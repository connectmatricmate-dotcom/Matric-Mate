import { NextResponse } from 'next/server';
import { checkoutUrl, createTracker, isSafepayConfigured } from '@/lib/safepay';
import { PLANS, planById } from '@/lib/plans';
import { SITE_URL } from '@/lib/site';

/**
 * Starts a Safepay hosted checkout and hands the browser a URL to go to.
 *
 * The price is looked up from PLANS by id and never read from the request. A
 * body that could name its own amount would let anyone buy a year for one
 * rupee, which is the oldest bug in online payments.
 */
export async function POST(request: Request) {
  if (!isSafepayConfigured) {
    return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 });
  }

  let planId = 'quarter';
  try {
    const body = (await request.json()) as { plan?: string };
    if (body.plan && PLANS.some((p) => p.id === body.plan)) planId = body.plan;
  } catch {
    // no body, keep the default
  }

  const plan = planById(planId);
  // Unique per attempt, so a retry after a failure is its own order rather than
  // a duplicate of the last one.
  const orderId = `MM-${plan.id}-${Date.now().toString(36)}`;

  try {
    const tracker = await createTracker({
      amountRupees: plan.price,
      orderId,
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
