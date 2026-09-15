import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { notFound, redirect } from 'next/navigation';
import { subjectOpen } from '@matricmate/core';
import { AiLocked } from '@/components/app/AiLocked';
import { SheetScreen } from '@/components/screens/SheetScreen';
import { getChapter } from '@/lib/content-readers';
import { currentAccess } from '@/lib/entitlement';

export const generateMetadata = (): Promise<Metadata> => localTitle('tutor.sheetTitle', 'A one-page AI revision sheet for this chapter.');

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /* The chapter from the server, like the reader and the hub. The screen
     used to look it up in the browser's index, which is empty on a cold load
     for Class 10 and Punjab, so the back link and the subtitle were blank, and
     a bad id looped "Couldn't load" and Try again instead of saying there is
     no such chapter. */
  const [chapter, access] = await Promise.all([getChapter(id), currentAccess()]);
  if (!chapter) notFound();
  // Another subject than a free trial's: the chapter page says why it is shut.
  if (!subjectOpen(access, chapter.subjectId)) redirect(`/learn/chapter/${chapter.id}`);
  // The sheet is written by the AI, so it is not in Basic.
  if (!access.ai) return <AiLocked titleKey="tutor.sheetTitle" back={`/learn/chapter/${chapter.id}`} backLabelKey="session.backToChapter" />;
  return <SheetScreen chapter={chapter} />;
}
