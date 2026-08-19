'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SUBJECT_ICON, accuracy, chapterById, chapterName, chapterPct, formatDate, subjectById, subjectName, type IconName, type StringKey } from '@matricmate/core';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { CoachRail, ConfidenceRail, StreakRail, UpgradeRail, WeakRail } from '@/components/app/rails';
import { Bar, Card, Icon, Label, ScriptText } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { useNow } from '@/lib/now';
import { useApp, useLang, useT } from '@/lib/store';

const QUICK: { label: StringKey; icon: IconName; href: string }[] = [
  { label: 'dash.quickMcq', icon: 'target', href: '/session/setup' },
  { label: 'dash.quickCards', icon: 'cards', href: '/session/flashcards' },
  { label: 'dash.quickAi', icon: 'spark', href: '/tutor' },
  { label: 'dash.quickPapers', icon: 'doc', href: '/session/papers' },
  { label: 'dash.quickToppers', icon: 'award', href: '/session/topper-papers' },
];

export function DashboardView() {
  const { state, derived, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const now = useNow();
  const firstName = (state.user?.name ?? t('common.student')).split(' ')[0];

  /** Teacher verifications, the client's trust feature. The card only
   *  appears once real certificates exist; an empty promise would be
   *  exactly the "fake data" this dashboard just stopped showing. */
  const [certCount, setCertCount] = useState(0);
  useEffect(() => {
    let alive = true;
    createClient()
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        if (alive) setCertCount(count ?? 0);
      });
    return () => {
      alive = false;
    };
  }, []);

  const week = useMemo(() => {
    const since = now - 7 * 864e5;
    const recent = state.attempts.filter((a) => a.at >= since);
    // Days actually studied, counted from real activity. This line used to
    // show minutes invented by a formula over counts, and it mixed an
    // all-time section total into a sentence that says "this week".
    const days = state.activeDays.filter((d) => Date.parse(d) >= since).length;
    return {
      accuracy: accuracy(recent),
      questions: recent.length,
      days: Math.min(7, days),
    };
  }, [state.attempts, state.activeDays, now]);

  const lastChapter = state.lastChapterId ? chapterById(state.lastChapterId) : undefined;
  const lastPct = lastChapter ? chapterPct(lastChapter.id, state.readSections, state.attempts) : 0;
  const planDone = derived.plan.filter((task) => task.done).length;

  /** Plan labels are composed here so they follow the app language. */
  function planLabel(task: (typeof derived.plan)[number]) {
    const name = chapterById(task.chapterId)?.title ?? '';
    if (task.kind === 'read') return t('dash.taskRead', { chapter: name });
    if (task.kind === 'mcq') return t('dash.taskMcq', { chapter: name });
    if (task.weakTopic) return t('dash.taskWeak', { topic: task.weakTopic, n: task.weakAccuracy ?? 0 });
    return t('dash.taskCards');
  }

  function taskHref(task: (typeof derived.plan)[number]) {
    if (task.kind === 'read') return `/learn/reader/${task.chapterId}`;
    if (task.kind === 'mcq') return `/session/setup?chapter=${task.chapterId}`;
    return `/session/flashcards?chapter=${task.chapterId}`;
  }

  return (
    <Page>
      <PageHead
        // `now` is 0 until the client reads its clock, better no date than 1970.
        eyebrow={now ? formatDate(now, lang, { weekday: 'long', day: 'numeric', month: 'long' }) : undefined}
        title={t('dash.greeting', { name: firstName })}
        sub={t('dash.weekLine', { q: week.questions, acc: week.accuracy, days: week.days })}
      />
      {/* Which class this whole dashboard is showing. One line, always on. */}
      <p className="-mt-4 mb-5 text-[13px] font-extrabold text-teal">
        {t('tutor.classBadge', { n: state.onboarding?.classLevel ?? 9 })}
      </p>

      <Split>
        <Work className="flex flex-col gap-4">
          {/* Today's plan, the only thing on this page with a coloured ground */}
          <Card tint="bg-teal" border="border-teal">
            <div className="flex items-center gap-3">
              <h2 className="flex-1 font-display text-[18px] text-onbrand">{t('dash.todayPlan')}</h2>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-extrabold text-onbrand tabular">
                {t('dash.doneCount', { a: planDone, b: derived.plan.length })}
              </span>
            </div>

            <div className="my-3 h-[7px] overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-orange transition-[width] duration-200 ease-out"
                style={{ width: `${(planDone / Math.max(1, derived.plan.length)) * 100}%` }}
              />
            </div>

            <ul>
              {derived.plan.map((task) => (
                <li key={task.id} className="flex items-center gap-2 border-t border-onbrand-hair">
                  <button
                    type="button"
                    aria-pressed={task.done}
                    aria-label={`Mark done: ${planLabel(task)}`}
                    onClick={() => actions.togglePlanTask(task.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-[8px] border-2 transition-colors duration-200 ${
                        task.done ? 'border-orange bg-orange text-onbrand' : 'border-onbrand-line hover:border-onbrand'
                      }`}
                    >
                      {task.done ? <Icon name="check" size={14} strokeWidth={3} /> : null}
                    </span>
                  </button>

                  <Link href={taskHref(task)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <ScriptText
                        text={planLabel(task)}
                        className={`text-[13.5px] font-extrabold text-onbrand ${task.done ? 'line-through opacity-70' : ''}`}
                        urduClassName={`text-[13.5px] text-onbrand ${task.done ? 'line-through opacity-70' : ''}`}
                      />
                      <span className="block text-[11.5px] font-extrabold text-onbrand-soft">
                        {subjectName(subjectById(task.subjectId), lang)}
                      </span>
                    </span>
                    <Icon name="chevron" size={17} className="shrink-0 text-onbrand-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {certCount > 0 ? (
            <Link href="/certificates" className="block">
              <Card
                tint="bg-greentint"
                border="border-green"
                className="flex items-center gap-4 transition-colors duration-200 hover:border-teal"
              >
                <span className="text-[24px]">🎓</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-extrabold text-ink">{t('cert.dashCard')}</span>
                  <span className="block text-[13px] text-ink2">{t('cert.dashCardSub')}</span>
                </span>
                <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
              </Card>
            </Link>
          ) : null}

          {/* Continue where you stopped */}
          {lastChapter ? (
            <Link href={`/learn/chapter/${lastChapter.id}`} className="block">
              <Card className="flex items-center gap-4 transition-colors duration-200 hover:border-teal">
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-tealtint text-teal">
                  <Icon name={SUBJECT_ICON[lastChapter.subjectId] ?? 'book'} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <Label>{t('dash.continueLearning')}</Label>
                  <ScriptText
                    text={chapterName(lastChapter, lang)}
                    className="mt-0.5 truncate text-[15.5px] font-extrabold text-ink"
                  />
                  <span className="block text-[13px] text-ink2">
                    {subjectName(subjectById(lastChapter.subjectId), lang)} ·{' '}
                    {t('dash.sectionOf', {
                      a: Math.min(state.lastSectionIndex + 1, lastChapter.sectionCount),
                      b: lastChapter.sectionCount,
                    })}
                  </span>
                  <span className="mt-2 block max-w-[420px]">
                    <Bar pct={lastPct} />
                  </span>
                </span>
                <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
              </Card>
            </Link>
          ) : null}

          {/* Quick actions */}
          <div>
            <h2 className="mb-2 font-display text-[16px] text-ink">{t('dash.quickActions')}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {QUICK.map((q) => (
                <Link key={q.label} href={q.href} className="h-full">
                  <Card flat className="flex h-full min-h-[88px] flex-col gap-2 transition-colors duration-200 hover:border-teal">
                    <Icon name={q.icon} size={22} className="text-teal" />
                    <span className="text-[13.5px] font-extrabold text-ink">{t(q.label)}</span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </Work>

        <Rail>
          <CoachRail />
          <StreakRail />
          <WeakRail />
          <ConfidenceRail />
          <UpgradeRail />
        </Rail>
      </Split>

    </Page>
  );
}
