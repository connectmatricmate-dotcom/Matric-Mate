'use client';

import { useMemo, useState } from 'react';
import { accuracy, confidenceBreakdown, formatDate } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Seg } from '@/components/ui/controls';
import { Bar, Card, Item, Label } from '@/components/ui/primitives';
import { useNow } from '@/lib/now';
import { useApp, useLang, useT } from '@/lib/store';

type Range = 'week' | 'month' | 'all';

export function PerformanceScreen() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const now = useNow();
  const [range, setRange] = useState<Range>('month');

  const attempts = useMemo(() => {
    const cut = range === 'week' ? 7 : range === 'month' ? 30 : 3650;
    const since = now - cut * 864e5;
    return state.attempts.filter((a) => a.at >= since);
  }, [state.attempts, range, now]);

  const trend = useMemo(() => {
    const days = range === 'week' ? 7 : 14;
    return Array.from({ length: days }, (_, i) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1 - i));
      const end = start.getTime() + 864e5;
      const set = attempts.filter((a) => a.at >= start.getTime() && a.at < end);
      return { acc: set.length ? accuracy(set) : null, count: set.length };
    });
  }, [attempts, range]);

  const points = useMemo(() => {
    const w = 300;
    const h = 80;
    const valid = trend.map((x, i) => ({ ...x, i })).filter((x) => x.acc != null);
    if (valid.length < 2) return '';
    return valid.map((x) => `${(x.i / (trend.length - 1)) * w},${h - ((x.acc as number) / 100) * (h - 10) - 5}`).join(' ');
  }, [trend]);

  // Every attempt, not the selected range, so this block matches the card
  // on the dashboard. The range picker above governs the trend chart.
  const conf = useMemo(() => confidenceBreakdown(state.attempts), [state.attempts]);
  const maxCount = Math.max(1, ...trend.map((x) => x.count));
  /**
   * The right-hand end of the chart is today, so the label under it has to be
   * today's accuracy. It was fed the whole selected range, 7, 30 or 3650 days,
   * so a student who had answered nothing today still read "today · 62%". The
   * last bucket is already computed for the line; when it is empty there is no
   * figure to give and the label says so.
   */
  const todaysBucket = trend[trend.length - 1];
  const todayLabel =
    todaysBucket?.acc != null ? t('progress.today', { n: todaysBucket.acc }) : t('progress.todayNone');

  const confLabels = [t('session.conf0'), t('session.conf1'), t('session.conf2')];
  const last = points ? points.split(' ').slice(-1)[0].split(',') : null;

  return (
    <Page width="page">
      <PageHead
        back="/progress"
        backLabel={t('progress.title')}
        title={t('progress.perfTitle')}
        sub={t('progress.perfSub', { n: attempts.length })}
      />

      <Seg
        value={range}
        onChange={setRange}
        label={t('progress.dateRange')}
        options={[
          { value: 'week' as const, label: t('progress.week') },
          { value: 'month' as const, label: t('progress.month') },
          { value: 'all' as const, label: t('progress.allTime') },
        ]}
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <Label>{t('progress.accuracyTrend')}</Label>
          {/* Gridlines and an axis with no line through them read as a chart
              that failed to load rather than one with nothing to show yet, so
              an empty period draws no frame at all. */}
          {points ? (
            <>
              <svg viewBox="0 0 300 90" className="mt-2 h-[90px] w-full" role="img" aria-label={t('progress.accuracyTrend')}>
                {[25, 50, 75].map((g) => (
                  <rect key={g} x={0} y={85 - (g / 100) * 80} width={300} height={1} fill="var(--color-grey)" />
                ))}
                <polyline points={points} fill="none" stroke="var(--color-teal)" strokeWidth={3} strokeLinecap="round" />
                {last ? <circle cx={Number(last[0])} cy={Number(last[1])} r={4.5} fill="var(--color-orange)" /> : null}
              </svg>
              <div className="flex justify-between text-[10.5px] font-extrabold text-ink2">
                <span>{t('progress.daysAgo', { n: range === 'week' ? 7 : 14 })}</span>
                <span>{todayLabel}</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] leading-[1.6] text-ink2">{t('progress.notEnoughData')}</p>
          )}
        </Card>

        <Card>
          <Label>{t('progress.questionsPerDay')}</Label>
          {attempts.length ? (
            <svg viewBox="0 0 300 70" className="mt-2 h-[70px] w-full" role="img" aria-label={t('progress.questionsPerDay')}>
              {trend.map((x, i) => {
                const bw = 300 / trend.length - 6;
                const h = (x.count / maxCount) * 58;
                return (
                  <rect
                    key={i}
                    x={(300 / trend.length) * i + 3}
                    y={64 - h}
                    width={bw}
                    height={Math.max(2, h)}
                    rx={4}
                    fill={i >= trend.length - 2 ? 'var(--color-orange)' : 'var(--color-tealtint2)'}
                  />
                );
              })}
            </svg>
          ) : (
            <p className="mt-4 py-4 text-center text-[13px] text-ink2">{t('progress.notEnoughData')}</p>
          )}
        </Card>
      </div>

      {/* The Pakka-meter and the test log read as a pair: how sure you felt, and
          what actually happened. Side by side keeps the bars a readable width. */}
      <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
        <Card border="border-orange">
          <Label className="text-orangedark">{t('progress.confidenceTitle')}</Label>
          <div className="mt-4 flex flex-col gap-4">
            {conf.map((r) => (
              <div key={r.confidence}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] font-extrabold text-ink">{confLabels[r.confidence]}</span>
                  <span className="text-[12.5px] font-extrabold text-ink2">
                    {r.said ? t('progress.saidTimes', { n: r.accuracy, times: r.said }) : t('progress.notUsed')}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar pct={r.accuracy} tone={r.confidence === 2 ? 'green' : r.confidence === 1 ? 'orange' : 'red'} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div>
          <div className="mb-2">
            <Label>{t('progress.testsTitle')}</Label>
          </div>
          {state.results.length === 0 ? (
            <Card flat>
              <p className="text-[13px] text-ink2">{t('progress.noTests')}</p>
            </Card>
          ) : (
            <Card flat className="py-0">
              {state.results.slice(0, 6).map((r, i) => (
                <Item
                  key={r.id}
                  title={r.label}
                  sub={`${formatDate(r.at, lang, { day: 'numeric', month: 'short' })} · ${r.score}/${r.total} · +${r.xp} XP`}
                  icon={r.mode === 'exam' ? 'clock' : 'target'}
                  tone={r.mode === 'exam' ? 'orange' : 'teal'}
                  last={i === Math.min(5, state.results.length - 1)}
                />
              ))}
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
