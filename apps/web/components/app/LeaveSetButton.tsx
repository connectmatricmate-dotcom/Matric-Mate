'use client';

import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { Btn } from '@/components/ui/controls';
import { canGoBack, previousPath, subscribeTrail } from '@/lib/nav-trail';
import { useT } from '@/lib/store';

/**
 * The way out of a finished flashcard, blank or short-question set.
 *
 * Back to wherever it was opened. It says "Back to chapter" when that is the
 * chapter (or when the set was opened on its own and the chapter is where it
 * goes), and "Done" when the student came from somewhere else: from Practice
 * or the plan it used to open a chapter they had never been on. Going back
 * rather than linking also keeps the finished set out of the history, where
 * the browser's back button used to find it again.
 */
export function LeaveSetButton({
  chapterId,
  variant = 'line',
  sm,
  className,
}: {
  chapterId: string;
  variant?: 'line' | 'primary';
  sm?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const back = useSyncExternalStore(subscribeTrail, canGoBack, () => false);
  const prev = useSyncExternalStore(subscribeTrail, previousPath, () => null);
  const chapterHref = `/learn/chapter/${chapterId}`;
  const toChapter = !back || (prev ?? '').split('?')[0] === chapterHref;
  return (
    <Btn
      title={toChapter ? t('session.backToChapter') : t('common.done')}
      variant={variant}
      sm={sm}
      className={className}
      onClick={() => (canGoBack() ? router.back() : router.push(chapterHref))}
    />
  );
}
