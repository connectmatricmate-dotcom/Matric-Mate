import type { Metadata } from 'next';
import { Suspense } from 'react';
import { api } from '@matricmate/core';
import { StudyList, StudyListSkeleton } from '@/components/screens/StudyList';

export const metadata: Metadata = {
  title: 'Study',
  description: 'Your FBISE Class 9 subjects, chapter by chapter.',
};

async function Subjects() {
  const subjects = await api.getSubjects();
  return <StudyList subjects={subjects} />;
}

export default function StudyPage() {
  return (
    <Suspense fallback={<StudyListSkeleton />}>
      <Subjects />
    </Suspense>
  );
}
