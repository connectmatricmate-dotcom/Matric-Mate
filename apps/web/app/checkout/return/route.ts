import { NextResponse } from 'next/server';
import { gateway } from '@/lib/gateway';

/**
 * Where the payment gateway sends the student back to.
 *
 * Arrives as a GET or a cross-site form POST depending on which branch of the
 * gateway's checkout sent them, so both are accepted and handed to the provider
 * to read. It ends in a 303 to a normal page, so a refresh does not re-submit
 * the form.
 *
 * This route must never be the thing that grants Premium. Anyone can type the
 * URL, and even a valid signature only proves a redirect happened, not that
 * money settled. The webhook is the only writer of entitlement; this is a
 * signpost pointing at the row it wrote.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const params =
    request.method === 'POST'
      ? new URLSearchParams([...(await request.formData())].map(([k, v]) => [k, String(v)]))
      : url.searchParams;

  const { reference, orderId, signature } = gateway.parseReturn(params);

  /**
   * A signature is checked when one is sent, and its absence is not suspicious.
   *
   * The ordinary successful return carries no signature at all, so treating
   * "missing" as "forged" would put a warning in front of every student who
   * paid. A signature that is present and wrong is a different matter.
   *
   * Either way this decides nothing but what the next page says. It reads the
   * payment row under RLS, so a stranger guessing a reference sees nothing.
   */
  const suspicious = Boolean(signature) && !gateway.verifyReturn(reference, signature);
  if (suspicious) {
    console.warn('checkout/return: signature present but did not verify', {
      reference: reference.slice(0, 12),
      orderId,
    });
  }

  const next = new URL('/checkout/success', url.origin);
  if (reference) next.searchParams.set('tracker', reference);
  if (suspicious) next.searchParams.set('status', 'unverified');

  return NextResponse.redirect(next, 303);
}

export const POST = handle;
export const GET = handle;
