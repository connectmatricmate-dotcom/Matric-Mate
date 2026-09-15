import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { UpgradeView, type Lapsed } from '@/components/screens/UpgradeView';
import { accessFromRow, planIsActive } from '@/lib/entitlement';
import { createClient } from '@/lib/supabase/server';

export const generateMetadata = (): Promise<Metadata> => localTitle('plans.current', 'Premium with the AI tutor at Rs 1,000 a month, or Basic at Rs 500.');

type Row = { active: boolean | null; valid_till: string | null; plan: string | null; trial_subject: string | null } | null;

/**
 * What ran out, if anything did: the free trial or a paid plan, and when.
 *
 * Read from the plan row itself. The page used to decide from trial_used_at
 * first, so a student who had the trial, then paid, then let the month run out
 * was told their free trial had ended. The row's own plan says which it was.
 * A new account never lands here: the layout sends it to /trial.
 */
function lapsed(ent: Row): Lapsed {
  if (!ent?.valid_till || planIsActive(ent)) return null;
  const endedAt = Date.parse(ent.valid_till);
  if (!Number.isFinite(endedAt)) return null;
  // Switched off by hand before its date: not "ended", and not "no plan yet"
  // either. The account is simply not active.
  if (endedAt > Date.now()) return { kind: 'off' };
  if (ent.plan === 'trial') return { kind: 'trial', endedAt };
  return { kind: 'plan', endedAt, plan: ent.plan === 'basic' ? 'basic' : 'premium' };
}

/**
 * The gate lives in the layout, which decides before anything streams.
 *
 * The plan read here also heads the page. The heading took the browser's copy
 * of the plan, which lags a change made on the server (a plan granted by hand,
 * a trial that has just run out) until the next reload.
 */
export default async function UpgradePage() {
  const supabase = await createClient();
  const { data } = await supabase.from('entitlements').select('active, valid_till, plan, trial_subject').maybeSingle();
  const ent = data as Row;
  return <UpgradeView lapsed={lapsed(ent)} current={accessFromRow(ent)} />;
}
