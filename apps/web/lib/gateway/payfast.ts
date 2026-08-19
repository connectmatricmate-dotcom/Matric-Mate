import 'server-only';
import { SITE_URL } from '@/lib/site';
import type { GatewayEvent, PaymentProvider, PaymentStatus, ReturnParams } from './types';
import { CONFIGURED, ENV, checkoutForm, fetchBasketStatus, getAccessToken } from './payfast-api';

/**
 * PayFast as a PaymentProvider.
 *
 * The trust model is blunter than Safepay's and that is on purpose: nothing
 * PayFast sends to the browser or to the notification URL is treated as
 * proof. The redirect decides what a page says; the server-side status read
 * in lib/payments.ts (`confirmWithGateway`) is the only thing that settles a
 * payment. That read is authenticated with our secured key, checks the
 * amount, and runs from the success page's poll, so a student who paid is
 * confirmed within seconds of arriving back, webhook or no webhook.
 */

/** `MM-monthly-mt09f20f`: the last segment is Date.now() in base 36. The
 *  status API wants the order's calendar date, and the reference itself
 *  carries it, which spares the provider a database it should not touch. */
function orderDateFrom(reference: string): string {
  const ts = parseInt(reference.split('-').pop() ?? '', 36);
  const d = Number.isFinite(ts) && ts > 0 ? new Date(ts) : new Date();
  return d.toISOString().slice(0, 10);
}

/** +923001234567 -> 03001234567. PayFast is a Pakistani rail and its forms
 *  and records use the local shape. Anything unrecognised passes through. */
function localMobile(phone: string | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (/^92 ?3\d{9}$/.test(digits) || /^923\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^03\d{9}$/.test(digits)) return digits;
  return phone;
}

export const payfastProvider: PaymentProvider = {
  id: 'payfast',
  isConfigured: CONFIGURED,
  isLive: ENV === 'live',

  async startCheckout(req) {
    const token = await getAccessToken({ amountRupees: req.amountRupees, basketId: req.orderId });

    // Local time, their convention. Sent once and echoed in reporting.
    const orderDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const form = checkoutForm({
      token,
      basketId: req.orderId,
      amountRupees: req.amountRupees,
      description: `MatricMate Premium (${req.orderId})`,
      customerEmail: req.payer.email,
      customerMobile: localMobile(req.payer.phone),
      successUrl: req.redirectUrl,
      failureUrl: req.cancelUrl,
      checkoutUrl: `${SITE_URL}/api/webhooks/payfast`,
      orderDate,
    });

    // No customer directory here: PayFast identifies the payer per
    // transaction, so onCustomer/existingCustomer are simply unused.
    return { form, reference: req.orderId };
  },

  /**
   * PayFast's server-to-server notification carries no documented signature
   * scheme we can verify offline, so it is treated as a doorbell, never as
   * proof: the webhook route acknowledges it and the settlement still comes
   * from the authenticated status read. Rejecting here keeps the granting
   * path honest until their docs give us something checkable.
   */
  verifyWebhook(): boolean {
    return false;
  },

  parseWebhook(): GatewayEvent {
    return { kind: 'ignored', note: 'payfast notifications are unsigned; settlement is by status read' };
  },

  async getPaymentStatus(reference): Promise<PaymentStatus> {
    const status = await fetchBasketStatus({ basketId: reference, orderDate: orderDateFrom(reference) });
    if (!status) return { kind: 'unknown' };
    if (status.paid) {
      return {
        kind: 'paid',
        receipt: status.transactionId ?? undefined,
        // A missing amount must not read as "matches anything": -1 can never
        // equal a real plan price, so the caller's amount check fails closed.
        amountRupees: status.amountRupees ?? -1,
      };
    }
    if (status.failed) return { kind: 'failed' };
    return { kind: 'pending' };
  },

  parseReturn(params): ReturnParams {
    // Their field casing varies by rail; read both before giving up.
    const pick = (...names: string[]) => {
      for (const n of names) {
        const v = params.get(n);
        if (v) return v;
      }
      return '';
    };
    const basket = pick('basket_id', 'BASKET_ID', 'order_id', 'ORDER_ID');
    return {
      reference: basket,
      orderId: basket,
      signature: pick('validation_hash', 'VALIDATION_HASH') || null,
    };
  },

  /**
   * The validation hash formula is not in the public reference guide, so a
   * present hash cannot be checked yet. Answering true keeps the return page
   * from branding every legitimate payer suspicious; it grants nothing,
   * because this route never does.
   */
  verifyReturn(): boolean {
    return true;
  },
};
