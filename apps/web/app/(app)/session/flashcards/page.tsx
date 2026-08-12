import type { Metadata } from 'next';
import { chapterById } from '@matricmate/core';
import { getFlashcards } from '@/lib/content-readers';
import { FlashcardsScreen } from '@/components/screens/FlashcardsScreen';

export const metadata: Metadata = {
  title: 'Flashcards',
  description: 'Active recall, one card at a time.',
};

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
  const { chapter } = await searchParams;
  const chapterId = chapter ?? 'phy-3';
  const cards = await getFlashcards(chapterId);
  return <FlashcardsScreen chapterId={chapterId} chapterTitle={chapterById(chapterId)?.title ?? ''} cards={cards} />;
}
