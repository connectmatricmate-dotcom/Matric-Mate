import type { Metadata } from 'next';
import { chapterById, normalizeAiCards } from '@matricmate/core';
import { getAiSession, getFlashcards } from '@/lib/content-readers';
import { FlashcardsScreen } from '@/components/screens/FlashcardsScreen';

export const metadata: Metadata = {
  title: 'Flashcards',
  description: 'Active recall, one card at a time.',
};

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<{ chapter?: string; ai?: string }> }) {
  const { chapter, ai } = await searchParams;
  const chapterId = chapter ?? 'phy-3';
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  if (ai) {
    const s = await getAiSession(ai);
    if (s) {
      const cards = normalizeAiCards(s.items as Parameters<typeof normalizeAiCards>[0], s.chapterId ?? chapterId);
      return <FlashcardsScreen chapterId={s.chapterId ?? chapterId} chapterTitle={s.title} cards={cards} />;
    }
  }
  const cards = await getFlashcards(chapterId);
  return <FlashcardsScreen chapterId={chapterId} chapterTitle={chapterById(chapterId)?.title ?? ''} cards={cards} />;
}
