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

/**
 * Whether a student can pay online on this deployment, or plans are switched
 * on by hand from the admin dashboard.
 *
 * The live site was sending students to Safepay's sandbox: a test page where
 * no money moves, and where a published test card completes a "payment" that
 * the confirmation path would have turned into a real plan. As of 14 Sep 2026
 * no gateway is live and the client activates plans himself, likely moving to
 * a bank's own API later. So a sandbox may take payments only where nothing is
 * real (local development and preview deployments); the production site pays
 * online only once a provider here is configured AND live, and until then
 * every plan button explains how to get the plan from the team instead.
 */
export function onlinePayments(): boolean {
  if (!gateway.isConfigured) return false;
  if (gateway.isLive) return true;
  const production = process.env.VERCEL_ENV === 'production' || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');
  return !production;
}

export type { CheckoutRequest, CheckoutStart, GatewayEvent, PaymentProvider } from './types';
