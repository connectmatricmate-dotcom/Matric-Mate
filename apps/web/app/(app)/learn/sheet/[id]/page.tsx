import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SheetScreen } from '@/components/screens/SheetScreen';
import { getChapter } from '@/lib/content-readers';

export const metadata: Metadata = {
  title: 'Revision sheet',
  description: 'A one-page AI revision sheet for this chapter.',
};

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /* The chapter from the server, like the reader and the hub. The screen
     used to look it up in the browser's index, which is empty on a cold load
     for Class 10 and Punjab, so the back link and the subtitle were blank, and
     a bad id looped "Couldn't load" and Try again instead of saying there is
     no such chapter. */
  const chapter = await getChapter(id);
  if (!chapter) notFound();
  return <SheetScreen chapter={chapter} />;
}
