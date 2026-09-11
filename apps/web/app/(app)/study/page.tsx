import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { Chapter } from '@matricmate/core';
import { StudyList, StudyListSkeleton } from '@/components/screens/StudyList';
import { getChapters, getSubjects } from '@/lib/content-readers';

export const metadata: Metadata = {
  title: 'Study',
  description: 'Your subjects, chapter by chapter.',
};

async function Subjects() {
  const subjects = await getSubjects();
  const chapterLists = await Promise.all(subjects.map((s) => getChapters(s.id)));
  const chaptersBySubject: Record<string, Chapter[]> = Object.fromEntries(
    subjects.map((s, i) => [s.id, chapterLists[i]])
  );
  return <StudyList subjects={subjects} chaptersBySubject={chaptersBySubject} />;
}

export default function StudyPage() {
  return (
    <Suspense fallback={<StudyListSkeleton />}>
      <Subjects />
    </Suspense>
  );
}
