import { type Language, translate } from '@matricmate/core';
/**
 * What the plans cost: Premium, Rs 1,000 a month with AI, and Basic, Rs 500 a
 * month without it (the client's notes of 14 Sep 2026). See accessFor in core
 * for what each one opens.
 *
 * Prices live here rather than in @matricmate/core on purpose: the Android app
 * must never render a price (see packages/core/src/billing.ts), so shared code
 * is the wrong home for them.
 */

import { AI_QUOTA } from '@matricmate/core';

export type PlanId = 'monthly' | 'basic' | 'quarter' | 'year';

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
  /** The AI tutor and the other AI features come with it. */
  ai: boolean;
  /**
   * Stays unset until sales tell us which length people actually choose. The
   * pill it drives says "most students pick this", and with nobody subscribed
   * yet that is a claim we cannot make.
   */
  popular?: boolean;
};

/**
 * The two plans on sale, both monthly.
 *
 * There were three lengths and the client cut them to one, because a monthly
 * price is the one a family can say yes to without a conversation. Then on 14
 * Sep 2026 a second plan: the same month without AI, at half the price, for
 * the families for whom Rs 1,000 is the obstacle. Premium stays first: it is
 * the default everywhere a single button starts a checkout. Its id stays
 * 'monthly', which every existing row and receipt already says.
 */
export const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Premium',
    price: 1000,
    months: 1,
    perMonth: 1000,
    ai: true,
    note: 'Everything, with the AI tutor. Renew whenever you like.',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 500,
    months: 1,
    perMonth: 500,
    ai: false,
    note: 'Every chapter, note, audio lesson and practice set. No AI.',
  },
];

/**
 * Lengths we used to sell. Nobody can buy these any more, but accounts and
 * receipts still reference them, and a payment history that renders "Monthly"
 * against a year's charge would be wrong. Lookup only, never offered.
 */
const RETIRED: Plan[] = [
  { id: 'quarter', name: '3 months', price: 2700, months: 3, perMonth: 900, ai: true, note: '' },
  { id: 'year', name: 'Full year', price: 9000, months: 12, perMonth: 750, ai: true, note: '' },
];

export const planById = (id: string): Plan =>
  PLANS.find((p) => p.id === id) ?? RETIRED.find((p) => p.id === id) ?? PLANS[0];

/** Premium, the default wherever one button starts a checkout. */
export const THE_PLAN = PLANS[0];

/** The Rs 500 plan without AI. */
export const BASIC_PLAN = PLANS[1];

/**
 * The plan's name in the student's language. `plan.name` above is the English
 * source; it gets spliced into translated sentences ("پریمیم · Monthly"), so
 * anywhere a student reads it, it goes through here instead.
 */
export function planName(id: string, lang: Language): string {
  const key =
    id === 'year' ? 'billing.planYear' : id === 'quarter' ? 'billing.planQuarter' : id === 'basic' ? 'billing.planBasic' : id === 'trial' ? 'billing.planTrial' : 'billing.planMonthly';
  return translate(lang, key);
}

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
 * What each plan opens, for the marketing pages (English, like them).
 *
 * The quota comes from AI_QUOTA rather than a literal because these lists and
 * the landing page and the terms page all quote it, and they had already
 * drifted to two different numbers.
 */
export const BASIC_INCLUDED = [
  'Every chapter, note and audio lesson',
  'Unlimited MCQs, tests and past papers',
  'Weak topics and monthly report card',
  'Offline downloads in the Android app, coming to Play',
  'Website now, Android app next, one account',
];

export const PREMIUM_INCLUDED = [
  'Everything in Basic',
  `AI tutor: ${AI_QUOTA.premium} questions a day, in English or Urdu`,
  'AI answer checking, AI tests and mock papers',
  'Revision sheets, a weekly AI coach and career guidance',
];

/*
 * There is no free tier. The client's call: every account needs a plan. What
 * there is instead is a free trial, three days of one subject, once per
 * account (start_trial, migration 0043).
 */
