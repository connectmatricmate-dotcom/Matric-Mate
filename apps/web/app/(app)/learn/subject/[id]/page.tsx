import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@matricmate/core';
import { ChapterList } from '@/components/screens/ChapterList';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const subject = await api.getSubject(id);
  return subject
    ? { title: subject.name, description: `Every FBISE Class 9 ${subject.name} chapter: notes, audio, MCQs and past papers.` }
    : { title: 'Subject' };
}

export default async function SubjectPage({ params }: Props) {
  const { id } = await params;
  const [subject, chapters] = await Promise.all([api.getSubject(id), api.getChapters(id)]);
  if (!subject) notFound();

  return <ChapterList subject={subject} chapters={chapters} />;
}
