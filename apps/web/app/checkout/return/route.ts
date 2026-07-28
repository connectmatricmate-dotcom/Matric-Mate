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
 * What this page must never become is the thing that grants Premium. Anyone can
 * type this URL, and a signature only proves Safepay redirected here, not that
 * money settled. Until the webhook writes entitlement server-side, the flag it
 * sets is a prototype convenience and nothing more, which is exactly why the
 * success page says so out loud.
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
  const reference = get('reference', 'reference_code', 'Reference Code');
  const orderId = get('order_id', 'Order ID');

  const verified = Boolean(tracker) && verifySignature(tracker, signature);
  if (!verified) {
    console.warn('checkout/return: signature did not verify', { tracker: tracker.slice(0, 12), orderId });
  }

  const next = new URL('/checkout/success', url.origin);
  next.searchParams.set('status', verified ? 'ok' : 'unverified');
  if (reference) next.searchParams.set('ref', reference);
  if (orderId) next.searchParams.set('order', orderId);
  if (tracker) next.searchParams.set('tracker', tracker);

  return NextResponse.redirect(next, 303);
}

export const POST = handle;
export const GET = handle;
