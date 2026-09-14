import { NextResponse } from 'next/server';
import { gateway, onlinePayments } from '@/lib/gateway';
import { markPaidAndGrant, markPaymentStatus } from '@/lib/payments';

/**
 * Gateway webhooks. This is the only thing that grants Premium.
 *
 * Not the return URL: that proves a browser came back, which anyone can arrange
 * by typing the address. This endpoint proves the message came from the gateway,
 * because it is signed with a secret only they and we hold.
 *
 * The route knows nothing about how that signature is computed or what the
 * events are called. It asks the provider two questions, "is this real" and
 * "what does it mean", and then decides what to do about the answer. That
 * split is deliberate: changing provider should not mean re-deriving which
 * events are worth acting on, and the raw body has to reach the verifier
 * untouched, because parsing and re-serialising changes key order and
 * whitespace and the signature then fails for no visible reason.
 *
 * The path still says "safepay" because it is registered with them by that
 * name. Renaming it means re-registering, which is a migration, not a tidy-up.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Read once, as text. Never JSON.parse before verifying.
  const raw = await request.text();
  const signature = request.headers.get('x-sfpy-signature');

  if (!gateway.verifyWebhook(raw, signature)) {
    console.warn('webhook: rejected, signature did not verify');
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const event = gateway.parseWebhook(raw);

  /**
   * Kept for the audit column, which is jsonb. Storing the raw string there
   * would put a quoted blob in the database that nothing can query, so it goes
   * in as an object. The string is what gets verified; this is what gets filed.
   */
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { unparseable: raw.slice(0, 500) };
  }

  try {
    switch (event.kind) {
      case 'paid':
        // A sandbox's "paid" on the production site is a test card, not money.
        if (!onlinePayments()) {
          console.warn('webhook: paid event ignored, online payments are off here', event.reference);
          break;
        }
        await markPaidAndGrant({ tracker: event.reference, reference: event.receipt, raw: payload });
        break;

      case 'failed':
        await markPaymentStatus({ tracker: event.reference, status: 'failed', raw: payload });
        break;

      case 'refunded':
        await markPaymentStatus({ tracker: event.reference, status: 'refunded', raw: payload });
        break;

      case 'cancelled':
        await markPaymentStatus({ tracker: event.reference, status: 'cancelled', raw: payload });
        break;

      case 'ignored':
        // Signed and understood, nothing for us to do. Acknowledged so the
        // gateway stops retrying it for days.
        console.log('webhook: ignored,', event.note);
        break;
    }
  } catch (err) {
    // A non-2xx makes the gateway retry, which is what we want if our database
    // was briefly unreachable.
    console.error('webhook: handler failed', err);
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
