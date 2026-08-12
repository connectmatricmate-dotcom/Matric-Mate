import type { Metadata } from 'next';
import { fbiseTopperSubjectIds, fbiseToppersFor } from '@matricmate/core';
import { TopperPapersScreen } from '@/components/screens/TopperPapersScreen';

export const metadata: Metadata = {
  title: 'Topper papers',
  description: 'Marked FBISE Class 9 topper answer scripts, subject by subject.',
};

export default function TopperPapersPage() {
  const groups = fbiseTopperSubjectIds().map((subjectId) => ({
    subjectId,
    scripts: fbiseToppersFor(subjectId),
  }));
  return <TopperPapersScreen groups={groups} />;
}
