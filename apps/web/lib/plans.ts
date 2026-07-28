/**
 * What Premium costs. One product, three billing lengths, the longer ones exist
 * because Pakistani families budget by exam season, not by month.
 *
 * Prices live here rather than in @matricmate/core on purpose: the Android app
 * must never render a price (see packages/core/src/billing.ts), so shared code
 * is the wrong home for them.
 */

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
  popular?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 1000,
    months: 1,
    perMonth: 1000,
    note: 'Pay as you go. Cancel any month.',
  },
  {
    id: 'quarter',
    name: '3 months',
    price: 2700,
    months: 3,
    perMonth: 900,
    saving: 'Save Rs 300',
    note: 'Covers a full term, mid-terms included.',
    popular: true,
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
export const PAYMENT_METHODS = [
  { id: 'jazzcash' as const, label: 'JazzCash', hint: 'Mobile account', logo: '/brand/pay/jazzcash.png' },
  { id: 'easypaisa' as const, label: 'EasyPaisa', hint: 'Mobile account', logo: '/brand/pay/easypaisa.png' },
  { id: 'card' as const, label: 'Debit or credit card', hint: 'Visa, Mastercard', logo: null },
];

export const INCLUDED = [
  'Every chapter, note and audio lesson',
  'Unlimited MCQs, tests and past papers',
  'AI tutor: 20 questions a day',
  'Weak topics and monthly report card',
  'Offline downloads',
  'Android app and website, one account',
];

export const FREE_INCLUDED = [
  'Browse every subject and chapter',
  'One full chapter per subject',
  '5 MCQs a day',
  '5 AI tutor questions a day',
];
