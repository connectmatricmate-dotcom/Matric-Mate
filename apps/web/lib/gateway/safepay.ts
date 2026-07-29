import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { checkoutUrl, createTracker, fetchTracker, isSafepayConfigured, verifySignature } from './safepay-api';
import type {
  CheckoutRequest,
  CheckoutStart,
  GatewayEvent,
  PaymentProvider,
  PaymentStatus,
  ReturnParams,
} from './types';

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
    /**
     * Just the tracker.
     *
     * A Safepay customer record used to be minted here too, but there is no
     * parameter on the hosted checkout URL that attaches one to a payment, so
     * every record was an orphan: it cost a round trip, needed a phone number,
     * and never appeared against the transaction it was meant to explain. It
     * becomes worth having again with a custom checkout that can use saved
     * cards.
     */
    const tracker = await createTracker({ amountRupees: req.amountRupees, orderId: req.orderId });

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

  async getPaymentStatus(reference): Promise<PaymentStatus> {
    const data = await fetchTracker(reference);
    if (!data) return { kind: 'unknown' };

    /**
     * Two things have to be true, not one.
     *
     * `TRACKER_ENDED` on its own only means the tracker is finished, and a
     * tracker ends when a payment is abandoned as well as when it settles. The
     * transaction is the part that means money moved: it carries the amount,
     * the fees taken and the net, and it does not exist until then.
     */
    const txn = data.transaction;
    if (data.state === 'TRACKER_ENDED' && txn && typeof txn.amount === 'number' && txn.amount > 0) {
      // v1 speaks whole rupees, the same unit the tracker was created in.
      return { kind: 'paid', receipt: txn.reference, amountRupees: txn.amount };
    }
    if (data.state === 'TRACKER_STARTED') return { kind: 'pending' };
    return { kind: 'unknown' };
  },

  parseReturn(params): ReturnParams {
    /**
     * Safepay is inconsistent about what it calls these depending on which
     * branch of its checkout sent you, so each is read under every name it has
     * been seen using. "Order ID" with a space and a capital is not a typo.
     *
     * The webhooks=true return sends no signature at all, so null here is the
     * ordinary case rather than a red flag.
     */
    const first = (...names: string[]) => names.map((n) => params.get(n)).find(Boolean) ?? '';
    return {
      reference: first('tracker', 'beacon'),
      orderId: first('order_id', 'Order ID'),
      signature: first('sig', 'signature') || null,
    };
  },

  verifyReturn(reference, signature) {
    return Boolean(reference) && verifySignature(reference, signature);
  },
};
