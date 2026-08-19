import 'server-only';
import { payfastProvider } from './payfast';
import { safepayProvider } from './safepay';
import type { PaymentProvider } from './types';

/**
 * The gateway this deployment pays through.
 *
 * One line, on purpose. Everything above this file talks to `gateway` and knows
 * nothing about who is behind it, so swapping provider means writing a second
 * module next to ./safepay.ts and changing the assignment below.
 *
 * The reason that matters is specific rather than architectural: Safepay have
 * still not enabled JazzCash and Easypaisa on the merchant account, and a
 * card-only checkout is not a product in Pakistan. If that stays unresolved the
 * provider has to change, and this is the seam it changes at.
 */
/*
 * The seam earned its keep on 19 August 2026: Safepay's hosted page cannot
 * complete a payment on this account (their guest endpoint 401s every
 * credential, documented in safepay-findings.md), so the client ordered the
 * switch to PayFast. Selection is by configuration, not by edit: set
 * PAYMENT_GATEWAY explicitly, or the presence of PayFast keys decides, so a
 * rollback to Safepay is an environment change rather than a deploy.
 */
const chosen = process.env.PAYMENT_GATEWAY;
export const gateway: PaymentProvider =
  chosen === 'safepay' ? safepayProvider
  : chosen === 'payfast' ? payfastProvider
  : payfastProvider.isConfigured ? payfastProvider
  : safepayProvider;

export type { CheckoutRequest, CheckoutStart, GatewayEvent, PaymentProvider } from './types';
