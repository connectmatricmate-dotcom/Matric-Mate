import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkoutUrl, createGuestSession, createTracker, isSafepayConfigured } from '@/lib/safepay';
import { ensureSafepayCustomer } from '@/lib/safepay-customer';
import { recordPendingPayment } from '@/lib/payments';
import { PLANS, planById } from '@/lib/plans';
import { SITE_URL } from '@/lib/site';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toE164, validateMobile } from '@/lib/validation';

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
  // Re-validated here and not merely in the form, because a request can arrive
  // without ever passing through one.
  phone: z.string().trim().optional(),
});

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

  /**
   * Safepay will not create a customer or a guest session without a phone
   * number, and the guest session is what pins the payer's email. So the number
   * is required, and reused from the profile once given.
   */
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('phone, name')
    .eq('id', user.id)
    .maybeSingle();

  const supplied = parsed.success ? parsed.data.phone : undefined;
  const phoneError = supplied ? validateMobile(supplied) : null;
  if (supplied && phoneError) {
    return NextResponse.json({ error: phoneError }, { status: 400 });
  }

  const phone = supplied ? toE164(supplied) : (profile?.phone ?? null);
  if (!phone) {
    // The form asks for it; this is for anything that did not.
    return NextResponse.json({ error: 'A mobile number is needed to pay.', needsPhone: true }, { status: 400 });
  }
  if (supplied && phone !== profile?.phone) {
    await admin.from('profiles').update({ phone }).eq('id', user.id);
  }

  // Unique per attempt, so a retry after a failure is its own order rather than
  // a duplicate of the last one.
  const orderId = `MM-${plan.id}-${Date.now().toString(36)}`;

  const email = user.email ?? '';
  const name = profile?.name?.trim() || (user.user_metadata?.name as string | undefined)?.trim() || email.split('@')[0] || 'Student';

  try {
    /**
     * The signed guest session is what fixes the email on Safepay's page: the
     * address lives in a claim Safepay signed, so whatever the payer types, the
     * payment is attributed to the account that started it. Without it, someone
     * could pay under one address and expect access on another, and support
     * would have no way to tell which was meant.
     *
     * Both of these run alongside the tracker rather than before it, because
     * neither is worth delaying checkout for, and neither is fatal if it fails.
     */
    const [tracker, authToken] = await Promise.all([
      // The only one allowed to fail the request: with no tracker there is
      // nothing to pay against.
      createTracker({ amountRupees: plan.price, orderId }),
      createGuestSession({ email, name, phone }).catch(() => null),
      ensureSafepayCustomer({ userId: user.id, email, name, phone }).catch(() => null),
    ]);

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
        authToken,
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
