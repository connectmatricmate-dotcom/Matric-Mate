import type { Metadata } from 'next';
import { asBoard, pastPapersByYear } from '@matricmate/core';
import { PapersScreen } from '@/components/screens/PapersScreen';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Past papers',
  description: 'Past papers, straight from your board.',
};

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
    ? await supabase.from('profiles').select('grade,board').eq('id', auth.user.id).maybeSingle()
    : { data: null };

  const board = asBoard(profile?.board);
  const groups = pastPapersByYear(board, profile?.grade ?? 9);
  return <PapersScreen groups={groups} board={board} />;
}
