import 'server-only';
import { cache } from 'react';
import { boardChoice } from '@matricmate/core';
import type { SetupStep } from '@/components/app/SetupGate';
import { createClient, getUser } from '@/lib/supabase/server';

/**
 * The onboarding step an account stopped before, or null when its setup is
 * complete: a board, a medium and at least one subject saved. Only the first
 * missing step, so a student who has everything but their subjects answers
 * one screen, not four. A failed read answers null, because sending a student
 * back through setup on a database hiccup is worse than letting them in.
 *
 * Shared by the app shell and the sign-in landing, which both have to put
 * setup before the trial or the plans: a new account sent to the trial first
 * had no subjects to pick from, and nowhere to go.
 */
export const unfinishedStep = cache(async (): Promise<SetupStep | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('onboarding').eq('id', user.id).maybeSingle();
  if (error || !data) return null;
  const onboarding = data.onboarding as { medium?: unknown; subjects?: unknown } | null;
  if (!onboarding) return 'class';
  if (!boardChoice(onboarding)) return 'board';
  if (onboarding.medium !== 'en' && onboarding.medium !== 'ur') return 'medium';
  if (!Array.isArray(onboarding.subjects) || onboarding.subjects.length === 0) return 'subjects';
  return null;
});
