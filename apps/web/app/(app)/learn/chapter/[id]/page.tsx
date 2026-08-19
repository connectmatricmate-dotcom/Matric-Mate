import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasStudyMaterial } from '@matricmate/core';
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

  /**
   * The row says there is material and the content read came back with none of
   * it, so the read failed.
   *
   * The fetch layer never throws: an error, a null and an empty array all
   * return the bundled sample, which is empty content for all but three
   * chapters. Rendering that gives a hub reading "0 sections, 0 cards, 0
   * questions" next to the "8 MCQs" the student just saw on the subject list.
   * Throwing hands it to the route's error boundary, which is the one surface
   * with a Try again on it.
   */
  if (hasStudyMaterial(chapter) && !content.sections.length && !content.mcqs.length && !content.flashcards.length) {
    throw new Error(`chapter content unavailable: ${id}`);
  }

  return (
    <ChapterHub chapter={chapter} content={content} tracks={tracks} />
  );
}
