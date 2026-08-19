import type { Metadata } from 'next';
import { chapterById } from '@matricmate/core';
import { ChatScreen } from '@/components/screens/ChatScreen';

export const metadata: Metadata = { title: 'Ask the AI tutor' };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; chapter?: string; thread?: string; draft?: string; photo?: string }>;
}) {
  const { q, chapter, thread, draft, photo } = await searchParams;
  return (
    <ChatScreen
      initialQuestion={q}
      initialDraft={draft}
      openPhoto={photo === '1'}
      chapterId={chapter}
      chapterLabel={chapter ? chapterById(chapter)?.title : undefined}
      threadId={thread}
    />
  );
}
