'use client';

import { useEffect, useState } from 'react';
import { chapterName, fetchCheatSheet, isUrduScript, subjectMedium } from '@matricmate/core';
import type { AiFail, Chapter, StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Skeleton } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';
import { Markdown } from '@/components/ui/Markdown';
import { ReportAi } from '@/components/app/ReportAi';

/** Lines of a sheet, in the shape of the card that is coming. */
function SheetLines() {
  return (
    <Card flat className="flex flex-col gap-2.5">
      {['w-[45%]', 'w-[92%]', 'w-[86%]', 'w-[70%]', 'w-[38%]', 'w-[90%]', 'w-[80%]', 'w-[88%]', 'w-[64%]'].map((w, i) => (
        <Skeleton key={i} tone="ink" className={`h-3.5 ${w}`} />
      ))}
    </Card>
  );
}

/** The route's loading state: the header, then the sheet's lines. */
export function SheetSkeleton() {
  return (
    <Page width="read">
      <div className="mb-5">
        <div className="mb-1 flex h-11 items-center">
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1.5 h-4 w-40" />
      </div>
      <SheetLines />
    </Page>
  );
}

/**
 * Why a sheet did not arrive, in words that say what to do about it. Every
 * failure used to read "check your connection", with a Try again, including a
 * spent daily allowance, where trying again cannot work before midnight.
 */
const FAILURE: Record<AiFail['reason'], { title: StringKey; body: StringKey; retry: boolean }> = {
  offline: { title: 'states.errorTitle', body: 'tutor.offline', retry: true },
  error: { title: 'states.errorTitle', body: 'tutor.errorReply', retry: true },
  rate: { title: 'states.errorTitle', body: 'tutor.slowDown', retry: true },
  refused: { title: 'states.errorTitle', body: 'tutor.refused', retry: true },
  quota: { title: 'tutor.limitTitle', body: 'tutor.limitToast', retry: false },
  plan: { title: 'tutor.noPlanTitle', body: 'tutor.planNeeded', retry: false },
  trial: { title: 'access.lockedSection', body: 'tutor.notInTrial', retry: false },
  syllabus: { title: 'states.errorTitle', body: 'tutor.notInSyllabus', retry: false },
};

/**
 * The AI revision sheet: one page per chapter, definitions, formulas,
 * must-know points, common mistakes and likely questions. Generated once
 * per chapter and medium, cached for every student, so opening it a second
 * time is instant and free.
 */
export function SheetScreen({ chapter }: { chapter: Chapter }) {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const chapterId = chapter.id;
  const name = chapterName(chapter, lang);

  /* The subject's own language. Urdu chapters are written in Urdu and English
     ones in English whatever medium a student reads in, and asking by medium
     wrote an English sheet from Urdu notes, and paid for a second copy of the
     same chapter. */
  const medium = subjectMedium(chapterId, chapter.board, state.settings.contentMedium);
  // Keyed by request, so switching chapter or medium shows the loading state
  // again without a synchronous reset inside the effect.
  const [attempt, setAttempt] = useState(0);
  const key = `${chapterId}:${medium}:${attempt}`;
  const [settled, setSettled] = useState<{ key: string; sheet: string | null; reason?: AiFail['reason'] } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCheatSheet({ chapterId, medium }).then((res) => {
      if (alive) setSettled(res.ok ? { key, sheet: res.sheet } : { key, sheet: null, reason: res.reason });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loading = settled?.key !== key;
  const sheet = loading ? null : settled?.sheet ?? null;
  const failed = !loading && sheet === null;
  const failure = FAILURE[settled?.reason ?? 'error'];

  return (
    <Page width="read">
      <PageHead back={`/learn/chapter/${chapterId}`} backLabel={name} title={t('tutor.sheetTitle')} sub={name} subUrdu={isUrduScript(name)} />
      {failed ? (
        <Card flat tint="bg-redtint" border="border-red">
          <p role="alert" className="text-[13.5px] font-extrabold text-red">{t(failure.title)}</p>
          <p className="mt-0.5 text-[13px] text-ink2">{t(failure.body)}</p>
          {/* Android offered a retry here and the website did not, so a failed
              sheet was a dead end short of reloading the page by hand. Worth
              more now that generation is slow enough to time out. Not offered
              when it cannot help. */}
          {failure.retry ? (
            <Btn title={t('common.retry')} variant="line" sm className="mt-3" onClick={() => setAttempt((n) => n + 1)} />
          ) : null}
        </Card>
      ) : loading ? (
        <>
          <p className="mb-2 text-[13px] text-ink2">{t('tutor.sheetBusy')}</p>
          <SheetLines />
        </>
      ) : (
        <>
          <Card flat>
            <Markdown text={sheet ?? ''} className="text-[14px] leading-[1.7] text-ink" />
            <ReportAi surface="sheet" refId={chapterId} excerpt={sheet} />
          </Card>
          <p className="mt-3 text-center text-[12px] text-ink3">
            {t('tutor.aiMade')} · {t('tutor.disclaimer')}
          </p>
        </>
      )}
    </Page>
  );
}
