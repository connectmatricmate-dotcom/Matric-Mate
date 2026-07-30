import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/screens/Reader';
import { getChapter, getChapterContent } from '@/lib/content-readers';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await getChapter(id);
  return chapter ? { title: `${chapter.title} notes`, description: chapter.blurb } : { title: 'Notes' };
}

export default async function ReaderPage({ params }: Props) {
  const { id } = await params;
  const [chapter, content] = await Promise.all([getChapter(id), getChapterContent(id)]);
  if (!chapter) notFound();

  return <Reader chapter={chapter} content={content} />;
}
