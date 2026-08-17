import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

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
 * Expiry is checked here rather than trusted from the `active` column. That
 * column is written by the payment webhook and is only correct until the plan
 * runs out; nothing sweeps it afterwards, so a lapsed account would read as
 * active until its next payment.
 */
export const hasActivePlan = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.from('entitlements').select('active, valid_till').maybeSingle();
  if (!data?.active) return false;
  if (!data.valid_till) return false;
  return new Date(data.valid_till).getTime() > Date.now();
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
