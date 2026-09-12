import type { Metadata } from 'next';
import { chapterName } from '@matricmate/core';
import { ChatScreen } from '@/components/screens/ChatScreen';
import { getChapter } from '@/lib/content-readers';
import { readUiLanguage } from '@/lib/ui-language.server';

export const metadata: Metadata = { title: 'Ask the AI tutor' };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; chapter?: string; thread?: string; draft?: string; photo?: string }>;
}) {
  const { q, chapter, thread, draft, photo } = await searchParams;
  /*
   * The attached chapter's name, read under the student's own session and in
   * their language. It came from the server's shared chapter index, which
   * holds whatever other requests happened to load and only English titles,
   * so Class 10 and Punjab chapters showed as "Answering from " with nothing
   * after it, and Urdu students got the English title.
   */
  // A failed read costs the chip its name and nothing else: the chat itself
  // does not depend on it, so it is not allowed to take the page down.
  const [found, lang] = chapter
    ? await Promise.all([getChapter(chapter).catch(() => undefined), readUiLanguage()])
    : [undefined, 'en' as const];
  return (
    <ChatScreen
      initialQuestion={q}
      initialDraft={draft}
      openPhoto={photo === '1'}
      chapterId={chapter}
      chapterLabel={found ? chapterName(found, lang) || undefined : undefined}
      threadId={thread}
    />
  );
}
