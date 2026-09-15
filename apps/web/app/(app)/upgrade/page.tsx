import type { Metadata } from 'next';
import { UpgradeView, type Lapsed } from '@/components/screens/UpgradeView';
import { planIsActive } from '@/lib/entitlement';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Start your plan',
  description: 'Premium with the AI tutor at Rs 1,000 a month, or Basic at Rs 500.',
};

/**
 * What ran out, if anything did: the free trial or a paid plan, and when.
 *
 * Read from the plan row itself. The page used to decide from trial_used_at
 * first, so a student who had the trial, then paid, then let the month run out
 * was told their free trial had ended. The row's own plan says which it was.
 * A new account never lands here: the layout sends it to /trial.
 */
async function lapsed(): Promise<Lapsed> {
  const supabase = await createClient();
  const { data: ent } = await supabase.from('entitlements').select('active, valid_till, plan').maybeSingle();
  if (!ent?.valid_till || planIsActive(ent)) return null;
  const endedAt = Date.parse(ent.valid_till);
  // Switched off by hand before its date: not "ended", just not active.
  if (!Number.isFinite(endedAt) || endedAt > Date.now()) return null;
  if (ent.plan === 'trial') return { kind: 'trial', endedAt };
  return { kind: 'plan', endedAt, plan: ent.plan === 'basic' ? 'basic' : 'premium' };
}

/** The gate lives in the layout, which decides before anything streams. */
export default async function UpgradePage() {
  return <UpgradeView lapsed={await lapsed()} />;
}
