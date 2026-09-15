import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { asBoard } from '@matricmate/core';
import { PracticeView } from '@/components/screens/PracticeView';
import { createClient, getUser } from '@/lib/supabase/server';

export const generateMetadata = (): Promise<Metadata> => localTitle('tabs.practice', 'MCQs, flashcards, fill in the blanks, short questions, past papers and timed tests.');

export default async function PracticePage() {
  /**
   * The account's board and class, for the first paint. The tiles that differ
   * by board (topper papers are FBISE's alone, and the past papers line names
   * the board and years) were decided from the browser's copy, which is empty
   * until the store has loaded: a Punjab student saw FBISE's tiles first.
   */
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = user
    ? await supabase.from('profiles').select('grade,board').eq('id', user.id).maybeSingle()
    : { data: null };

  return <PracticeView board={asBoard(profile?.board)} grade={profile?.grade === 10 ? 10 : 9} />;
}
