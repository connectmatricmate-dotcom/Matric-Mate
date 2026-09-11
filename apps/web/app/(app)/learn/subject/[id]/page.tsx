import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChapterList } from '@/components/screens/ChapterList';
import { getChapters, getSubject } from '@/lib/content-readers';

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
  const [subject, chapters] = await Promise.all([getSubject(id), getChapters(id)]);
  if (!subject) notFound();

  return <ChapterList subject={subject} chapters={chapters} />;
}
