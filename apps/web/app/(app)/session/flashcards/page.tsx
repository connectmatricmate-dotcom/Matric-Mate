import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { normalizeAiCards } from '@matricmate/core';
import { FlashcardsScreen } from '@/components/screens/FlashcardsScreen';
import { getChapterContent } from '@/lib/content-readers';
import { aiPracticeSet, practiceChapter } from '../practice-chapter';

export const generateMetadata = (): Promise<Metadata> => localTitle('practice.flashcards', 'Active recall, one card at a time.');

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<{ chapter?: string; ai?: string }> }) {
  const { chapter: requested, ai } = await searchParams;
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  if (ai) {
    const { set, chapter } = await aiPracticeSet(ai, requested);
    const cards = normalizeAiCards(set.items as Parameters<typeof normalizeAiCards>[0], chapter.id, set.id);
    return <FlashcardsScreen key={set.id} chapter={chapter} cards={cards} />;
  }
  const chapter = await practiceChapter(requested, 'cards');
  /* A read that fails throws, for the route's Try again; an empty answer is
     what this student may see, and the screen says there is nothing here. */
  const content = await getChapterContent(chapter.id);
  return <FlashcardsScreen key={chapter.id} chapter={chapter} cards={content.flashcards} canChangeChapter />;
}
