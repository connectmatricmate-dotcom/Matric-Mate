import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@matricmate/core';
import { Reader } from '@/components/screens/Reader';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await api.getChapter(id);
  return chapter ? { title: `${chapter.title} notes`, description: chapter.blurb } : { title: 'Notes' };
}

export default async function ReaderPage({ params }: Props) {
  const { id } = await params;
  const [chapter, content] = await Promise.all([api.getChapter(id), api.getChapterContent(id)]);
  if (!chapter) notFound();

  return <Reader chapter={chapter} content={content} />;
}
