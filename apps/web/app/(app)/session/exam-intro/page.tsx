import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { subjectOpen } from '@matricmate/core';
import { ExamIntro } from '@/components/screens/ExamIntro';
import { getChapter, getSubject } from '@/lib/content-readers';
import { currentAccess } from '@/lib/entitlement';

export const metadata: Metadata = {
  title: 'Timed test',
  description: '20 questions, 30 minutes, double XP, exam conditions.',
};

export default async function ExamIntroPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; chapter?: string; paper?: string; ai?: string; topics?: string }>;
}) {
  const { subject, chapter, paper, ai, topics } = await searchParams;

  /* The chapter and subject from the server, under the student's own session.
     They were looked up in the browser's chapter index, which is empty on a
     cold load for Class 10 and Punjab, so the test had no name; and a chapter
     from another syllabus was taken on trust. Row level security scopes the
     read to the student's board and class, so another syllabus's id is not
     found. */
  const ownChapter = chapter ? await getChapter(chapter) : undefined;
  if (chapter && !ownChapter) notFound();
  const ownSubject = subject ? await getSubject(subject) : undefined;
  if (subject && !ownSubject) notFound();

  /* A free trial's test is of its own subject: the database would hand the
     test no questions from any other, so the link goes to where the lock is
     explained. */
  const access = await currentAccess();
  if (ownChapter && !subjectOpen(access, ownChapter.subjectId)) redirect(`/learn/chapter/${ownChapter.id}`);
  if (ownSubject && !subjectOpen(access, ownSubject.id)) redirect(`/learn/subject/${ownSubject.id}`);

  return (
    <ExamIntro
      subject={ownSubject}
      chapter={ownChapter}
      paper={paper}
      ai={ai === '1'}
      topics={topics ? topics.split('|').filter(Boolean) : undefined}
    />
  );
}
