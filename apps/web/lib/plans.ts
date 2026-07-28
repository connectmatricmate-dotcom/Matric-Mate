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

export const PAYMENT_METHODS = [
  { id: 'jazzcash' as const, label: 'JazzCash', hint: 'Mobile account', emoji: '📱' },
  { id: 'easypaisa' as const, label: 'EasyPaisa', hint: 'Mobile account', emoji: '💚' },
  { id: 'card' as const, label: 'Debit or credit card', hint: 'Visa, Mastercard', emoji: '💳' },
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
