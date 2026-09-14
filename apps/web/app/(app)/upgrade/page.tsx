import type { Metadata } from 'next';
import { UpgradeView, type TrialState } from '@/components/screens/UpgradeView';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Start your plan',
  description: 'Premium with the AI tutor at Rs 1,000 a month, Basic at Rs 500, or three days free with one subject.',
};

/**
 * Whether this account can still start the free trial.
 *
 * Asked here, under the student's own session, so the offer never shows to
 * someone start_trial would refuse: an account that has had its trial, or has
 * ever paid. The database function checks the same things again; this only
 * decides what to put on the screen.
 */
async function trialState(): Promise<TrialState> {
  const supabase = await createClient();
  const [{ data: ent }, { count }] = await Promise.all([
    supabase.from('entitlements').select('trial_used_at').maybeSingle(),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
  ]);
  if (ent?.trial_used_at) return 'ended';
  if (count) return 'none';
  return 'eligible';
}

/** The gate lives in the layout, which decides before anything streams. */
export default async function UpgradePage() {
  return <UpgradeView trial={await trialState()} />;
}
