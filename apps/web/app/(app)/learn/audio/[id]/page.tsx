import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AUDIO_TRACKS, api } from '@matricmate/core';
import { AudioLesson } from '@/components/screens/AudioLesson';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await api.getChapter(id);
  return chapter ? { title: `${chapter.title} audio lesson` } : { title: 'Audio lesson' };
}

export default async function AudioPage({ params }: Props) {
  const { id } = await params;
  const [chapter, content] = await Promise.all([api.getChapter(id), api.getChapterContent(id)]);
  if (!chapter) notFound();

  return <AudioLesson chapter={chapter} audioTitle={content.audioTitle} tracks={AUDIO_TRACKS[id] ?? null} />;
}
