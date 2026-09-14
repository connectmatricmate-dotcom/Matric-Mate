import { cache } from 'react';
import { accessFor, type Access } from '@matricmate/core';
import { createClient } from '@/lib/supabase/server';

/**
 * What "has a plan" means, written once.
 *
 * It was written four times and they did not agree: the AI routes counted a
 * plan with no end date as live, the paywall did not, and the admin overview
 * counted the `active` column with no date at all. The column is written by
 * the payment path and nothing sweeps it when a plan runs out, so the date is
 * the part that matters, and a plan with no date is not a plan. The refund
 * path is the only writer of a null date and it switches `active` off in the
 * same update, so nobody who has paid is on the wrong side of this.
 *
 * Pure on purpose, so the proxy, the AI routes and the staff pages can all ask
 * the same question of whatever row they already hold.
 */
export function planIsActive(row: { active?: boolean | null; valid_till?: string | null } | null | undefined): boolean {
  if (!row?.active || !row.valid_till) return false;
  const till = Date.parse(row.valid_till);
  return Number.isFinite(till) && till > Date.now();
}

type PlanRow = { active?: boolean | null; valid_till?: string | null; plan?: string | null; trial_subject?: string | null };

/**
 * A plan somebody paid for, running now: any active plan except the free
 * trial. What "has paid" means on a teacher's dashboard and in the admin's
 * counts, where a trial counted as a sale would inflate both.
 */
export function planIsPaid(row: PlanRow | null | undefined): boolean {
  return planIsActive(row) && row?.plan !== 'trial';
}

/** What this row lets its student do: the tier, AI, the AI allowance, a trial's subject. See accessFor in core. */
export function accessFromRow(row: PlanRow | null | undefined): Access {
  return accessFor({
    active: planIsActive(row),
    plan: row?.plan ?? null,
    validTill: row?.valid_till ? Date.parse(row.valid_till) : null,
    trialSubject: row?.trial_subject ?? null,
  });
}

/** The signed-in student's access, read once per request like hasActivePlan below. */
export const currentAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('entitlements').select('active, valid_till, plan, trial_subject').maybeSingle();
  if (error) {
    console.error('entitlement: plan read failed', error.message);
    throw new Error('Could not check the plan on this account.');
  }
  return accessFromRow(data);
});

/**
 * Does this account have a plan right now.
 *
 * There is no free tier: the client's decision is that every account pays, so
 * this is the single question the whole app is gated on. Read through
 * `React.cache` so a page that asks twice, once in the layout guard and once in
 * a screen, still costs one query.
 *
 * Reads under the caller's own session rather than the admin client, so row
 * level security is doing the work and this cannot accidentally answer for
 * somebody else's account.
 *
 * A failed read throws rather than answering "no". Answering no sent a paying
 * student to the price list whenever the database was slow, and the proxy and
 * this guard then bounced them between /upgrade and /dashboard until the
 * browser gave up. An error boundary with a Try again is the honest answer to
 * "we could not check".
 */
export const hasActivePlan = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('entitlements').select('active, valid_till').maybeSingle();
  if (error) {
    console.error('entitlement: plan read failed', error.message);
    throw new Error('Could not check the plan on this account.');
  }
  return planIsActive(data);
});

/**
 * Screens an account without a plan may still reach.
 *
 * Everything else redirects to the upgrade page. These four exist so a student
 * who has not paid is never trapped: they can see whose account it is, sign
 * out, check whether a payment landed, and read their receipts. Locking those
 * away turns a paywall into a support ticket.
 */
const OPEN_WITHOUT_PLAN = ['/upgrade', '/account'];

export function isOpenWithoutPlan(pathname: string): boolean {
  // An unknown path is treated as open. The pathname arrives as a header set
  // by the proxy, and if that ever stops arriving, redirecting on a path we
  // cannot read sends the upgrade page to itself, forever. A paywall that
  // leaks a screen is a bug; one that traps every student in a redirect loop
  // is an outage.
  if (!pathname) return true;
  return OPEN_WITHOUT_PLAN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
