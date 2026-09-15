import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { normalizeAiShortQs } from '@matricmate/core';
import { ShortQScreen } from '@/components/screens/ShortQScreen';
import { getChapterContent } from '@/lib/content-readers';
import { aiPracticeSet, practiceChapter } from '../practice-chapter';

export const generateMetadata = (): Promise<Metadata> => localTitle('practice.shortQ', 'Board-style short questions with model answers and marking points.');

export default async function ShortQPage({ searchParams }: { searchParams: Promise<{ chapter?: string; ai?: string }> }) {
  const { chapter: requested, ai } = await searchParams;
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  if (ai) {
    const { set, chapter } = await aiPracticeSet(ai, requested);
    const items = normalizeAiShortQs(set.items as Parameters<typeof normalizeAiShortQs>[0], chapter.id, set.id);
    return <ShortQScreen key={set.id} chapter={chapter} items={items} />;
  }
  const chapter = await practiceChapter(requested, 'shortq');
  /* A read that fails throws, for the route's Try again; an empty answer is
     what this student may see, and the screen says there is nothing here. */
  const content = await getChapterContent(chapter.id);
  return <ShortQScreen key={chapter.id} chapter={chapter} items={content.shortQs} canChangeChapter />;
}
