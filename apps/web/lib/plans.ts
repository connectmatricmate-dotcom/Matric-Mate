/**
 * What Premium costs. One product, three billing lengths, the longer ones exist
 * because Pakistani families budget by exam season, not by month.
 *
 * Prices live here rather than in @matricmate/core on purpose: the Android app
 * must never render a price (see packages/core/src/billing.ts), so shared code
 * is the wrong home for them.
 */

import { AI_QUOTA } from '@matricmate/core';

export type PlanId = 'monthly' | 'quarter' | 'year';

export type Plan = {
  id: PlanId;
  name: string;
  /** Total charged today, in rupees. */
  price: number;
  months: number;
  /** What it works out to per month, the number students actually compare. */
  perMonth: number;
  saving?: string;
  note: string;
  /**
   * Stays unset until sales tell us which length people actually choose. The
   * pill it drives says "most students pick this", and with nobody subscribed
   * yet that is a claim we cannot make.
   */
  popular?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 1000,
    months: 1,
    perMonth: 1000,
    note: 'Pay as you go, one month at a time.',
  },
  {
    id: 'quarter',
    name: '3 months',
    price: 2700,
    months: 3,
    perMonth: 900,
    saving: 'Save Rs 300',
    note: 'Covers a full term, mid-terms included.',
  },
  {
    id: 'year',
    name: 'Full year',
    price: 9000,
    months: 12,
    perMonth: 750,
    saving: 'Save Rs 3,000',
    note: 'Class 9 to the board exam, one payment.',
  },
];

export const planById = (id: string): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];

export const rupees = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

/**
 * How people pay. The two wallet marks are the official symbols, used unaltered
 * beside our own text label rather than pressed into a horizontal lockup the
 * brands do not publish. Card has no third-party mark: we would need Visa and
 * Mastercard's own assets, and their guidelines are stricter than this prototype
 * needs. Confirm all three against the current merchant brand kits before launch.
 *
 * These live on the web only. The Android build must never show a payment brand:
 * to Google Play that reads as steering a user to an alternative payment method.
 * See packages/core/src/billing.ts.
 */
/**
 * Raast replaced the two wallet logos on 30 Jul 2026. Safepay has no direct
 * JazzCash or Easypaisa rails; both arrive only through Raast on a production
 * account, so Raast is the mark the payer will actually see, and showing the
 * wallet brands as if they were direct options over-promised. The hint keeps
 * the wallets' names because that is what students recognise.
 */
export const PAYMENT_METHODS = [
  { id: 'raast' as const, label: 'Raast', hint: 'JazzCash, Easypaisa and bank apps · no extra fee', logo: '/brand/pay/raast.png' },
  { id: 'card' as const, label: 'Debit or credit card', hint: 'Visa, Mastercard', logo: null },
];

/**
 * The quota comes from AI_QUOTA rather than a literal because this list and the
 * landing page and the terms page all quote it, and they had already drifted to
 * two different numbers.
 */
export const INCLUDED = [
  'Every chapter, note and audio lesson',
  'Unlimited MCQs, tests and past papers',
  `AI tutor: ${AI_QUOTA.premium} questions a day`,
  'Weak topics and monthly report card',
  'Offline downloads in the Android app, coming to Play',
  'Website now, Android app next, one account',
];

/*
 * There is no free tier. The client's call: every account needs a plan, so
 * the only list that exists is what the plan includes.
 */
