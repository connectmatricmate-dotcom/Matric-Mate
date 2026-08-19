import 'server-only';

/**
 * PayFast (gopayfast.com, by APPS Pakistan): raw API calls, nothing else.
 *
 * This is the Web Checkout redirect flow: mint a short-lived access token
 * bound to the amount and basket, then the BROWSER posts a form to PayFast's
 * page, where the student picks a card, wallet or bank account and pays. The
 * shape comes from PayFast's own API reference (the merchant guide the client
 * exported on 19 August 2026) and from their published integrations; the
 * pieces their public docs do not pin are marked UAT below and each one is a
 * ten-minute check the day sandbox credentials arrive.
 *
 * Two environments. UAT is `ipguat.apps.net.pk`. The production host ships
 * with the live credentials and is deliberately NOT guessed here: a wrong
 * production URL fails in the one environment where real money moves, so it
 * must come from PAYFAST_BASE_URL and nowhere else.
 */

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? '';
const SECURED_KEY = process.env.PAYFAST_SECURED_KEY ?? '';
export const MERCHANT_NAME = process.env.PAYFAST_MERCHANT_NAME ?? 'MatricMate';

export const ENV = process.env.PAYFAST_ENV === 'live' ? 'live' : 'uat';
export const CONFIGURED = Boolean(MERCHANT_ID && SECURED_KEY);

/** The Ecommerce (web checkout) base. Overridable so going live is config. */
const BASE =
  process.env.PAYFAST_BASE_URL ??
  (ENV === 'live'
    ? '' // must be provided; see the header comment
    : 'https://ipguat.apps.net.pk/Ecommerce/api/Transaction');

/**
 * UAT: the transaction-status API may live on a different base path than the
 * Ecommerce one. Overridable for exactly that reason; the default assumes the
 * same host until the sandbox says otherwise.
 */
const API_BASE = process.env.PAYFAST_API_BASE_URL ?? BASE;

/**
 * A token, bound to this amount and basket.
 *
 * PayFast's token is not a session the way Safepay's was: it is a one-time
 * credential the browser carries into the form post. Amount and basket go
 * into its minting, which is what stops a student paying 100 rupees on a
 * token minted for 9,000.
 */
export async function getAccessToken(input: { amountRupees: number; basketId: string }): Promise<string> {
  const body = new URLSearchParams({
    MERCHANT_ID,
    SECURED_KEY,
    TXNAMT: String(input.amountRupees),
    BASKET_ID: input.basketId,
    CURRENCY_CODE: 'PKR',
  });
  const res = await fetch(`${BASE}/GetAccessToken`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const token = (data.ACCESS_TOKEN ?? data.access_token ?? data.token) as string | undefined;
  if (!res.ok || !token) {
    console.error('payfast: token failed', res.status, JSON.stringify(data).slice(0, 200));
    throw new Error('Could not start the payment');
  }
  return token;
}

/**
 * The form the browser submits to PayFast. Field names are PayFast's own and
 * every one of them is load-bearing; do not rename to look tidier.
 *
 * SIGNATURE is not cryptography, whatever the name suggests: it is a
 * merchant-chosen string PayFast echoes back, useful for correlating a return
 * with an attempt. The real integrity comes from the token binding above and
 * the server-side status read after.
 */
export function checkoutForm(input: {
  token: string;
  basketId: string;
  amountRupees: number;
  description: string;
  customerEmail: string;
  /** Local format, 03XXXXXXXXX. PayFast is a Pakistani rail; +92 is converted by the caller. */
  customerMobile: string;
  successUrl: string;
  failureUrl: string;
  /** Server-to-server result notification. Their name for a webhook target. */
  checkoutUrl: string;
  orderDate: string;
}): { action: string; fields: Record<string, string> } {
  return {
    action: `${BASE}/PostTransaction`,
    fields: {
      MERCHANT_ID,
      MERCHANT_NAME,
      TOKEN: input.token,
      PROCCODE: '00',
      TXNAMT: String(input.amountRupees),
      CUSTOMER_MOBILE_NO: input.customerMobile,
      CUSTOMER_EMAIL_ADDRESS: input.customerEmail,
      SIGNATURE: `MM-${input.basketId}`,
      VERSION: 'MATRICMATE-WEB-1.0',
      TXNDESC: input.description,
      SUCCESS_URL: input.successUrl,
      FAILURE_URL: input.failureUrl,
      BASKET_ID: input.basketId,
      ORDER_DATE: input.orderDate,
      CHECKOUT_URL: input.checkoutUrl,
    },
  };
}

/**
 * Ask PayFast what happened to a basket, server to server.
 *
 * This is the only voice this integration trusts about money. The reference
 * guide documents `GET /transaction/basket_id/{basket}?order_date=YYYY-MM-DD`
 * with a Bearer token; the exact response field names are UAT work, so the
 * parser below reads every spelling their docs and integrations use and
 * answers "unknown" rather than guessing when none match.
 */
export async function fetchBasketStatus(input: {
  basketId: string;
  orderDate: string;
}): Promise<{ paid: boolean; failed: boolean; amountRupees: number | null; transactionId: string | null } | null> {
  try {
    const token = await getAccessToken({ amountRupees: 0, basketId: input.basketId }).catch(() => null);
    if (!token) return null;
    const res = await fetch(
      `${API_BASE}/transaction/basket_id/${encodeURIComponent(input.basketId)}?order_date=${encodeURIComponent(input.orderDate)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error('payfast: status read failed', res.status);
      return null;
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return null;

    // Their APIs wrap variably; unwrap the common shapes before reading.
    const row = (Array.isArray(body) ? body[0] : (body.data ?? body.transaction ?? body)) as Record<string, unknown>;
    const errCode = String(row.err_code ?? row.errCode ?? row.status_code ?? '');
    const statusWord = String(row.transaction_status ?? row.status ?? '').toLowerCase();
    const paid = errCode === '000' || errCode === '00' || statusWord === 'paid' || statusWord === 'success' || statusWord === 'completed';
    const failed = (!paid && errCode !== '' && errCode !== '000' && errCode !== '00') || statusWord === 'failed' || statusWord === 'declined';
    const amountRaw = row.transaction_amount ?? row.txnamt ?? row.amount;
    const amountRupees = amountRaw != null && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null;
    const transactionId = (row.transaction_id ?? row.transactionId ?? null) as string | null;
    return { paid, failed, amountRupees, transactionId };
  } catch (err) {
    console.error('payfast: status read threw', err);
    return null;
  }
}
