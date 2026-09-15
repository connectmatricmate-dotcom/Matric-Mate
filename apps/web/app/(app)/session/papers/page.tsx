import type { Metadata } from 'next';
import { asBoard, pastPaperGroups } from '@matricmate/core';
import { PapersScreen } from '@/components/screens/PapersScreen';
import { createClient } from '@/lib/supabase/server';
import { currentAccess } from '@/lib/entitlement';
import { localTitle } from '@/lib/page-title';

export const generateMetadata = (): Promise<Metadata> => localTitle('session.papersTitle', 'Past papers, straight from your board.');

export default async function PapersPage() {
  /**
   * The student's own class and board, read here rather than assumed. The
   * list used to be hardcoded to Class 9, so a Class 10 student was shown
   * SSC-I papers as though they were theirs; a Punjab student would have been
   * shown FBISE's the same way.
   */
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth.user
    ? await supabase.from('profiles').select('grade,board,onboarding').eq('id', auth.user.id).maybeSingle()
    : { data: null };

  const board = asBoard(profile?.board);
  // Punjab lists run per subject, so only the student's own subjects, and on
  // a free trial only its one subject, like every other list in the trial.
  // (FBISE's papers are one file a year for every subject, so they stay.)
  const access = await currentAccess();
  const subjects =
    access.tier === 'trial' && access.trialSubject
      ? [access.trialSubject]
      : (profile?.onboarding as { subjects?: string[] } | null)?.subjects;
  const groups = pastPaperGroups(board, profile?.grade ?? 9, subjects);
  return <PapersScreen groups={groups} board={board} />;
}
