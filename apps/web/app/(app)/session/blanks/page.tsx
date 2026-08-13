import type { Metadata } from 'next';
import { chapterById, normalizeAiBlanks } from '@matricmate/core';
import { getAiSession, getChapterContent } from '@/lib/content-readers';
import { BlanksScreen } from '@/components/screens/BlanksScreen';

export const metadata: Metadata = {
  title: 'Fill in the blanks',
  description: 'Recall practice, one sentence at a time.',
};

export default async function BlanksPage({ searchParams }: { searchParams: Promise<{ chapter?: string; ai?: string }> }) {
  const { chapter, ai } = await searchParams;
  const chapterId = chapter ?? 'phy-3';
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  if (ai) {
    const s = await getAiSession(ai);
    if (s) {
      const items = normalizeAiBlanks(s.items as Parameters<typeof normalizeAiBlanks>[0], s.chapterId ?? chapterId);
      return <BlanksScreen chapterId={s.chapterId ?? chapterId} chapterTitle={s.title} items={items} />;
    }
  }
  const content = await getChapterContent(chapterId);
  return <BlanksScreen chapterId={chapterId} chapterTitle={chapterById(chapterId)?.title ?? ''} items={content.blanks} />;
}
