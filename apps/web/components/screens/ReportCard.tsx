'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { accuracy, boardName, formatDate, grade, mediumName, subjectById } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Icon, Label, Pill } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/styles';
import { useNow } from '@/lib/now';
import { useApp, useLang, useT } from '@/lib/store';

export function ReportCard() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();

  const now = useNow();
  const month = now ? formatDate(now, lang, { month: 'long', year: 'numeric' }) : '';
  const overallAcc = accuracy(state.attempts);

  const rows = useMemo(
    () =>
      derived.subjects.map((sid) => {
        const set = state.attempts.filter((a) => a.subjectId === sid);
        // Zero when unattempted. The old fallback graded syllabus coverage as
        // if it were accuracy, so a student who had read most of Chemistry
        // without answering a question scored a Chemistry grade for reading.
        // The row prints "n/a" in that case anyway, so it could only ever have
        // misled. Android fixed this; the website had not.
        const acc = set.length ? accuracy(set) : 0;
        const half = Math.floor(set.length / 2);
        const older = set.slice(0, half);
        const recent = set.slice(half);
        const delta = older.length && recent.length ? accuracy(recent) - accuracy(older) : 0;
        return { sid, acc, trend: delta > 4 ? '↑' : delta < -4 ? '↓' : '→', attempted: set.length };
      }),
    [derived.subjects, state.attempts]
  );

  const activeDays = state.activeDays.filter((d) => d.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;


  return (
    <Page width="focus">
      <PageHead back="/progress" backLabel={t('progress.title')} title={t('progress.reportTitle')} sub={month} />

      <Card border="border-teal" className="border-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={120} height={24} />
            <div className="mt-1.5">
              <Label>{t('progress.monthlyReport', { month })}</Label>
            </div>
          </div>
          <span className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-orangetint font-display text-[24px] text-orangedark">
            {grade(overallAcc)}
          </span>
        </div>

        <p className="mt-4 text-[15px] font-extrabold text-ink">
          {state.user?.name ?? t('common.student')} ·{' '}
          {t('account.classLine', {
            class: state.onboarding?.classLevel ?? 9,
            board: boardName(state.onboarding?.board, lang),
            medium: mediumName(state.onboarding?.medium, lang),
          })}
        </p>

        <table className="mt-4 w-full">
          <caption className="sr-only">{t('progress.gradesBySubject')}</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sid} className="border-b border-line">
                <td className="py-2.5 text-[13.5px] text-ink">{subjectById(r.sid)?.name}</td>
                <td className="w-11 py-2.5 text-end font-display text-[15px] text-ink">
                  {r.attempted ? grade(r.acc) : 'n/a'}
                </td>
                <td
                  className={`w-7 py-2.5 text-end text-[14px] font-extrabold ${
                    r.trend === '↑' ? 'text-green' : r.trend === '↓' ? 'text-red' : 'text-ink3'
                  }`}
                >
                  {r.trend}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="teal">{t('progress.activeDays', { n: activeDays })}</Pill>
          <Pill tone="teal">{`${state.attempts.length} ${t('common.questions')}`}</Pill>
          <Pill tone="orange">{`${state.results.length} ${t('progress.tests')}`}</Pill>
          <Pill tone="grey">{t('account.levelLine', { xp: state.xp, level: derived.level })}</Pill>
        </div>
      </Card>

      <div className="no-print mt-6">
        {/* One action, and it is a real file. This used to be a WhatsApp share
            that sent a text summary, and a "Save as PDF" that opened the print
            dialog. Neither was a download: one sent a paragraph instead of the
            report, and the other handed the student a menu. The link below is
            a request that returns a PDF. */}
        <a href="/api/report/pdf" className={buttonClasses({ className: 'w-full sm:w-auto' })} download>
          <Icon name="download" size={18} />
          {t('progress.savePdf')}
        </a>
        <p className="mt-2 text-[12.5px] text-ink2">{t('progress.pdfEnglishNote')}</p>
      </div>

      <p className="mt-4 text-[13px] text-ink2">{t('progress.reportFootnote')}</p>
    </Page>
  );
}
