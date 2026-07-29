import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Safepay hosted checkout.
 *
 * The flow, every step verified against the sandbox:
 *
 *   1. POST /order/v1/init returns a tracker token, `track_…`.
 *   2. Send the customer to /checkout/pay/?beacon=<tracker>&…
 *      Safepay's own page offers JazzCash, Easypaisa and card.
 *   3. Safepay POSTs back to redirect_url with the tracker, a reference code
 *      and an HMAC signature, which we verify before believing any of it.
 *
 * We never see a card number. Everything sensitive happens on Safepay's domain,
 * which keeps this app out of PCI scope, and is why checkout no longer asks for
 * card details.
 */

const ENV = (process.env.SAFEPAY_ENV ?? 'sandbox') as 'sandbox' | 'production';
const MERCHANT_API_KEY = process.env.SAFEPAY_MERCHANT_API_KEY;
const SECRET_KEY = process.env.SAFEPAY_SECRET_KEY;

const HOST = ENV === 'production' ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com';

/**
 * The Payments 2.0 checkout page. The trailing slash is load-bearing: the app
 * validates its own location with /\/pay\// and refuses the tracker without it.
 * The older /components path now 301s to Safepay's marketing site, which is a
 * confusing way to fail because the redirect looks deliberate.
 */
const CHECKOUT_PAY = `${HOST}/checkout/pay/`;

/** With no keys the app falls back to the mock flow, so local dev needs no secrets. */
export const isSafepayConfigured = Boolean(MERCHANT_API_KEY && SECRET_KEY);

/**
 * A student's identity at Safepay.
 *
 * A **customer** (`cus_…`) is a merchant-scoped record: it owns saved payment
 * methods and it is what a Safepay report joins on. Safepay's docs warn against
 * creating a second one for someone who already exists, so the id is stored on
 * the profile and reused forever.
 *
 * There used to be a **guest session** here too, minted per checkout and passed
 * as `auth_token` to pin the payer's email. It was removed once the hosted
 * page's own bundle showed it does nothing on this route: `auth_token` is read
 * only when there is no tracker, which is the `/checkout/subscribe/` flow. With
 * a tracker present the page is in payment mode and ignores it, so the call was
 * a round trip on the critical path that bought nothing.
 *
 * There is no way to prefill the payer's email on the hosted page. Sending it
 * on `/order/v1/init` was tried four ways and the tracker stored none of them.
 * Owning that field means owning the form, which is the Payments 2.0 custom
 * checkout, and that is a milestone decision rather than a prototype one.
 */

/** Creates a Safepay customer. Call once per student; store what it returns. */
export async function createCustomer(input: { email: string; name: string; phone: string }): Promise<string | null> {
  const secret = process.env.SAFEPAY_SECRET_KEY;
  if (!secret) return null;

  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const res = await fetch(`${HOST}/user/customers/v1/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SFPY-MERCHANT-SECRET': secret },
    cache: 'no-store',
    body: JSON.stringify({
      first_name: firstName || 'Student',
      // Safepay marks last_name mandatory and most students give one name.
      last_name: rest.join(' ') || firstName || 'Student',
      email: input.email,
      // Mandatory. Safepay rejects the call outright without it.
      phone_number: input.phone,
      country: 'PK',
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { data?: { token?: string } };
  if (!res.ok || !body.data?.token) {
    // Not fatal: a payment without a customer attached still works, it is just
    // harder to reconcile later. Never block checkout on it.
    console.error('safepay: could not create customer', res.status, JSON.stringify(body).slice(0, 200));
    return null;
  }
  return body.data.token;
}

type TrackerResponse = {
  /** v1 returns the token at the top of `data`, v3 nests it under `tracker`. */
  data?: { token?: string; tracker?: { token?: string; state?: string } };
  status?: { message?: string; errors?: unknown[] };
};

/**
 * Step 1: reserve a payment. Returns the tracker token.
 *
 * Two endpoints can mint a tracker and they are not interchangeable:
 *
 *   /order/v1/init          leaves `intent` empty, so the hosted page is free
 *                           to pick the rail once the payer chooses a method.
 *                           Amounts in rupees.
 *   /order/payments/v3/     stamps an intent (CYBERSOURCE) and a next action of
 *                           PAYER_AUTH_SETUP, because Payments 2.0 expects the
 *                           *merchant* to drive 3-D Secure from its own UI.
 *                           Amounts in paisa.
 *
 * Handing a v3 tracker to the hosted page fails with "Tracker is in an invalid
 * state", which reads like a bug and is really the page refusing a job that was
 * assigned to us. Hosted checkout therefore uses v1. Moving to the 2.0 custom
 * checkout means building the card form and the payer-auth dance ourselves, and
 * that is a payments-milestone decision, not a prototype one.
 */
export async function createTracker(input: { amountRupees: number; orderId: string }): Promise<string> {
  if (!MERCHANT_API_KEY) throw new Error('Safepay is not configured');

  const res = await fetch(`${HOST}/order/v1/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      client: MERCHANT_API_KEY,
      // v1 takes whole rupees. v3 takes paisa. Mixing them up is a factor of a
      // hundred in either direction, so the unit is named at every boundary.
      amount: input.amountRupees,
      currency: 'PKR',
      environment: ENV,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as TrackerResponse;
  const token = body.data?.token ?? body.data?.tracker?.token;

  if (!res.ok || !token) {
    // Never surface the gateway's raw error to the browser: it can echo the
    // request back, merchant key and all.
    console.error('safepay: tracker failed', res.status, JSON.stringify(body).slice(0, 400));
    throw new Error('Could not start the payment');
  }
  return token;
}

/**
 * Step 2: where to send the customer.
 *
 * `webhooks=true` is the load-bearing one, and it is not optional.
 *
 * After a successful payment the hosted page picks what to render from a chain
 * that ends in a bare "Close" button. It reaches the good branches only for a
 * `source` in its own enum (mobile, shopify, woocommerce, magento2, xcomponent)
 * or when `webhooks` is set. Our source is "custom", which is not in that enum,
 * so without this flag the payer paid, saw a dialog, and sat on Safepay's page
 * forever. With it, the page renders a hidden link to `redirect_url` and clicks
 * it, which is how the browser gets home.
 *
 * That return arrives as a GET carrying `order_id` and `tracker`, and no
 * signature. Which is survivable, because the return has never been allowed to
 * grant anything: the success page reads the payment row under RLS, and only
 * the webhook can move it to paid.
 */
export function checkoutUrl(input: {
  tracker: string;
  orderId: string;
  redirectUrl: string;
  cancelUrl: string;
}) {
  const q = new URLSearchParams({
    env: ENV,
    beacon: input.tracker,
    source: 'custom',
    order_id: input.orderId,
    redirect_url: input.redirectUrl,
    cancel_url: input.cancelUrl,
    webhooks: 'true',
  });
  return `${CHECKOUT_PAY}?${q}`;
}


const matches = (expected: string, given: string) => {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  // Constant time: a plain === leaks how much of a forged signature was right.
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Step 3: is this really Safepay coming back, or someone who guessed the URL?
 *
 * HMAC-SHA256 of the tracker. Safepay's docs are explicit that *webhooks* are
 * signed with the endpoint's shared secret, and silent about which key signs
 * this redirect, so both are accepted rather than guessing and being subtly
 * wrong. That is a safe thing to be relaxed about here and nowhere else: this
 * signature decides whether the page shows a warning, never whether anyone gets
 * access. Only the webhook grants that, and it verifies exactly one secret.
 */
export function verifySignature(tracker: string, signature: string | null | undefined) {
  if (!signature) return false;
  const given = signature.trim().toLowerCase();

  return [process.env.SAFEPAY_WEBHOOK_SECRET, SECRET_KEY]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => matches(createHmac('sha256', secret).update(tracker).digest('hex'), given));
}
