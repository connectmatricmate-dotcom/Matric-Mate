import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { markPaidAndGrant, markPaymentStatus } from '@/lib/payments';

/**
 * Safepay webhooks. This is the only thing that grants Premium.
 *
 * Not the return URL: that proves a browser came back from Safepay, which
 * anyone can arrange by typing the address. This endpoint proves the message
 * came from Safepay, because it is signed with a secret only they and we hold.
 *
 * Signature: HMAC-SHA512 of the raw request body, hex, in X-SFPY-SIGNATURE.
 * The raw text matters. Parsing and re-serialising changes key order and
 * whitespace, and the signature stops matching for no visible reason.
 */

export const dynamic = 'force-dynamic';

/** Permissive on purpose: Safepay adds fields, and an unknown one is not an error. */
const Payload = z.object({
  type: z.string(),
  token: z.string().optional(),
  data: z
    .object({
      tracker: z.string().optional(),
      reference: z.string().optional(),
      state: z.string().optional(),
      amount: z.union([z.number(), z.string()]).optional(),
      currency: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .partial()
    .passthrough(),
});

function verify(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  // Constant time: a plain === leaks how much of a forged signature was right.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.SAFEPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('safepay webhook: SAFEPAY_WEBHOOK_SECRET is not set');
    // 500, not 200: Safepay should retry once we are configured properly.
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const raw = await request.text();

  if (!verify(raw, request.headers.get('x-sfpy-signature'), secret)) {
    console.warn('safepay webhook: bad signature, ignored');
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const parsed = Payload.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    // Signed but unreadable. Retrying will not help, so accept and move on
    // rather than leave Safepay hammering the endpoint for days.
    console.error('safepay webhook: signed but unparseable', parsed.error.issues[0]?.message);
    return NextResponse.json({ received: true });
  }

  const { type, data } = parsed.data;
  const tracker = data.tracker;

  if (!tracker) {
    console.warn('safepay webhook: no tracker on', type);
    return NextResponse.json({ received: true });
  }

  try {
    switch (type) {
      case 'payment.succeeded':
      case 'authorization.succeeded':
      case 'subscription.payment.succeeded':
        await markPaidAndGrant({ tracker, reference: data.reference, raw: parsed.data });
        break;

      case 'payment.failed':
      case 'subscription.payment.failed':
        await markPaymentStatus({ tracker, status: 'failed', raw: parsed.data });
        break;

      case 'payment.refunded':
        await markPaymentStatus({ tracker, status: 'refunded', raw: parsed.data });
        break;

      case 'authorization.reversed':
      case 'void.succeeded':
        await markPaymentStatus({ tracker, status: 'cancelled', raw: parsed.data });
        break;

      default:
        // Subscription lifecycle events land here until subscriptions ship.
        // Acknowledged so they are not retried forever.
        console.log('safepay webhook: ignored event', type);
    }
  } catch (err) {
    // A non-2xx makes Safepay retry, which is what we want if our database was
    // briefly unreachable.
    console.error('safepay webhook: handler failed', err);
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
