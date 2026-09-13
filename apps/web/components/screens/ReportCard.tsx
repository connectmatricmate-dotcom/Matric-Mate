'use client';

import { useMemo, useState } from 'react';
import { accuracy, boardName, formatDate, grade, mediumName, subjectById, subjectName } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Label, Pill, ScriptText, Wordmark } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useNow } from '@/lib/now';
import { useApp, useLang, useT } from '@/lib/store';

/**
 * The calendar month in Karachi, as "2026-09". Pakistan keeps one offset all
 * year, and this is the same day boundary core's streak and test counts use.
 * The report used UTC, so a student studying before 5am on the 1st had the
 * morning filed under the month before.
 */
const karachiMonth = (ms: number) => new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 7);

export function ReportCard() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const now = useNow();
  const month = now ? formatDate(now, lang, { month: 'long', year: 'numeric' }) : '';

  /**
   * This month only, as the title and the footnote both say. Grades, the
   * question count and the tests were all-time while only the active days
   * were filtered, so "September's report card" graded a student on work
   * from the spring.
   */
  const thisMonth = useMemo(() => {
    const key = now ? karachiMonth(now) : '';
    return {
      attempts: state.attempts.filter((a) => karachiMonth(a.at) === key),
      results: state.results.filter((r) => karachiMonth(r.at) === key),
      activeDays: state.activeDays.filter((d) => d.slice(0, 7) === key).length,
    };
  }, [state.attempts, state.results, state.activeDays, now]);

  const answered = thisMonth.attempts.length > 0;
  const overallAcc = accuracy(thisMonth.attempts);

  const rows = useMemo(
    () =>
      derived.subjects.map((sid) => {
        const set = thisMonth.attempts.filter((a) => a.subjectId === sid);
        // Zero when unattempted. The old fallback graded syllabus coverage as
        // if it were accuracy, so a student who had read most of Chemistry
        // without answering a question scored a Chemistry grade for reading.
        // Android fixed this; the website had not.
        const acc = set.length ? accuracy(set) : 0;
        const half = Math.floor(set.length / 2);
        const older = set.slice(0, half);
        const recent = set.slice(half);
        const delta = older.length && recent.length ? accuracy(recent) - accuracy(older) : 0;
        return { sid, acc, trend: delta > 4 ? '↑' : delta < -4 ? '↓' : '→', attempted: set.length };
      }),
    [derived.subjects, thisMonth.attempts]
  );

  /**
   * Fetched and checked before anything is saved. A plain download link
   * saved whatever came back, so a failed report arrived as a file of JSON
   * with a .pdf name and no word on screen.
   */
  async function savePdf() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/report/pdf');
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/pdf')) throw new Error('report');
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'MatricMate report.pdf';
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Long enough for the browser to have taken the file.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      toast(t('progress.pdfFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page width="focus">
      {/* A non-breaking space until the clock is read, so the line is already
          there and the card does not jump when the month arrives. */}
      <PageHead back="/progress" backLabel={t('progress.title')} title={t('progress.reportTitle')} sub={month || '\u00a0'} />

      <Card border="border-teal" className="border-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Wordmark width={120} height={24} />
            <div className="mt-1.5">
              <Label>{t('progress.monthlyReport', { month })}</Label>
            </div>
          </div>
          {/* No grade before there is an answer this month: an empty month was
              graded F. */}
          <span
            className={`flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-orangetint text-center font-display text-orangedark ${
              answered ? 'text-[24px]' : 'px-1.5 text-[13px] leading-tight'
            }`}
          >
            {answered ? grade(overallAcc) : t('progress.gradeNone')}
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
                <td className="py-2.5 text-[13.5px] text-ink">
                  <ScriptText text={subjectName(subjectById(r.sid), lang)} />
                </td>
                <td className="whitespace-nowrap py-2.5 ps-3 text-end font-display text-[15px] text-ink">
                  {r.attempted ? grade(r.acc) : <span className="text-[13px] text-ink3">{t('progress.gradeNone')}</span>}
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
          {/* One of anything is singular: a first report read "1 active days". */}
          <Pill tone="teal">
            {t(thisMonth.activeDays === 1 ? 'progress.activeDaysOne' : 'progress.activeDays', { n: thisMonth.activeDays })}
          </Pill>
          <Pill tone="teal">
            {t(thisMonth.attempts.length === 1 ? 'progress.questionsOne' : 'progress.questionsMany', {
              n: thisMonth.attempts.length,
            })}
          </Pill>
          <Pill tone="orange">
            {t(thisMonth.results.length === 1 ? 'progress.testsOne' : 'progress.testsMany', { n: thisMonth.results.length })}
          </Pill>
          <Pill tone="grey">{t('account.levelLine', { xp: state.xp, level: derived.level })}</Pill>
        </div>
      </Card>

      <div className="no-print mt-6">
        {/* One action, and it is a real file. This used to be a WhatsApp share
            that sent a text summary, and a "Save as PDF" that opened the print
            dialog. Neither was a download: one sent a paragraph instead of the
            report, and the other handed the student a menu. */}
        <Btn title={t('progress.savePdf')} icon="download" loading={saving} onClick={() => void savePdf()} className="w-full sm:w-auto" />
        <p className="mt-2 text-[12.5px] text-ink2">{t('progress.pdfEnglishNote')}</p>
      </div>

      <p className="mt-4 text-[13px] text-ink2">{t('progress.reportFootnote')}</p>
    </Page>
  );
}
