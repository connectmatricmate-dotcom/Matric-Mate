import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, subjectById } from '@matricmate/core';
import { ChapterHub } from '@/components/screens/ChapterHub';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await api.getChapter(id);
  return chapter
    ? { title: chapter.title, description: chapter.blurb }
    : { title: 'Chapter' };
}

export default async function ChapterPage({ params }: Props) {
  const { id } = await params;
  const [chapter, content] = await Promise.all([api.getChapter(id), api.getChapterContent(id)]);
  if (!chapter) notFound();

  return <ChapterHub chapter={chapter} content={content} subjectName={subjectById(chapter.subjectId)?.name ?? ''} />;
}
