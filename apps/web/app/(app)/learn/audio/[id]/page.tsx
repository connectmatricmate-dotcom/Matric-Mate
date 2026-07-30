import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AUDIO_TRACKS } from '@matricmate/core';
import { AudioLesson } from '@/components/screens/AudioLesson';
import { getChapter, getChapterContent } from '@/lib/content-readers';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await getChapter(id);
  return chapter ? { title: `${chapter.title} audio lesson` } : { title: 'Audio lesson' };
}

export default async function AudioPage({ params }: Props) {
  const { id } = await params;
  const [chapter, content] = await Promise.all([getChapter(id), getChapterContent(id)]);
  if (!chapter) notFound();

  return <AudioLesson chapter={chapter} audioTitle={content.audioTitle} tracks={AUDIO_TRACKS[id] ?? null} />;
}
