import { NextResponse } from 'next/server';
import { verifySignature } from '@/lib/safepay';

/**
 * Where Safepay sends the customer back to.
 *
 * It arrives as a cross-site form POST carrying the tracker, a reference code
 * and an HMAC signature. We check the signature before believing any of it,
 * then send the browser on to a normal page with a 303 so a refresh does not
 * re-submit the form.
 *
 * This page must never be the thing that grants Premium. Anyone can type the
 * URL, and a valid signature only proves Safepay redirected here, not that money
 * settled. The webhook is the only writer of entitlement; this is a signpost.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const params =
    request.method === 'POST'
      ? new URLSearchParams([...(await request.formData())].map(([k, v]) => [k, String(v)]))
      : url.searchParams;

  const get = (...names: string[]) => names.map((n) => params.get(n)).find(Boolean) ?? '';

  const tracker = get('tracker', 'beacon');
  const signature = get('sig', 'signature');
  const orderId = get('order_id', 'Order ID');

  /**
   * A signature is checked when one is sent, and its absence is not suspicious.
   *
   * Safepay's hosted page returns here by clicking a hidden link built from
   * `redirect_url`, and that link carries only `order_id` and `tracker`. So the
   * ordinary, successful return has no signature at all, and flagging it would
   * put a warning in front of every student who paid.
   *
   * A signature that is present and wrong still is suspicious, and says so.
   *
   * None of this decides access. The success page reads the payment row under
   * RLS, so a stranger who guesses a tracker sees nothing, and only the webhook
   * can move a payment to paid.
   */
  const suspicious = Boolean(signature) && !verifySignature(tracker, signature);
  if (suspicious) {
    console.warn('checkout/return: signature present but did not verify', {
      tracker: tracker.slice(0, 12),
      orderId,
    });
  }

  // Nothing is granted here. The success page reads the payment row, which only
  // the webhook can move to "paid". All this does is carry the tracker across so
  // the page knows which payment to look up.
  const next = new URL('/checkout/success', url.origin);
  if (tracker) next.searchParams.set('tracker', tracker);
  if (suspicious) next.searchParams.set('status', 'unverified');

  return NextResponse.redirect(next, 303);
}

export const POST = handle;
export const GET = handle;
