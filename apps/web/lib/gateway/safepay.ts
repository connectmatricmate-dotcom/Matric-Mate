import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { checkoutUrl, createTracker, isSafepayConfigured, verifySignature } from '@/lib/safepay';
import { ensureSafepayCustomer } from '@/lib/safepay-customer';
import type { CheckoutRequest, CheckoutStart, GatewayEvent, PaymentProvider } from './types';

/**
 * Safepay, behind the neutral interface.
 *
 * Everything Safepay-shaped lives on this side of the line: trackers, guest
 * sessions, the customer directory, their event names, their two signature
 * algorithms. Nothing above this file knows any of it.
 *
 * On the official SDK, since it comes up: @sfpy/node-core exists and it is not
 * a fit here. It exposes /order/payments/v3 only, and hosted checkout requires
 * a tracker from /order/v1/init, which the SDK does not have. Handing it a v3
 * tracker is what produces "Tracker is in an invalid state". The SDK also has
 * no webhook signature verification at all, which is the one piece where a
 * mistake is a security bug rather than a bad afternoon. It would be the right
 * tool the day we build a custom Payments 2.0 checkout with our own card form
 * and payer-auth step; it is the wrong one for a hosted page.
 */

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

/** HMAC-SHA512 of the raw body, hex, in X-SFPY-SIGNATURE. */
function verifyBody(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  // Constant time: a plain === leaks how much of a forged signature was right.
  return a.length === b.length && timingSafeEqual(a, b);
}

export const safepayProvider: PaymentProvider = {
  id: 'safepay',

  get isConfigured() {
    return isSafepayConfigured;
  },

  async startCheckout(req: CheckoutRequest): Promise<CheckoutStart> {
    const { payer } = req;

    /**
     * The customer record is a directory entry for reconciliation, not part of
     * the payment, so it runs alongside the tracker and may fail quietly. Only
     * the tracker can fail the request: with no tracker there is nothing to pay
     * against.
     */
    const [tracker] = await Promise.all([
      createTracker({ amountRupees: req.amountRupees, orderId: req.orderId }),
      ensureSafepayCustomer({
        userId: payer.userId,
        email: payer.email,
        name: payer.name,
        phone: payer.phone,
      }).catch(() => null),
    ]);

    return {
      reference: tracker,
      url: checkoutUrl({
        tracker,
        orderId: req.orderId,
        redirectUrl: req.redirectUrl,
        cancelUrl: req.cancelUrl,
      }),
    };
  },

  verifyWebhook(rawBody, signature) {
    const secret = process.env.SAFEPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('safepay: SAFEPAY_WEBHOOK_SECRET is not set');
      return false;
    }
    return verifyBody(rawBody, signature, secret);
  },

  parseWebhook(rawBody): GatewayEvent {
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return { kind: 'ignored', note: 'body was not JSON' };
    }

    const parsed = Payload.safeParse(json);
    if (!parsed.success) {
      return { kind: 'ignored', note: `unreadable: ${parsed.error.issues[0]?.message ?? 'unknown shape'}` };
    }

    const { type, data } = parsed.data;
    const reference = data.tracker;
    if (!reference) return { kind: 'ignored', note: `no tracker on ${type}` };

    switch (type) {
      case 'payment.succeeded':
      case 'authorization.succeeded':
      case 'subscription.payment.succeeded':
        return { kind: 'paid', reference, receipt: data.reference };

      case 'payment.failed':
      case 'subscription.payment.failed':
        return { kind: 'failed', reference };

      case 'payment.refunded':
        return { kind: 'refunded', reference };

      case 'authorization.reversed':
      case 'void.succeeded':
        return { kind: 'cancelled', reference };

      default:
        return { kind: 'ignored', note: `unhandled event ${type}` };
    }
  },

  verifyReturn(reference, signature) {
    return Boolean(reference) && verifySignature(reference, signature);
  },
};
