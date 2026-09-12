import type { Metadata } from 'next';
import { normalizeAiBlanks } from '@matricmate/core';
import { BlanksScreen } from '@/components/screens/BlanksScreen';
import { getChapterContent } from '@/lib/content-readers';
import { aiPracticeSet, practiceChapter } from '../practice-chapter';

export const metadata: Metadata = {
  title: 'Fill in the blanks',
  description: 'Recall practice, one sentence at a time.',
};

export default async function BlanksPage({ searchParams }: { searchParams: Promise<{ chapter?: string; ai?: string }> }) {
  const { chapter: requested, ai } = await searchParams;
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  if (ai) {
    const { set, chapter } = await aiPracticeSet(ai, requested);
    const items = normalizeAiBlanks(set.items as Parameters<typeof normalizeAiBlanks>[0], chapter.id, set.id);
    return <BlanksScreen key={set.id} chapter={chapter} items={items} />;
  }
  const chapter = await practiceChapter(requested);
  /* A read that fails throws, for the route's Try again; an empty answer is
     what this student may see, and the screen says there is nothing here. */
  const content = await getChapterContent(chapter.id);
  return <BlanksScreen key={chapter.id} chapter={chapter} items={content.blanks} />;
}
