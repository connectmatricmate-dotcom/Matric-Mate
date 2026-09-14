'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  chapterById,
  chapterName,
  fetchDailyReport,
  formatDate,
  karachiDay,
  studyTimeLabel,
  subjectById,
  subjectName,
  type DailyReport,
} from '@matricmate/core';
import { Page, PageHead, Split, Work, Rail } from '@/components/app/Page';
import { StreakRail } from '@/components/app/rails';
import { Btn } from '@/components/ui/controls';
import { Bar, Card, Empty, Icon, Kpi, Pill, ScriptText, Skeleton } from '@/components/ui/primitives';
import { useNow } from '@/lib/now';
import { createClient } from '@/lib/supabase/client';
import { useApp, useLang, useT } from '@/lib/store';

/** Today and the six days before it: a week to look back over, no further. */
const DAYS_BACK = 7;

/** A YYYY-MM-DD day as noon in Karachi, so formatting it never slips a day either side. */
const dayInstant = (day: string) => Date.parse(`${day}T12:00:00+05:00`);

/**
 * One day of study, next to the monthly report card.
 *
 * The client asked for "what I studied today" on its own: the monthly card
 * says how the month went, and a student (or the parent they show it to)
 * also wants the day. Read from the database's own day (daily_report,
 * migration 0042), which knows the time spent and the dates of reading and
 * flashcards that the device does not keep.
 */
export function DailyReportView() {
  const t = useT();
  const { lang } = useLang();
  const { state, derived } = useApp();
  const now = useNow();
  const days = now ? Array.from({ length: DAYS_BACK }, (_, back) => karachiDay(back, now)) : [];
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? days[0] ?? '';
  const userId = state.user?.id ?? '';

  const [settled, setSettled] = useState<{ day: string; report: DailyReport | null } | null>(null);
  const [reload, setReload] = useState(0);
  const loading = !settled || settled.day !== day;

  useEffect(() => {
    if (!day || !userId) return;
    let alive = true;
    void fetchDailyReport(createClient(), day).then((report) => {
      if (alive) setSettled({ day, report });
    });
    return () => {
      alive = false;
    };
  }, [day, userId, reload]);

  // Today moves while the page is open: read it again when the student comes back to it.
  const today = days[0] === day;
  const refresh = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    if (!today) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [today, refresh]);

  const dayLabel = (d: string, i: number) =>
    i === 0 ? t('today.today') : i === 1 ? t('today.yesterday') : formatDate(dayInstant(d), lang, { weekday: 'short', day: 'numeric' });

  const report = loading ? null : settled.report;
  const failed = !loading && !report;
  const empty = !!report && report.questions === 0 && report.sections === 0 && report.cards === 0 && report.tests.length === 0;

  return (
    <Page>
      <PageHead
        back="/progress"
        backLabel={t('progress.title')}
        title={t('today.title')}
        sub={day ? formatDate(dayInstant(day), lang, { weekday: 'long', day: 'numeric', month: 'long' }) : undefined}
      />

      <div role="radiogroup" aria-label={t('today.pickDay')} className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === day}
            onClick={() => setPicked(i === 0 ? null : d)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-[13px] font-extrabold transition-colors duration-200 ${
              d === day ? 'bg-teal text-onbrand' : 'border border-line bg-card text-ink2 hover:border-teal hover:text-ink'
            }`}
          >
            {dayLabel(d, i)}
          </button>
        ))}
      </div>

      <Split>
        <Work className="flex flex-col gap-4">
          {loading ? (
            <DailySkeleton />
          ) : failed ? (
            <Card flat tint="bg-redtint" border="border-red">
              <p className="text-[13.5px] font-extrabold text-red">{t('today.loadFailed')}</p>
              <Btn title={t('common.retry')} variant="line" sm className="mt-3" onClick={refresh} />
            </Card>
          ) : report ? (
            <>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <Kpi value={studyTimeLabel(report.seconds, lang)} label={t('today.timeInApp')} />
                <Kpi value={`${report.questions}`} label={t('today.questions')} />
                <Kpi value={`${report.sections}`} label={t('today.sections')} />
                <Kpi value={`${report.cards}`} label={t('today.cards')} />
              </div>

              {empty ? (
                <Empty
                  icon="calendar"
                  title={today ? t('today.nothingTitle') : t('today.nothingPastTitle')}
                  sub={today ? t('today.nothingBody') : report.opened ? t('today.nothingPastBody') : t('today.notOpened')}
                />
              ) : (
                <>
                  {report.subjects.length ? (
                    <Card flat>
                      <h2 className="mb-3 font-display text-[16px] text-ink">{t('today.bySubject')}</h2>
                      <div className="flex flex-col gap-3">
                        {report.subjects.map((s) => {
                          const pct = s.questions ? Math.round((s.correct / s.questions) * 100) : 0;
                          return (
                            <div key={s.subject}>
                              <span className="flex items-baseline justify-between gap-2">
                                <ScriptText
                                  text={subjectName(subjectById(s.subject), lang) || s.subject}
                                  className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-ink"
                                />
                                <span className="shrink-0 text-[12.5px] font-extrabold text-ink2 tabular">
                                  {t('today.rightOf', { c: s.correct, n: s.questions })}
                                </span>
                              </span>
                              <span className="mt-1.5 block">
                                <Bar pct={pct} tone={pct >= 70 ? 'green' : pct >= 40 ? 'orange' : 'red'} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ) : null}

                  {report.tests.length ? (
                    <Card flat>
                      <h2 className="mb-2 font-display text-[16px] text-ink">{t('today.tests')}</h2>
                      <ul className="flex flex-col">
                        {report.tests.map((x, i) => {
                          const pct = x.total ? Math.round((x.score / x.total) * 100) : 0;
                          return (
                            <li key={`${x.label}-${i}`} className="flex min-h-11 items-center gap-3 border-b border-line py-2 last:border-b-0">
                              <Icon name="clock" size={17} className="shrink-0 text-orangedark" />
                              <ScriptText text={x.label} className="min-w-0 flex-1 text-[13.5px] font-extrabold text-ink" />
                              <Pill tone={pct >= 70 ? 'green' : 'red'}>{`${x.score}/${x.total}`}</Pill>
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  ) : null}

                  {report.chapters.length ? (
                    <Card flat>
                      <h2 className="mb-2 font-display text-[16px] text-ink">{t('today.chapters')}</h2>
                      <ul className="flex flex-col">
                        {report.chapters.map((id) => {
                          // Named from the chapter index once it has loaded; the id until then.
                          void derived.contentReady;
                          const chapter = chapterById(id);
                          return (
                            <li key={id} className="border-b border-line last:border-b-0">
                              <Link
                                href={`/learn/chapter/${id}`}
                                className="-mx-2 flex min-h-11 items-center gap-3 rounded-[10px] px-2 py-2 transition-colors duration-200 hover:bg-paper"
                              >
                                <Icon name="book" size={17} className="shrink-0 text-teal" />
                                <span className="min-w-0 flex-1">
                                  <ScriptText text={chapter ? chapterName(chapter, lang) : id} className="text-[13.5px] font-extrabold text-ink" />
                                  {chapter ? (
                                    <span className="block text-[12px] text-ink2">{subjectName(subjectById(chapter.subjectId), lang)}</span>
                                  ) : null}
                                </span>
                                <Icon name="chevron" size={16} className="shrink-0 text-ink3" />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </Work>

        <Rail>
          <StreakRail />
        </Rail>
      </Split>
    </Page>
  );
}

/** Shaped like the loaded report: four figures, then a card of subject rows. */
function DailySkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[74px] w-full rounded-[16px]" />
        ))}
      </div>
      <Card flat className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-[7px] w-full rounded-full" />
          </div>
        ))}
      </Card>
    </>
  );
}
