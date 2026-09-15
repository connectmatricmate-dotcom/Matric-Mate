import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { TrialStart } from '@/components/screens/TrialStart';
import { createClient, getUser } from '@/lib/supabase/server';

export const generateMetadata = (): Promise<Metadata> => localTitle('trialStart.title', 'Three days with one subject: its chapters, notes, audio and practice.');

/**
 * The first screen after onboarding for a new account: the free trial starts
 * by picking its one subject. The layout sends a new account here and anyone
 * else away (a plan running, or the trial already had).
 *
 * The student's own subjects, counted against the chapters published for
 * their class and board, so a subject with nothing in it is never offered:
 * start_trial refuses one, and a student who picked it met "The trial could
 * not start. Try again", which no retry could fix.
 */
export default async function TrialPage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = user
    ? await supabase.from('profiles').select('onboarding, grade').eq('id', user.id).maybeSingle()
    : { data: null };
  const onboarding = (profile?.onboarding ?? {}) as { board?: string; classLevel?: number; subjects?: string[] };
  const board = onboarding.board === 'punjab' ? 'punjab' : 'fbise';
  const grade = onboarding.classLevel === 10 || profile?.grade === 10 ? 10 : 9;

  const { data: chapters } = await supabase
    .from('chapters')
    .select('subject_id')
    .eq('board', board)
    .eq('grade', grade)
    .eq('review_status', 'published');
  const counts: Record<string, number> = {};
  for (const c of (chapters ?? []) as { subject_id: string }[]) counts[c.subject_id] = (counts[c.subject_id] ?? 0) + 1;

  const mine = Array.isArray(onboarding.subjects) ? onboarding.subjects : [];
  const offered = mine.filter((id) => (chapters ? (counts[id] ?? 0) > 0 : true)).map((id) => ({ id, chapters: counts[id] ?? 0 }));

  return <TrialStart offered={offered} />;
}
