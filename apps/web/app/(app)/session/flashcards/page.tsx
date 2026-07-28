import type { Metadata } from 'next';
import { api, chapterById } from '@matricmate/core';
import { FlashcardsScreen } from '@/components/screens/FlashcardsScreen';

export const metadata: Metadata = {
  title: 'Flashcards',
  description: 'Active recall, one card at a time.',
};

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
  const { chapter } = await searchParams;
  const chapterId = chapter ?? 'phy-3';
  const cards = await api.getFlashcards(chapterId);
  return <FlashcardsScreen chapterId={chapterId} chapterTitle={chapterById(chapterId)?.title ?? ''} cards={cards} />;
}
