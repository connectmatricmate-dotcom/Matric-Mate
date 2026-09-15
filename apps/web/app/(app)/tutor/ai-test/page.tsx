import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { Suspense } from 'react';
import type { Chapter } from '@matricmate/core';
import { AiTestScreen, AiTestSkeleton } from '@/components/screens/AiTestScreen';
import { getChapters, getSubjects } from '@/lib/content-readers';

export const generateMetadata = (): Promise<Metadata> => localTitle('tutor.aiTestTitle', 'A paper built from the topics you keep getting wrong.');

/**
 * The chapters to build from, read on the server under the student's own
 * session, the way the MCQ setup reads them.
 *
 * The screen used to take them from the browser's chapter index on its first
 * render, before the store knew the student's class and board and before the
 * index had loaded. It got FBISE's Class 9 list and kept it, so every Class 10
 * and Punjab student sent a chapter from another syllabus, the route refused
 * it, and each retry failed the same way.
 */
async function Builder() {
  const subjects = await getSubjects();
  const chapterLists = await Promise.all(subjects.map((s) => getChapters(s.id)));
  const chaptersBySubject: Record<string, Chapter[]> = Object.fromEntries(subjects.map((s, i) => [s.id, chapterLists[i]]));
  return <AiTestScreen chaptersBySubject={chaptersBySubject} />;
}

export default function AiTestPage() {
  return (
    <Suspense fallback={<AiTestSkeleton />}>
      <Builder />
    </Suspense>
  );
}
