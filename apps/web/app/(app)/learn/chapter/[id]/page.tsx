import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChapterHub } from '@/components/screens/ChapterHub';
import { getAudioTracks, getChapter, getChapterContent } from '@/lib/content-readers';
import { subjectOpen } from '@matricmate/core';
import { currentAccess } from '@/lib/entitlement';

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
  /*
   * A read that fails throws on its own now, which is what the route's
   * Try again is for. This page used to throw itself whenever a chapter with
   * material came back with no content, from when a failed read looked like
   * an empty one. An empty answer is the answer now, what this student may
   * read, and a chapter with questions but no published notes is one of them.
   *
   * The plan comes with it (the layout has already asked, so it is cached):
   * under row level security an account without one sees every chapter with
   * no material at all, and the hub has to say "this needs a plan" before it
   * decides there is nothing here. A free trial counts as a plan only for
   * its own subject, which is also all the database will serve it.
   */
  const [chapter, content, tracks, access] = await Promise.all([
    getChapter(id),
    getChapterContent(id),
    getAudioTracks(id),
    currentAccess(),
  ]);
  if (!chapter) notFound();

  return <ChapterHub chapter={chapter} content={content} tracks={tracks} paid={subjectOpen(access, chapter.subjectId)} />;
}
