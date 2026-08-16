import type { Metadata } from 'next';
import { chapterById } from '@matricmate/core';
import { ChatScreen } from '@/components/screens/ChatScreen';

export const metadata: Metadata = { title: 'Ask the AI tutor' };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; chapter?: string; thread?: string }>;
}) {
  const { q, chapter, thread } = await searchParams;
  return (
    <ChatScreen
      initialQuestion={q}
      chapterId={chapter}
      chapterLabel={chapter ? chapterById(chapter)?.title : undefined}
      threadId={thread}
    />
  );
}
