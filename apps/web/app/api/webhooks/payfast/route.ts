import { NextResponse } from 'next/server';
import { reconcilePayment } from '@/lib/payments';

/**
 * PayFast's CHECKOUT_URL notification: a doorbell, not a verdict.
 *
 * Their notification carries no signature scheme we can verify, so nothing in
 * it is believed, including the status it claims. It is treated purely as
 * "look at this basket now": the id is pulled out and the payment settled, or
 * not, by the authenticated status read in lib/payments.ts, the same one the
 * success page uses. An attacker who posts a forged basket id here achieves a
 * status check of a payment that did not pay, which settles nothing.
 *
 * Always 200, even for baskets we have never heard of: a non-2xx makes their
 * side retry a message that will never mean more than it did the first time.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let basket = '';
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) {
      const body = (await request.json()) as Record<string, unknown>;
      basket = String(body.basket_id ?? body.BASKET_ID ?? body.order_id ?? '');
    } else {
      const form = await request.formData();
      basket = String(form.get('basket_id') ?? form.get('BASKET_ID') ?? form.get('order_id') ?? '');
    }
  } catch {
    // Unreadable body: fall through to the query string below.
  }
  if (!basket) basket = new URL(request.url).searchParams.get('basket_id') ?? '';

  if (basket) await reconcilePayment(basket);
  return NextResponse.json({ received: true });
}
