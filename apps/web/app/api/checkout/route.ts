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
  /** Only sent when we do not already have one on the profile. Loosely typed
   *  here and validated properly on the client; the worst a bad one does is
   *  cost the prefill, which is why it never blocks a payment. */
  phone: z.string().trim().max(24).optional(),
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
  const { data: profile } = await admin
    .from('profiles')
    .select('name,role,phone,safepay_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  /*
   * Students only. A subscription buys chapters and a tutor, and neither a
   * teacher on the referral programme nor an administrator has any use for
   * one. Checked here as well as on the page, because this endpoint starts a
   * real payment and is reachable without ever loading the page.
   */
  if (profile?.role && profile.role !== 'student') {
    return NextResponse.json({ error: 'not_a_student' }, { status: 403 });
  }

  // Unique per attempt, so a retry after a failure is its own order rather than
  // a duplicate of the last one.
  const orderId = `MM-${plan.id}-${Date.now().toString(36)}`;

  const email = user.email ?? '';
  const name = profile?.name?.trim() || (user.user_metadata?.name as string | undefined)?.trim() || email.split('@')[0] || 'Student';

  /*
   * A phone number, once, and then never again.
   *
   * Safepay will not create the payer record without one. Their docs say it is
   * optional and their API disagrees: omitted, empty and null all answer 400
   * "phone_number: the phone number supplied is not a number". That record is
   * what prefills the email, name and phone on their page, so the choice is a
   * field here or a payer typing their own email out on a phone keyboard in
   * the middle of deciding whether to buy.
   *
   * So it is asked for only when we do not already have it, and stored, which
   * means a student sees it at most once and a returning one never does.
   */
  const phone = (parsed.success ? (parsed.data.phone ?? '') : '').trim() || (profile?.phone ?? '');
  if (phone && phone !== profile?.phone) {
    void admin.from('profiles').update({ phone }).eq('id', user.id);
  }

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
      existingCustomer: profile?.safepay_customer_id ?? undefined,
      onCustomer: (token: string) => {
        // Reused forever after: Safepay's docs warn against minting a second
        // record for somebody who already has one.
        void admin.from('profiles').update({ safepay_customer_id: token }).eq('id', user.id);
      },
      redirectUrl: `${SITE_URL}/checkout/return`,
      cancelUrl: `${SITE_URL}/checkout?cancelled=1&plan=${plan.id}`,
      payer: { userId: user.id, email, name, phone: phone || undefined },
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
