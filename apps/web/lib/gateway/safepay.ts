import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { checkoutUrl, createCustomer,
  createPassportToken,
  createSession, fetchTracker, isSafepayConfigured, isSafepayLive, verifySignature } from './safepay-api';
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
 * On the official SDK, since it comes up: @sfpy/node-core does the same three
 * calls this file now makes, and was read as documentation while writing them.
 * It is still not a dependency, for one reason: it has no webhook signature
 * verification at all, and that is the single piece here where a mistake is a
 * security bug rather than a bad afternoon. Three fetches we can read beat a
 * package that leaves out the part that matters.
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

const hmacMatches = (candidate: string, signature: string, secret: string) => {
  const expected = createHmac('sha512', secret).update(candidate).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  // Constant time: a plain === leaks how much of a forged signature was right.
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * HMAC-SHA512, hex, in X-SFPY-SIGNATURE. Two things are accepted as the signed
 * payload and both are checked.
 *
 * We signed the raw body. Safepay's own WooCommerce plugin, which is the
 * maintained integration and therefore the better evidence, signs
 * `json_encode($data)`: the `data` object on its own, not the envelope around
 * it. No webhook has ever been accepted on this account, and a verifier
 * checking the wrong half of the payload is a good explanation for that.
 *
 * Accepting either costs nothing. Both are a full HMAC with the shared secret,
 * so forging one is exactly as hard as forging the other, and being wrong
 * about which Safepay signs would otherwise mean silently discarding real
 * payments.
 */
function verifyBody(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const given = signature.trim().toLowerCase();
  if (hmacMatches(rawBody, given, secret)) return true;

  try {
    const data = (JSON.parse(rawBody) as { data?: unknown }).data;
    if (data !== undefined && hmacMatches(JSON.stringify(data), given, secret)) return true;
  } catch {
    // Not JSON, so there is no inner object to try. The raw-body check above
    // was the only candidate and it failed.
  }
  return false;
}

export const safepayProvider: PaymentProvider = {
  id: 'safepay',

  get isConfigured() {
    return isSafepayConfigured;
  },

  /** True only when a real payment will really be taken. */
  get isLive() {
    return isSafepayLive;
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
    /*
     * Three calls, two round trips deep: the payer record and the credential
     * are independent, and only the session needs the customer token.
     *
     * The customer record is what lets Safepay fill the payer's email in for
     * them. It is best-effort by design: `createCustomer` answers null rather
     * than throwing, so a checkout still works when that call does not.
     */
    /*
     * The payer record is what prefills their email, name and phone on
     * Safepay's page, and it is attached through the session's `user` field
     * rather than the URL. Reused when we already have one: their docs warn
     * against minting a second for somebody who exists.
     *
     * It needs a phone number. Their docs say otherwise and their API answers
     * 400 without one, so no phone means no record and the payer types their
     * own email. That is a worse checkout, not a broken one, which is why
     * nothing here throws.
     */
    let customer = req.existingCustomer ?? null;
    if (!customer && req.payer.phone) {
      customer = await createCustomer({ email: req.payer.email, name: req.payer.name, phone: req.payer.phone });
      if (customer) await req.onCustomer?.(customer);
    }
    const [tracker, tbt] = await Promise.all([
      // Paisa. v3 takes the lowest denomination and v1 took whole rupees, so
      // this multiplication is the difference between charging Rs 1,000 and
      // charging Rs 100,000.
      createSession({ amountPaisa: Math.round(req.amountRupees * 100), orderId: req.orderId, customer }),
      createPassportToken(),
    ]);

    return {
      reference: tracker,
      url: checkoutUrl({
        tracker,
        tbt,
        orderId: req.orderId,
        redirectUrl: req.redirectUrl,
        cancelUrl: req.cancelUrl,
        customer,
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
      // The reporter API speaks paisa and the old one spoke rupees, so the
      // reader says which it read. Getting this backwards records a thousand
      // rupee payment as a hundred thousand, on a receipt a student can see.
      const amountRupees = data.unit === 'paisa' ? Math.round(txn.amount / 100) : txn.amount;
      return { kind: 'paid', receipt: txn.reference, amountRupees };
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
