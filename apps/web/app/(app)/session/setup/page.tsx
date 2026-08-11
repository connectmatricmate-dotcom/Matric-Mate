import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { Chapter } from '@matricmate/core';
import { SessionSetup, SessionSetupSkeleton } from '@/components/screens/SessionSetup';
import { getChapters, getSubjects } from '@/lib/content-readers';

export const metadata: Metadata = {
  title: 'New MCQ session',
  description: 'Pick a subject, chapters and how many questions you want to practise.',
};

/**
 * Which subject chip is picked, and which chapters it ticks, both happen
 * client-side (a chip click is not worth a navigation). So every subject's
 * chapters come down together: the student's actual subject list lives in
 * client state, not here, and the full curriculum is small enough that
 * fetching it all up front beats re-fetching per click.
 */
async function Setup({ chapter }: { chapter?: string }) {
  const subjects = await getSubjects();
  const chapterLists = await Promise.all(subjects.map((s) => getChapters(s.id)));
  const chaptersBySubject: Record<string, Chapter[]> = Object.fromEntries(
    subjects.map((s, i) => [s.id, chapterLists[i]])
  );
  return <SessionSetup initialChapterId={chapter} chaptersBySubject={chaptersBySubject} />;
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
  const { chapter } = await searchParams;
  return (
    <Suspense fallback={<SessionSetupSkeleton />}>
      <Setup chapter={chapter} />
    </Suspense>
  );
}
