import type { Metadata } from 'next';
import { api, chapterById } from '@matricmate/core';
import { BlanksScreen } from '@/components/screens/BlanksScreen';

export const metadata: Metadata = {
  title: 'Fill in the blanks',
  description: 'Recall practice, one sentence at a time.',
};

export default async function BlanksPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
  const { chapter } = await searchParams;
  const chapterId = chapter ?? 'phy-3';
  const content = await api.getChapterContent(chapterId);
  return <BlanksScreen chapterId={chapterId} chapterTitle={chapterById(chapterId)?.title ?? ''} items={content.blanks} />;
}
