import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/screens/Reader';
import { getChapter, getChapterContent } from '@/lib/content-readers';
import { subjectOpen } from '@matricmate/core';
import { currentAccess } from '@/lib/entitlement';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await getChapter(id);
  return chapter ? { title: `${chapter.title} notes`, description: chapter.blurb } : { title: 'Notes' };
}

export default async function ReaderPage({ params, searchParams }: Props) {
  const { id } = await params;
  // The plan too: see the chapter page. No notes and no plan is the plan wall,
  // no notes with a plan is a chapter whose notes are not written yet. On a
  // free trial, the plan only covers the trial's subject.
  const [chapter, content, { section }, access] = await Promise.all([
    getChapter(id),
    getChapterContent(id),
    searchParams,
    currentAccess(),
  ]);
  if (!chapter) notFound();

  /* Where to open. The dashboard's "Carry on with {chapter}" button sends the
     section the student stopped at, so carrying on means carrying on rather
     than starting the chapter again. Read here rather than with
     useSearchParams so the first paint is already on the right section. */
  return <Reader chapter={chapter} content={content} paid={subjectOpen(access, chapter.subjectId)} startSection={Math.max(0, Math.trunc(Number(section)) || 0)} />;
}
