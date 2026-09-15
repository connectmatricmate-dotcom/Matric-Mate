import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { subjectOpen } from '@matricmate/core';
import { AudioLesson } from '@/components/screens/AudioLesson';
import { getAudioTracks, getChapter } from '@/lib/content-readers';
import { currentAccess } from '@/lib/entitlement';
import { chapterTitle } from '@/lib/page-title';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return chapterTitle(await getChapter(id), 'study.audio');
}

export default async function AudioPage({ params }: Props) {
  const { id } = await params;
  const [chapter, tracks, access] = await Promise.all([getChapter(id), getAudioTracks(id), currentAccess()]);
  if (!chapter) notFound();
  // Another subject than a free trial's: the chapter page says why it is shut.
  if (!subjectOpen(access, chapter.subjectId)) redirect(`/learn/chapter/${chapter.id}`);
  // No recording, no player. The hub hides the row too, so this is only
  // reachable by typing the URL. A read that failed is not "no recording":
  // it throws (getAudioTracks), and learn/error.tsx offers Try again.
  if (!tracks.length) notFound();

  return <AudioLesson chapter={chapter} tracks={tracks} />;
}
