'use client';

import { useEffect, useState } from 'react';
import { chapterById, fetchCheatSheet } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Skeleton } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';
import { Markdown } from '@/components/ui/Markdown';

/**
 * The AI revision sheet: one page per chapter, definitions, formulas,
 * must-know points, common mistakes and likely questions. Generated once
 * per chapter and medium, cached for every student, so opening it a second
 * time is instant and free.
 */
export function SheetScreen({ chapterId }: { chapterId: string }) {
  const { state } = useApp();
  const t = useT();
  const chapter = chapterById(chapterId);

  const medium = state.settings.contentMedium;
  // Keyed by request, so switching chapter or medium shows the loading state
  // again without a synchronous reset inside the effect.
  const [attempt, setAttempt] = useState(0);
  const key = `${chapterId}:${medium}:${attempt}`;
  const [settled, setSettled] = useState<{ key: string; sheet: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCheatSheet({ chapterId, medium }).then((res) => {
      if (alive) setSettled({ key, sheet: res.ok ? res.sheet : null });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loading = settled?.key !== key;
  const sheet = loading ? null : settled?.sheet ?? null;
  const failed = !loading && sheet === null;

  return (
    <Page width="read">
      <PageHead back={`/learn/chapter/${chapterId}`} backLabel={chapter?.title ?? ''} title={t('tutor.sheetTitle')} sub={chapter?.title} />
      {failed ? (
        <Card flat tint="bg-redtint" border="border-red">
          <p className="text-[13.5px] font-extrabold text-red">{t('states.errorTitle')}</p>
          <p className="mt-0.5 text-[13px] text-ink2">{t('states.errorBody')}</p>
          {/* Android offered a retry here and the website did not, so a failed
              sheet was a dead end short of reloading the page by hand. Worth
              more now that generation is slow enough to time out. */}
          <Btn title={t('common.retry')} variant="line" sm className="mt-3" onClick={() => setAttempt((n) => n + 1)} />
        </Card>
      ) : loading ? (
        <>
          <p className="mb-2 text-[13px] text-ink2">{t('tutor.sheetBusy')}</p>
          <Skeleton className="h-96 w-full" />
        </>
      ) : (
        <>
          <Card flat>
            <Markdown text={sheet ?? ''} className="text-[14px] leading-[1.7] text-ink" />
          </Card>
          <p className="mt-3 text-center text-[12px] text-ink3">
            {t('tutor.aiMade')} · {t('tutor.disclaimer')}
          </p>
        </>
      )}
    </Page>
  );
}
