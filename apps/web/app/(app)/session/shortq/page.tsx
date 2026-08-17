import type { Metadata } from 'next';
import { chapterById, normalizeAiShortQs } from '@matricmate/core';
import { defaultChapterId, getAiSession, getChapterContent } from '@/lib/content-readers';
import { ShortQScreen } from '@/components/screens/ShortQScreen';

export const metadata: Metadata = {
  title: 'Short questions',
  description: 'Board-style short questions with model answers and marking points.',
};

export default async function ShortQPage({ searchParams }: { searchParams: Promise<{ chapter?: string; ai?: string }> }) {
  const { chapter, ai } = await searchParams;
  const chapterId = chapter ?? (await defaultChapterId());
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  if (ai) {
    const s = await getAiSession(ai);
    if (s) {
      const items = normalizeAiShortQs(s.items as Parameters<typeof normalizeAiShortQs>[0], s.chapterId ?? chapterId);
      return <ShortQScreen chapterId={s.chapterId ?? chapterId} chapterTitle={s.title} items={items} />;
    }
  }
  const content = await getChapterContent(chapterId);
  return <ShortQScreen chapterId={chapterId} chapterTitle={chapterById(chapterId)?.title ?? ''} items={content.shortQs} />;
}
