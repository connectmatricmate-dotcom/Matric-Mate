import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/screens/Reader';
import { getChapter, getChapterContent } from '@/lib/content-readers';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const chapter = await getChapter(id);
  return chapter ? { title: `${chapter.title} notes`, description: chapter.blurb } : { title: 'Notes' };
}

export default async function ReaderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const [chapter, content, { section }] = await Promise.all([getChapter(id), getChapterContent(id), searchParams]);
  if (!chapter) notFound();

  /* Where to open. The dashboard's "Carry on with {chapter}" button sends the
     section the student stopped at, so carrying on means carrying on rather
     than starting the chapter again. Read here rather than with
     useSearchParams so the first paint is already on the right section. */
  return <Reader chapter={chapter} content={content} startSection={Math.max(0, Math.trunc(Number(section)) || 0)} />;
}
