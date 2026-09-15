import { AI_QUOTA } from './domain';

/**
 * What a student's plan lets them do, decided in one place.
 *
 * Since 14 Sep 2026 there are three ways to be let in, and they differ:
 *
 *   premium  Rs 1,000 a month. Everything, with the AI tutor and every other
 *            AI feature, AI_QUOTA.premium questions a day. This was the only
 *            plan; its rows say 'monthly' (or 'premium' from the grant script,
 *            or nothing on the oldest), and all of those mean premium.
 *   basic    Rs 500 a month. Every chapter, note, audio lesson and practice
 *            format, no AI at all.
 *   trial    Free for 3 days, once per account. One subject open, a handful
 *            of AI questions a day.
 *
 * entitlements.plan was written for months and read by nothing, so a row that
 * was active opened everything. The database now limits a trial's content to
 * its subject (migration 0043) and the server refuses AI to a plan without it
 * (lib/ai/guard.ts); this is what both apps and the server read to agree with
 * them.
 */
export type PlanTier = 'premium' | 'basic' | 'trial';

export type Access = {
  /** A plan of any kind is running now. */
  active: boolean;
  /** Which one, when active. */
  tier: PlanTier | null;
  /** The AI tutor and the other AI features are included. */
  ai: boolean;
  /** AI questions a day. */
  aiLimit: number;
  /** The one subject a trial opens; null otherwise. */
  trialSubject: string | null;
  /** When the plan ends, epoch ms. */
  validTill: number | null;
};

/** The tier a stored plan id means. Unknown and legacy ids are premium, the only plan there was. */
export const tierOf = (plan: string | null | undefined): PlanTier => (plan === 'basic' ? 'basic' : plan === 'trial' ? 'trial' : 'premium');

export function accessFor(input: {
  active: boolean;
  plan?: string | null;
  validTill?: number | null;
  trialSubject?: string | null;
} | null | undefined): Access {
  const running = !!input?.active && (input.validTill == null || input.validTill > Date.now());
  if (!running) return { active: false, tier: null, ai: false, aiLimit: AI_QUOTA.free, trialSubject: null, validTill: input?.validTill ?? null };
  const tier = tierOf(input?.plan);
  return {
    active: true,
    tier,
    ai: tier !== 'basic',
    aiLimit: tier === 'premium' ? AI_QUOTA.premium : tier === 'trial' ? AI_QUOTA.trial : AI_QUOTA.basic,
    trialSubject: tier === 'trial' ? (input?.trialSubject ?? null) : null,
    validTill: input?.validTill ?? null,
  };
}

/** Whole days left on a plan, counting today: 3 on the day a trial starts, 1 on its last day. */
export function daysLeft(validTill: number | null, now = Date.now()): number {
  if (validTill == null) return 0;
  return Math.max(0, Math.ceil((validTill - now) / 864e5));
}

/** Whether a subject's content is open under this plan: everything, except on a trial. */
export const subjectOpen = (access: Access, subjectId: string): boolean =>
  access.active && (access.tier !== 'trial' || access.trialSubject === subjectId);

/**
 * A plan's end date has passed. Not the same as "not active": a plan the admin
 * switched off early keeps an end date still to come, and saying it "ended on"
 * that date would be saying something that has not happened.
 */
export const hasEnded = (validTill: number | null | undefined, now: number = Date.now()): boolean =>
  typeof validTill === 'number' && validTill <= now;
