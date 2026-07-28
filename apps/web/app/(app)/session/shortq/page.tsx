import type { Metadata } from 'next';
import { api, chapterById } from '@matricmate/core';
import { ShortQScreen } from '@/components/screens/ShortQScreen';

export const metadata: Metadata = {
  title: 'Short questions',
  description: 'Board-style short questions with model answers and marking points.',
};

export default async function ShortQPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
  const { chapter } = await searchParams;
  const chapterId = chapter ?? 'phy-3';
  const content = await api.getChapterContent(chapterId);
  return <ShortQScreen chapterId={chapterId} chapterTitle={chapterById(chapterId)?.title ?? ''} items={content.shortQs} />;
}
