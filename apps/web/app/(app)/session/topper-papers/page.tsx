import type { Metadata } from 'next';
import { fbiseTopperSubjectIds, fbiseToppersFor } from '@matricmate/core';
import { createClient } from '@/lib/supabase/server';
import { TopperPapersScreen } from '@/components/screens/TopperPapersScreen';
import { currentAccess } from '@/lib/entitlement';
import { localTitle } from '@/lib/page-title';

// No class in the description: the scripts carry none, see topperYears.
export const generateMetadata = (): Promise<Metadata> =>
  localTitle('session.toppersTitle', 'Marked FBISE topper answer scripts, subject by subject.');

export default async function TopperPapersPage() {
  // These are FBISE's own scripts. The dashboard and practice tabs do not
  // offer them to a Punjab student, and a link that gets here anyway is
  // answered with why there are none, not with another board's.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth.user
    ? await supabase.from('profiles').select('board').eq('id', auth.user.id).maybeSingle()
    : { data: null };
  const punjab = profile?.board === 'punjab';

  // On a free trial, the trial's subject only, as everywhere else in it.
  const access = await currentAccess();
  const trialSubject = access.tier === 'trial' ? access.trialSubject : null;
  const groups = punjab
    ? []
    : fbiseTopperSubjectIds()
        .filter((subjectId) => !trialSubject || subjectId === trialSubject)
        .map((subjectId) => ({
          subjectId,
          scripts: fbiseToppersFor(subjectId),
        }));
  return <TopperPapersScreen groups={groups} punjab={punjab} />;
}
