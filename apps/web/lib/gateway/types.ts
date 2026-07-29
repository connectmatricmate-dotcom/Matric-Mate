/**
 * What this app needs from a payment gateway, in words that are not Safepay's.
 *
 * There is one implementation today. The interface exists because the thing
 * most likely to force a change is outside our control: Safepay have not yet
 * enabled JazzCash and Easypaisa on the account, and if they never do, the
 * gateway has to go, because card-only is not a product in Pakistan.
 *
 * So the vocabulary here is deliberately neutral. "Tracker", "beacon" and
 * "guest session" are Safepay's words for its own machinery and none of them
 * appear below. What the app actually needs is: send this person somewhere to
 * pay, tell me later whether they did, and let me prove the message is real.
 *
 * The rule that survives any provider: nothing in here grants anything. These
 * calls report; lib/payments.ts decides.
 */

export type CheckoutRequest = {
  amountRupees: number;
  /** Ours, unique per attempt, so a retry is its own order rather than a duplicate. */
  orderId: string;
  redirectUrl: string;
  cancelUrl: string;
  payer: {
    /** Ours. A provider that keeps its own customer directory maps to this. */
    userId: string;
    email: string;
    name: string;
    /** E.164. Wallets are keyed on a mobile number, so this is not optional. */
    phone: string;
  };
};

export type CheckoutStart = {
  /** Where to send the browser. */
  url: string;
  /**
   * The gateway's own id for this attempt.
   *
   * Written to the payment row before the payer leaves, because nothing in the
   * payment itself says who they are. It is what a webhook joins back on.
   */
  reference: string;
};

/** A webhook, once the provider's own vocabulary has been stripped off it. */
export type GatewayEvent =
  | { kind: 'paid'; reference: string; receipt?: string }
  | { kind: 'failed'; reference: string }
  | { kind: 'refunded'; reference: string }
  | { kind: 'cancelled'; reference: string }
  /** Signed and understood, but nothing for us to do. Acknowledge, do not retry. */
  | { kind: 'ignored'; note: string };

export type PaymentProvider = {
  /** For logs and for the payment row, so old rows stay readable after a switch. */
  readonly id: string;
  /** False when keys are missing, which is the normal state on a fresh clone. */
  readonly isConfigured: boolean;

  /** Reserves a payment and returns somewhere to send the browser. */
  startCheckout(req: CheckoutRequest): Promise<CheckoutStart>;

  /**
   * Is this webhook really from the gateway?
   *
   * Takes the raw body, never a parsed object. Parsing and re-serialising
   * changes key order and whitespace, and the signature then fails for no
   * visible reason.
   */
  verifyWebhook(rawBody: string, signature: string | null): boolean;

  /** Translates a verified webhook into something this app has an opinion about. */
  parseWebhook(rawBody: string): GatewayEvent;

  /**
   * Is this browser really coming back from the gateway?
   *
   * Worth checking and worth trusting far less. It proves a redirect happened,
   * never that money moved, so it may decide what a page says and nothing else.
   */
  verifyReturn(reference: string, signature: string | null): boolean;
};
