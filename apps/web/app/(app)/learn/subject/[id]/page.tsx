import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChapterList } from '@/components/screens/ChapterList';
import { getChapters, getSubject } from '@/lib/content-readers';
import { subjectOpen } from '@matricmate/core';
import { currentAccess } from '@/lib/entitlement';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const subject = await getSubject(id);
  return subject
    ? { title: subject.name, description: `Every ${subject.name} chapter: notes, audio, MCQs and past papers.` }
    : { title: 'Subject' };
}

export default async function SubjectPage({ params }: Props) {
  const { id } = await params;
  // The plan too: see the chapter page. Without one every count reads zero,
  // and every chapter would be marked "not on the annual paper". On a free
  // trial only its one subject is open, and the database hands over nothing
  // for the rest, so they get the same lock (worded for the trial).
  const [subject, chapters, access] = await Promise.all([getSubject(id), getChapters(id), currentAccess()]);
  if (!subject) notFound();

  return <ChapterList subject={subject} chapters={chapters} paid={subjectOpen(access, subject.id)} />;
}
