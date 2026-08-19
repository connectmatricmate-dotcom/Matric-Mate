import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChapterHub } from '@/components/screens/ChapterHub';
import { getAudioTracks, getChapter, getChapterContent } from '@/lib/content-readers';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await getChapter(id);
  return chapter
    ? { title: chapter.title, description: chapter.blurb }
    : { title: 'Chapter' };
}

export default async function ChapterPage({ params }: Props) {
  const { id } = await params;
  const [chapter, content, tracks] = await Promise.all([getChapter(id), getChapterContent(id), getAudioTracks(id)]);
  if (!chapter) notFound();

  return (
    <ChapterHub chapter={chapter} content={content} tracks={tracks} />
  );
}
