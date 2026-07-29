import 'server-only';
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
export const gateway: PaymentProvider = safepayProvider;

export type { CheckoutRequest, CheckoutStart, GatewayEvent, PaymentProvider } from './types';
