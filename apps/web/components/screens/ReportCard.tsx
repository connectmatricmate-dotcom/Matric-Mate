'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { WORDMARK_DATA_URI, accuracy, boardName, formatDate, grade, mediumName, reportHtml, subjectById } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Label, Pill } from '@/components/ui/primitives';
import { useNow } from '@/lib/now';
import { useToast } from '@/components/ui/toast';
import { useApp, useLang, useT } from '@/lib/store';

export function ReportCard() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();

  const now = useNow();
  const month = now ? formatDate(now, lang, { month: 'long', year: 'numeric' }) : '';
  const overallAcc = accuracy(state.attempts);
  const printedOn = now ? formatDate(now, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

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

  /** The printable sheet, shared with the Android PDF. */
  function printableReport(): string {
    return reportHtml({
      studentName: state.user?.name ?? t('common.student'),
      classLine: t('account.classLine', {
        class: state.onboarding?.classLevel ?? 9,
        board: boardName(state.onboarding?.board, lang),
        medium: mediumName(state.onboarding?.medium, lang),
      }),
      month,
      overallGrade: grade(overallAcc),
      overallAccuracy: overallAcc,
      questions: state.attempts.length,
      activeDays,
      rtl: lang === 'ur',
      logoDataUri: WORDMARK_DATA_URI,
      rows: rows.map((r) => ({
        subject: subjectById(r.sid)?.name ?? r.sid,
        grade: r.attempted ? grade(r.acc) : 'n/a',
        accuracy: r.acc,
        attempted: r.attempted,
        trend: r.trend,
      })),
      labels: {
        title: t('progress.reportTitle'),
        month: t('progress.month'),
        overall: t('progress.reportOverall'),
        questions: t('dash.questions'),
        activeDays: t('dash.activeDays'),
        subject: t('session.subject'),
        grade: t('session.grade', { g: '' }).trim(),
        accuracy: t('dash.accuracy'),
        attempted: t('progress.reportAttempted'),
        footnote: t('progress.reportFootnote'),
        generated: t('progress.reportGenerated', { date: printedOn }),
        trend: t('progress.reportTrend'),
      },
    });
  }

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

      <div className="no-print mt-6 flex gap-2.5">
        {/* Both actions are real. Share opens WhatsApp's own share flow with a
            text summary; Save opens the print dialog, where every phone and
            desktop browser offers "Save as PDF". */}
        <Btn
          title={t('progress.share')}
          variant="whatsapp"
          icon="whatsapp"
          className="flex-1"
          onClick={() => {
            const summary =
              `${state.user?.name ?? t('common.student')} · MatricMate report card, ${month}\n` +
              `Overall grade: ${grade(overallAcc)} · ${state.attempts.length} questions this month\n` +
              rows
                .filter((r) => r.attempted)
                .map((r) => `${subjectById(r.sid)?.name}: ${grade(r.acc)}`)
                .join(' · ');
            window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank', 'noopener');
          }}
        />
        <Btn
          title={t('progress.savePdf')}
          variant="line"
          icon="download"
          className="flex-1"
          onClick={() => {
            /*
             * A purpose-built sheet, not the page.
             *
             * window.print() on the live page produced whatever the browser
             * decided to include: the app chrome, the rails, the nav. What a
             * parent should get is one branded page with the student's name,
             * class and board on it, which is what reportHtml builds. The same
             * generator feeds the Android PDF, so the two are the same
             * document.
             */
            const win = window.open('', '_blank', 'noopener,width=820,height=900');
            if (!win) {
              toast(t('progress.shareFailed'));
              return;
            }
            win.document.write(printableReport());
            win.document.close();
            // Give the document a tick to lay out before the dialog opens, or
            // Safari prints a blank first page.
            win.setTimeout(() => win.print(), 250);
          }}
        />
      </div>

      <p className="mt-4 text-[13px] text-ink2">{t('progress.reportFootnote')}</p>
    </Page>
  );
}
