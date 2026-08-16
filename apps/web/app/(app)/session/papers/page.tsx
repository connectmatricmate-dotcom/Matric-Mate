import type { Metadata } from 'next';
import { fbisePastPapersByYear } from '@matricmate/core';
import { PapersScreen } from '@/components/screens/PapersScreen';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Past papers',
  description: 'FBISE past papers, straight from the board.',
};

export default async function PapersPage() {
  /**
   * The student's own class, read here rather than assumed. The list used to
   * be hardcoded to Class 9, so a Class 10 student was shown SSC-I papers as
   * though they were theirs.
   */
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth.user
    ? await supabase.from('profiles').select('grade').eq('id', auth.user.id).maybeSingle()
    : { data: null };

  const groups = fbisePastPapersByYear(profile?.grade ?? 9);
  return <PapersScreen groups={groups} />;
}
