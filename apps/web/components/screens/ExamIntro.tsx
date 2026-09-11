'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, boardName, chapterById, chapterName, subjectById, subjectName, weakTopics } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';
import { session } from '@/lib/session';

const COUNT = 20;
const MINUTES = 30;

export function ExamIntro({
  subject,
  chapter,
  paper,
  ai,
  topics,
}: {
  subject?: string;
  chapter?: string;
  paper?: string;
  ai?: boolean;
  /** The weak topics the student ticked on the AI test screen. */
  topics?: string[];
}) {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const subjectId = subject ?? (chapter ? chapterById(chapter)?.subjectId : undefined) ?? derived.subjects[0] ?? 'phy';

  const best = state.results
    .filter((r) => r.subjectId === subjectId && r.mode === 'exam')
    .sort((a, b) => b.score / b.total - a.score / a.total)[0];

  const label = ai
    ? t('tutor.aiTestTitle')
    : paper
      ? `${boardName(state.onboarding?.board, lang)} ${paper}`
      : chapter
        ? chapterName(chapterById(chapter), lang)
        : subjectName(subjectById(subjectId), lang);

  async function start() {
    setBusy(true);
    // The picked topics arrive from the AI test screen; when someone lands
    // here directly, fall back to their actual weakest topics.
    const focus = topics?.length ? topics : weakTopics(state.attempts).map((w) => w.topic).slice(0, 3);
    const mcqs = ai
      ? await api.generateTest(focus, COUNT)
      : await api.getMcqs({
          chapterIds: chapter ? [chapter] : undefined,
          subjectId: chapter ? undefined : subjectId,
          count: COUNT,
        });
    // busy stays true through router.replace: re-enabling the button while the
    // route transition runs is the double-click window.
    session.start({
      mode: 'exam',
      label: `${label} · ${t('session.examTitle')}`,
      subjectId,
      chapterId: chapter ?? null,
      mcqs,
      durationSec: MINUTES * 60,
      aiGenerated: ai,
    });
    router.replace('/session/exam');
  }

  return (
    <Page width="focus">
      <PageHead back="/practice" backLabel={t('practice.title')} title={t('session.examTitle')} sub={label} />

      <Card border="border-orange" className="flex flex-col items-center py-6 text-center">
        <Icon name="clock" size={34} className="text-orangedark" />
        <h2 className="mt-2.5 font-display text-[21px] text-ink">{t('session.examRules', { n: COUNT, min: MINUTES })}</h2>
        <p className="mt-0.5 text-[13px] text-ink2">{t('session.examRulesSub')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {best ? (
            <Pill tone="green">{t('session.best', { n: Math.round((best.score / best.total) * 100) })}</Pill>
          ) : (
            <Pill tone="grey">{t('session.firstAttempt')}</Pill>
          )}
          <Pill tone="orange">{t('session.pauseOnce')}</Pill>
          {ai ? <Pill tone="teal">{t('session.weakFocus')}</Pill> : null}
        </div>
      </Card>

      <Card flat className="mt-6">
        <p className="text-[13.5px] font-extrabold text-ink">{t('session.beforeStart')}</p>
        <ul className="mt-2.5 flex flex-col gap-2 text-[13px] text-ink2">
          <li>• {t('session.beforeStart1', { min: MINUTES })}</li>
          <li>• {t('session.beforeStart2')}</li>
          <li>• {t('session.beforeStart3')}</li>
        </ul>
      </Card>

      <div className="mt-6">
        <Btn title={t('session.startExam')} variant="orange" onClick={start} loading={busy} className="w-full" />
      </div>
    </Page>
  );
}
