import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AudioLesson } from '@/components/screens/AudioLesson';
import { getAudioTracks, getChapter, getChapterContent } from '@/lib/content-readers';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await getChapter(id);
  return chapter ? { title: `${chapter.title} audio lesson` } : { title: 'Audio lesson' };
}

export default async function AudioPage({ params }: Props) {
  const { id } = await params;
  const [chapter, content, tracks] = await Promise.all([getChapter(id), getChapterContent(id), getAudioTracks(id)]);
  if (!chapter) notFound();
  // No recording, no player. The hub hides the row too, so this is only
  // reachable by typing the URL.
  if (!tracks.length) notFound();

  return <AudioLesson chapter={chapter} audioTitle={content.audioTitle} tracks={tracks} />;
}
