import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Safepay hosted checkout, on their current Express Checkout flow.
 *
 * The flow, every step verified against the sandbox on 19 August 2026:
 *
 *   1. POST /order/payments/v3/ returns a tracker, `track_…`. Amount in
 *      PAISA, not rupees. The trailing slash is load-bearing: without it the
 *      request falls through to Safepay's own frontend and answers 405, which
 *      reads exactly like a broken key.
 *   2. POST /client/passport/v1/token returns a short-lived credential,
 *      Safepay call it `tbt`. It lasts an hour.
 *   3. Send the payer to {page}/embedded/?tracker=…&tbt=…&source=hosted&…
 *   4. Safepay returns them to redirect_url with the tracker, and the webhook
 *      or a server-side status read is what actually grants anything.
 *
 * Why this was rewritten. The old flow used POST /order/v1/init and
 * /checkout/pay/, with no credential at all, and payers reached the card form
 * and were told "Missing authorization credentials" when they submitted it.
 * That message is Safepay's, and it is literally true: the page had nothing to
 * authenticate with, because the current flow mints `tbt` and we minted none.
 * The old comment here claimed a v3 tracker fails on the hosted page with
 * "Tracker is in an invalid state" and that v3 expects the merchant to drive
 * 3-D Secure. Both were true of the page that existed then. A v3 tracker now
 * comes back with next_actions CYBERSOURCE: GENERATE_CAPTURE_CONTEXT, which
 * the hosted page performs itself.
 *
 * We never see a card number. Everything sensitive happens on Safepay's
 * domain, which keeps this app out of PCI scope.
 */

const ENV = (process.env.SAFEPAY_ENV ?? 'sandbox') as 'sandbox' | 'production';
const MERCHANT_API_KEY = process.env.SAFEPAY_MERCHANT_API_KEY;
const SECRET_KEY = process.env.SAFEPAY_SECRET_KEY;

/** The API. */
const HOST = ENV === 'production' ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com';

/**
 * The checkout page, which in production is a DIFFERENT HOST from the API:
 * getsafepay.com, not api.getsafepay.com. Easy to miss when only the env flag
 * flips, and it fails as a 404 on a page a payer is looking at.
 */
const PAGE_HOST = ENV === 'production' ? 'https://getsafepay.com' : 'https://sandbox.api.getsafepay.com';
const CHECKOUT_PAGE = `${PAGE_HOST}/embedded/`;

/** Their word for the secret-key header. Lower case, as they document it. */
const secretHeaders = () => ({ 'Content-Type': 'application/json', 'x-sfpy-merchant-secret': SECRET_KEY ?? '' });

/** With no keys the app falls back to the mock flow, so local dev needs no secrets. */
export const isSafepayConfigured = Boolean(MERCHANT_API_KEY && SECRET_KEY);

/**
 * Whether a real card is really about to be charged.
 *
 * Copy must never key off `isSafepayConfigured`: sandbox has keys too, so
 * that flag stays true when we switch to production and the page would go on
 * telling a paying customer that no real money moves.
 */
export const isSafepayLive = isSafepayConfigured && ENV === 'production';

/**
 * A student's identity at Safepay.
 *
 * A **customer** (`cus_…`) is a merchant-scoped record: it owns saved payment
 * methods and it is what a Safepay report joins on. Their docs warn against
 * creating a second one for somebody who already exists, so the id belongs on
 * the profile and gets reused.
 *
 * This used to say the payer's email could not be prefilled at all, and we
 * told the client so. That was true of the old page, which had no parameter to
 * attach a customer to a payment. `/embedded/` takes `user_id`, so it can be
 * done and `createCustomer` below does it.
 */

/**
 * Step 1: reserve the payment.
 *
 * Amount in PAISA. v1 took whole rupees and v3 takes the lowest denomination,
 * so the unit is in the parameter name at every boundary: getting it wrong in
 * one direction charges a student a hundred times the plan price.
 *
 * `intent` is a default rather than a restriction. The tracker comes back with
 * a capability map (CYBERSOURCE, MPGS, PAYFAST, RAAST) and the page decides
 * which to offer, which is why Raast needs no code here: Safepay enable it on
 * the account and it appears as a method.
 */
export async function createSession(input: { amountPaisa: number; orderId: string; customer?: string | null }): Promise<string> {
  if (!MERCHANT_API_KEY || !SECRET_KEY) throw new Error('Safepay is not configured');

  const res = await fetch(`${HOST}/order/payments/v3/`, {
    method: 'POST',
    headers: secretHeaders(),
    cache: 'no-store',
    body: JSON.stringify({
      merchant_api_key: MERCHANT_API_KEY,
      intent: 'CYBERSOURCE',
      mode: 'payment',
      currency: 'PKR',
      amount: input.amountPaisa,
      ...(input.customer ? { user: input.customer } : {}),
      // order_id and source go in the body, not only in metadata: that is what
      // Safepay's own WooCommerce plugin sends, and it is what comes back on
      // the webhook for reconciliation.
      order_id: input.orderId,
      source: 'hosted',
      metadata: { order_id: input.orderId, source: 'hosted' },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { data?: { tracker?: { token?: string }; token?: string } };
  const token = body.data?.tracker?.token ?? body.data?.token;

  if (!res.ok || !token) {
    // Never surface the gateway's raw error to the browser: it can echo the
    // request back, merchant key and all.
    console.error('safepay: session failed', res.status, JSON.stringify(body).slice(0, 400));
    throw new Error('Could not start the payment');
  }
  return token;
}

/**
 * Step 2: the credential the checkout page authenticates with.
 *
 * This is the piece the old flow was missing entirely, and the whole reason a
 * filled-in card form came back with "Missing authorization credentials". One
 * per checkout, never stored, never logged: it is short-lived but it is a
 * credential while it lives.
 *
 * Bearer auth is refused here. It wants the merchant secret header, which is
 * not what the same account uses elsewhere, so it is worth stating plainly.
 */
export async function createPassportToken(): Promise<string> {
  if (!SECRET_KEY) throw new Error('Safepay is not configured');

  const res = await fetch(`${HOST}/client/passport/v1/token`, {
    method: 'POST',
    headers: secretHeaders(),
    cache: 'no-store',
    body: JSON.stringify({}),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: string };
  const token = typeof body.data === 'string' ? body.data : null;

  if (!res.ok || !token) {
    console.error('safepay: passport token failed', res.status, JSON.stringify(body).slice(0, 200));
    throw new Error('Could not start the payment');
  }
  return token;
}

/**
 * A payer record at Safepay, so their email is filled in for them.
 *
 * We told the client this was impossible. It was, on the old page, where there
 * was no parameter to attach one to a payment. `/embedded/` takes `user_id`.
 *
 * Never fatal: a checkout that works with the email typed by hand is better
 * than no checkout, so a failure here returns null and the payment goes on
 * without it.
 */
export async function createCustomer(payer: { email: string; name?: string; phone: string }): Promise<string | null> {
  if (!SECRET_KEY) return null;
  /*
   * Safepay demands both names be 2 to 40 characters. Half our students have
   * a single-word name, and the old '-' filler was one character, so every
   * one of them got a 400 here, silently lost the customer record, and then
   * met "Unauthorized access" on Safepay's page at the moment of paying: the
   * page falls back to POST /user/v2/guest/, whose token their own page has
   * already spent. A mononym goes in both fields; the payer can edit it.
   */
  const fit = (s: string) => (s.length < 2 ? `${s}.`.slice(0, 2) : s.slice(0, 40));
  const words = (payer.name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = fit(words[0] || 'Student');
  const rest = words.slice(1).join(' ');
  try {
    const res = await fetch(`${HOST}/user/customers/v1/`, {
      method: 'POST',
      headers: secretHeaders(),
      cache: 'no-store',
      body: JSON.stringify({
        first_name: first,
        last_name: rest ? fit(rest) : first,
        email: payer.email,
        // Required, whatever the docs say. Omitted, empty and null all answer
        // 400 "phone_number: the phone number supplied is not a number".
        // Local format is accepted, so 03001234567 is fine as typed.
        phone_number: payer.phone,
        country: 'PK',
        is_guest: true,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { token?: string } };
    if (!res.ok || !body.data?.token) {
      console.error('safepay: customer failed', res.status, JSON.stringify(body).slice(0, 200));
      return null;
    }
    return body.data.token;
  } catch {
    return null;
  }
}

/**
 * Step 3: where to send the payer.
 *
 * `source: 'hosted'`, from the SDK's own union of hosted, mobile, popup,
 * woocommerce and shopify. The old flow sent `custom`, which is not one of
 * them, and that was the reason payers used to strand on a dead "Close"
 * dialog and why `webhooks=true` was set to work around it. Neither hack is
 * needed here: `/embedded/` handles redirect_url itself.
 */
export function checkoutUrl(input: {
  tracker: string;
  tbt: string;
  orderId: string;
  redirectUrl: string;
  cancelUrl: string;
  customer?: string | null;
}) {
  const q = new URLSearchParams({
    environment: ENV,
    tracker: input.tracker,
    tbt: input.tbt,
    source: 'hosted',
    order_id: input.orderId,
    redirect_url: input.redirectUrl,
    cancel_url: input.cancelUrl,
  });
  if (input.customer) q.set('user_id', input.customer);
  return `${CHECKOUT_PAGE}?${q}`;
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

/**
 * Reads a tracker back from Safepay, authenticated with the merchant secret.
 *
 * This is how a payment gets confirmed when no webhook arrives, which on this
 * account is every payment so far. `/order/v1/{tracker}` is the read side of
 * the same v1 API the tracker was created with, so the amount comes back in
 * whole rupees and needs no conversion.
 */
export async function fetchTracker(tracker: string): Promise<{
  state?: string;
  transaction?: { amount?: number; reference?: string; net?: number };
  /** Which API answered, because they disagree about money. v3 reports the
   *  lowest denomination and v1 reported whole rupees, and reading one as the
   *  other is a factor of a hundred on a receipt. */
  unit: 'paisa' | 'rupees';
} | null> {
  if (!SECRET_KEY || !tracker) return null;

  /*
   * The reporter API, which is where a v3 payment's outcome lives. This is the
   * call that confirms a payment when no webhook arrives, and on this account
   * that has been every payment so far, so it matters more than it looks.
   *
   * The older /order/v1/{tracker} read is kept as a fallback rather than
   * deleted: it still answers for anything created before the migration, and a
   * student mid-checkout when this deployed should not lose their payment.
   */
  const paths = [`/reporter/api/v1/payments/${encodeURIComponent(tracker)}`, `/order/v1/${encodeURIComponent(tracker)}`];
  for (const path of paths) {
    const res = await fetch(`${HOST}${path}`, { headers: secretHeaders(), cache: 'no-store' });
    if (!res.ok) continue;
    const body = (await res.json().catch(() => ({}))) as {
      data?: { tracker?: { state?: string }; state?: string; transaction?: Record<string, number | string> };
    };
    const d = body.data;
    if (!d) continue;
    // v3 nests the state under `tracker`; v1 has it at the top.
    const state = d.tracker?.state ?? d.state;
    if (!state) continue;
    return {
      state,
      transaction: d.transaction as { amount?: number; reference?: string; net?: number } | undefined,
      unit: path.startsWith('/reporter') ? 'paisa' : 'rupees',
    };
  }
  console.error('safepay: could not read tracker', tracker);
  return null;
}
