'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { accuracy, grade, subjectById, subjectPct } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Label, Pill } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

export function ReportCard() {
  const { state, derived } = useApp();
  const t = useT();
  const toast = useToast();

  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const overallAcc = accuracy(state.attempts);

  const rows = useMemo(
    () =>
      derived.subjects.map((sid) => {
        const set = state.attempts.filter((a) => a.subjectId === sid);
        const acc = set.length ? accuracy(set) : subjectPct(sid, state.readSections, state.attempts);
        const half = Math.floor(set.length / 2);
        const older = set.slice(0, half);
        const recent = set.slice(half);
        const delta = older.length && recent.length ? accuracy(recent) - accuracy(older) : 0;
        return { sid, acc, trend: delta > 4 ? '↑' : delta < -4 ? '↓' : '→', attempted: set.length };
      }),
    [derived.subjects, state.attempts, state.readSections]
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
          {state.user?.name ?? 'Student'} ·{' '}
          {t('account.classLine', {
            class: state.onboarding?.classLevel ?? 9,
            board: state.onboarding?.board === 'punjab' ? 'Punjab Board' : 'FBISE',
            medium: state.onboarding?.medium === 'ur' ? 'Urdu' : 'English',
          })}
        </p>

        <table className="mt-4 w-full">
          <caption className="sr-only">{t('progress.gradesBySubject')}</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sid} className="border-b border-line">
                <td className="py-2.5 text-[13.5px] text-ink">{subjectById(r.sid)?.name}</td>
                <td className="w-11 py-2.5 text-right font-display text-[15px] text-ink">
                  {r.attempted ? grade(r.acc) : 'n/a'}
                </td>
                <td
                  className={`w-7 py-2.5 text-right text-[14px] font-extrabold ${
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
              `${state.user?.name ?? 'Student'} · MatricMate report card, ${month}\n` +
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
            toast(t('progress.pdfToast'));
            window.print();
          }}
        />
      </div>

      <p className="mt-4 text-[13px] text-ink2">{t('progress.reportFootnote')}</p>
    </Page>
  );
}
