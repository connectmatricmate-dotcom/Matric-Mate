'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { accuracy, grade, overallPct, subjectById, subjectPct, weakTopics } from '@matricmate/core';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { ConfidenceRail, StreakRail } from '@/components/app/rails';
import { Bar, Card, Icon, Item, Kpi, LinkBtn, Pill, Ring } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

export function ProgressView() {
  const { state, derived } = useApp();
  const t = useT();

  const overall = useMemo(
    () => overallPct(derived.subjects, state.readSections, state.attempts),
    [derived.subjects, state.readSections, state.attempts]
  );
  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 4), [state.attempts]);
  const acc = accuracy(state.attempts);
  const minutes = state.attempts.length * 1.6 + state.readSections.length * 4;
  const month = new Date().toLocaleDateString('en-GB', { month: 'long' });

  return (
    <Page>
      <PageHead
        title={t('progress.title')}
        sub={t('progress.sub')}
        actions={<LinkBtn title={t('common.details')} href="/insights/performance" variant="line" sm icon="chart" />}
      />

      <Split>
        <Work className="flex flex-col gap-4">
          <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Ring pct={overall} size={96} stroke={10}>
              <span className="font-display text-[20px] text-ink tabular">{overall}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[18px] text-ink">{t('progress.syllabusCovered')}</p>
              <p className="mt-0.5 text-[13.5px] text-ink2">
                {derived.streak > 0 ? t('progress.streakAlive', { n: derived.streak }) : t('progress.noStreak')}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Kpi value={`${state.attempts.length}`} label={t('dash.questions')} />
                <Kpi value={`${acc}%`} label={t('dash.accuracy')} />
                <Kpi value={`${Math.round(minutes / 60)}h`} label={t('dash.studyTime')} />
                <Kpi value={`${state.results.length}`} label={t('progress.tests')} />
              </div>
            </div>
          </Card>

          <Card flat>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[16px] text-ink">{t('progress.bySubject')}</h2>
              <Link href="/insights/performance" className="text-[12.5px] font-extrabold text-teal hover:underline">
                {t('common.details')}
              </Link>
            </div>
            <div className="grid gap-x-6 gap-y-3.5 md:grid-cols-2">
              {derived.subjects.map((sid) => {
                const pct = subjectPct(sid, state.readSections, state.attempts);
                return (
                  <Link key={sid} href={`/learn/subject/${sid}`} className="block">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-extrabold text-ink">{subjectById(sid)?.name}</span>
                      <span className="text-[12.5px] font-extrabold text-ink2 tabular">{pct}%</span>
                    </span>
                    <span className="mt-1 block">
                      <Bar pct={pct} tone="teal" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[16px] text-ink">{t('progress.weakTopics')}</h2>
              <Link href="/insights/weak" className="text-[12.5px] font-extrabold text-teal hover:underline">
                {t('common.seeAll')}
              </Link>
            </div>
            {weak.length === 0 ? (
              <Card flat>
                <p className="text-[13px] text-ink2">{t('progress.weakEmpty')}</p>
              </Card>
            ) : (
              <Card flat className="py-0">
                {weak.map((w, i) => (
                  <Item
                    key={w.topic}
                    href={`/session/setup?chapter=${w.chapterId}`}
                    title={w.topic}
                    sub={subjectById(w.subjectId)?.name}
                    icon="alert"
                    tone={w.accuracy < 50 ? 'red' : 'orange'}
                    last={i === weak.length - 1}
                    right={<Pill tone={w.accuracy < 50 ? 'red' : 'orange'}>{`${w.accuracy}%`}</Pill>}
                  />
                ))}
              </Card>
            )}
          </div>

          <Link href="/insights/report" className="block">
            <Card
              border="border-orange"
              className="flex items-center gap-4 transition-colors duration-200 hover:brightness-[0.99]"
            >
              <span className="text-[30px]">🎓</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[16px] text-ink">{t('progress.reportCard', { month })}</span>
                <span className="block text-[13px] text-ink2">{t('progress.reportCardSub', { grade: grade(acc) })}</span>
              </span>
              <span className="hidden sm:block">
                <Pill tone="orange">{t('progress.open')}</Pill>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-ink3 sm:hidden" />
            </Card>
          </Link>
        </Work>

        <Rail>
          <StreakRail />
          <ConfidenceRail />
        </Rail>
      </Split>
    </Page>
  );
}
