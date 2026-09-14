'use client';

import Link from 'next/link';
import { useNow } from '@/lib/now';
import { useEffect, useMemo, useState } from 'react';
import {
  accuracy,
  fetchDailyReport,
  formatDate,
  grade,
  overallPct,
  studyTimeLabel,
  subjectById,
  subjectName,
  subjectPct,
  type DailyReport,
} from '@matricmate/core';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { ConfidenceRail, StreakRail, namedWeakTopics, weakKey } from '@/components/app/rails';
import { Bar, Card, Icon, Item, Kpi, LinkBtn, Pill, Ring, ScriptText } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { useApp, useLang, useT } from '@/lib/store';

export function ProgressView() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();

  const overall = useMemo(
    () => overallPct(derived.subjects, state.readSections, state.attempts),
    [derived.subjects, state.readSections, state.attempts]
  );
  const weak = useMemo(() => namedWeakTopics(state.attempts, lang).slice(0, 4), [state.attempts, lang]);
  const acc = useMemo(() => accuracy(state.attempts), [state.attempts]);
  // The per-subject sweep walks contentFor + attempts for every subject, so it
  // runs once per data change, not once per render.
  const bySubject = useMemo(
    () => derived.subjects.map((sid) => ({ sid, pct: subjectPct(sid, state.readSections, state.attempts) })),
    [derived.subjects, state.readSections, state.attempts]
  );
  // Real days with activity. The tile here used to be hours invented from
  // a formula over answer and section counts, which nothing ever measured.
  // Read through useNow so the clock is not touched during render; 0 until
  // the client has one, and an empty month label beats "January 1970".
  const now = useNow();
  const month = now ? formatDate(now, lang, { month: 'long' }) : '';

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
            {/* A size container: beside the ring, four tiles only fit when
                this column is wide enough, which the window width does not
                tell you once a sidebar and a rail have taken their share. */}
            <div className="@container min-w-0 flex-1">
              <p className="font-display text-[18px] text-ink">{t('progress.syllabusCovered')}</p>
              <p className="mt-0.5 text-[13.5px] text-ink2">
                {derived.streak > 0 ? t('progress.streakAlive', { n: derived.streak }) : t('progress.noStreak')}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5 @md:grid-cols-4">
                <Kpi value={`${state.attempts.length}`} label={t('dash.questions')} />
                <Kpi value={`${acc}%`} label={t('dash.accuracy')} />
                <Kpi value={`${state.activeDays.length}`} label={t('dash.activeDays')} />
                <Kpi value={`${state.results.length}`} label={t('progress.tests')} />
              </div>
            </div>
          </Card>

          <Card flat>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[16px] text-ink">{t('progress.bySubject')}</h2>
              <Link
                href="/insights/performance"
                className="inline-flex min-h-11 items-center text-[12.5px] font-extrabold text-teal hover:underline"
              >
                {t('common.details')}
              </Link>
            </div>
            {/* Rows are 44px targets with a hover wash that bleeds past the
                text, the same as the syllabus rail. */}
            <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
              {bySubject.map(({ sid, pct }) => {
                return (
                  <Link
                    key={sid}
                    href={`/learn/subject/${sid}`}
                    className="-mx-2 block min-h-11 rounded-[10px] px-2 py-1.5 transition-colors duration-200 hover:bg-paper"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <ScriptText
                        text={subjectName(subjectById(sid), lang)}
                        className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink"
                      />
                      <span className="shrink-0 text-[12.5px] font-extrabold text-ink2 tabular">{pct}%</span>
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
              <Link href="/insights/weak" className="inline-flex min-h-11 items-center text-[12.5px] font-extrabold text-teal hover:underline">
                {t('common.seeAll')}
              </Link>
            </div>
            {weak.length === 0 ? (
              <Card flat>
                <p className="text-[13px] text-ink2 rtl:leading-[1.9]">{t('progress.weakEmpty')}</p>
              </Card>
            ) : (
              <Card flat className="py-0">
                {weak.map((w, i) => (
                  <Item
                    key={weakKey(w)}
                    href={`/session/setup?chapter=${w.chapterId}`}
                    title={w.topic}
                    sub={subjectName(subjectById(w.subjectId), lang)}
                    icon="alert"
                    tone={w.accuracy < 50 ? 'red' : 'orange'}
                    last={i === weak.length - 1}
                    right={<Pill tone={w.accuracy < 50 ? 'red' : 'orange'}>{`${w.accuracy}%`}</Pill>}
                  />
                ))}
              </Card>
            )}
          </div>

          <TodayCard />
          <CareerCard />

          <Link href="/insights/report" className="block">
            <Card
              border="border-orange"
              className="flex items-center gap-4 transition-colors duration-200 hover:border-orangedark"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-orangetint text-orangedark">
                <Icon name="gradCap" size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[16px] text-ink">{t('progress.reportCard', { month })}</span>
                {/* No grade before there is an answer to grade. An empty
                    history used to be graded F. */}
                <span className="block text-[13px] text-ink2">
                  {state.attempts.length ? t('progress.reportCardSub', { grade: grade(acc) }) : t('progress.reportCardSubNone')}
                </span>
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

/**
 * The way into today's report, with today's two numbers on it: the time and
 * the questions. The line under it says what the card is for until there is
 * something to count.
 */
function TodayCard() {
  const t = useT();
  const { lang } = useLang();
  const { state } = useApp();
  const userId = state.user?.id ?? '';
  const [report, setReport] = useState<DailyReport | null>(null);
  // Answering a question changes today, so the count follows it.
  const answered = state.attempts.length;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchDailyReport(createClient()).then((r) => {
      if (alive && r) setReport(r);
    });
    return () => {
      alive = false;
    };
  }, [userId, answered]);

  const active = !!report && (report.seconds >= 60 || report.questions > 0);
  return (
    <Link href="/insights/today" className="block">
      <Card border="border-teal" className="flex items-center gap-4 transition-colors duration-200 hover:border-tealdark">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-tealtint text-teal">
          <Icon name="calendar" size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] text-ink">{t('today.cardTitle')}</span>
          <span className="block text-[13px] text-ink2">
            {active && report
              ? t('today.cardSub', { time: studyTimeLabel(report.seconds, lang), n: report.questions })
              : t('today.cardSubNone')}
          </span>
        </span>
        <span className="hidden sm:block">
          <Pill tone="teal">{t('progress.open')}</Pill>
        </span>
        <Icon name="chevron" size={18} className="shrink-0 text-ink3 sm:hidden" />
      </Card>
    </Link>
  );
}

/** The way into career guidance: Premium's, so Basic sees what it is and whose it is. */
function CareerCard() {
  const t = useT();
  const { derived } = useApp();
  return (
    <Link href="/insights/career" className="block">
      <Card flat className="flex items-center gap-4 transition-colors duration-200 hover:border-teal">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-tealtint text-teal">
          <Icon name="gradCap" size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] text-ink">{t('career.title')}</span>
          <span className="block text-[13px] text-ink2">{derived.access.ai ? t('career.cardSub') : t('aiLock.short')}</span>
        </span>
        <Icon name={derived.access.ai ? 'chevron' : 'lock'} size={18} className="shrink-0 text-ink3" />
      </Card>
    </Link>
  );
}
