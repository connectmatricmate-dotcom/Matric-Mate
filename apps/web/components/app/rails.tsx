'use client';

/**
 * Rail cards, the things a student glances at while working, not the work
 * itself. Deliberately small, quiet and never the primary action.
 */
import Link from 'next/link';
import { UpgradeButton } from '@/components/commerce/UpgradeButton';
import { useEffect, useMemo, useState } from 'react';
import { accuracy, chapterById, chapterName, chaptersFor, confidenceBreakdown, fetchLatestCoachReport, last14, subjectById, subjectName, subjectPct, weakTopics } from '@matricmate/core';
import type { CoachReport } from '@matricmate/core';
import { Bar, Card, Icon, Label, Pill, Ring, ScriptText, Skeleton } from '@/components/ui/primitives';
import { ScriptNumbers } from '@/components/ui/ScriptList';
import { useApp, useLang, useT } from '@/lib/store';
import { useTutorQuota } from '@/lib/use-tutor-quota';
import { Markdown } from '@/components/ui/Markdown';

/**
 * The Pakka-meter, promoted out of a sub-page.
 *
 * Every answer carries how sure the student was, so this is the one thing the
 * app knows that a textbook can't tell them: whether their confidence is
 * earned. Bar length is accuracy; the count on the right is how often they
 * reached for that level. A short green bar is the interesting case.
 */
export function ConfidenceRail() {
  const { state } = useApp();
  const t = useT();
  const rows = useMemo(() => confidenceBreakdown(state.attempts), [state.attempts]);
  const labels = [t('session.conf0'), t('session.conf1'), t('session.conf2')];
  const tones = ['red', 'orange', 'green'] as const;

  const used = rows.some((r) => r.said > 0);

  return (
    <Card flat>
      <Label>{t('progress.confidenceTitle')}</Label>
      {used ? (
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.confidence}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-extrabold text-ink">{labels[r.confidence]}</span>
                <span className="text-[11.5px] font-extrabold text-ink2 tabular">
                  {r.said ? `${r.accuracy}% · ${r.said}×` : t('progress.notUsed')}
                </span>
              </div>
              <div className="mt-1">
                <Bar pct={r.accuracy} tone={tones[r.confidence]} h={6} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] leading-[1.6] text-ink2">{t('progress.confidenceEmpty')}</p>
      )}
      <Link
        href="/insights/performance"
        className="mt-3 inline-flex min-h-9 items-center gap-1 text-[12.5px] font-extrabold text-teal hover:underline"
      >
        {t('common.details')}
        <Icon name="arrowRight" size={13} strokeWidth={2.4} />
      </Link>
    </Card>
  );
}

/** Fourteen days at a glance, the shape of a habit, not a number. */
export function StreakRail() {
  const { state, derived } = useApp();
  const t = useT();
  const days = useMemo(() => last14(state.activeDays), [state.activeDays]);

  return (
    <Card flat>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orangetint text-orangedark">
          <Icon name="flame" size={15} strokeWidth={2.4} />
        </span>
        <p className="min-w-0 flex-1 text-[13.5px] font-extrabold text-ink">
          {derived.streak > 0 ? t('progress.streakAlive', { n: derived.streak }) : t('progress.noStreak')}
        </p>
      </div>
      <div className="mt-3 flex gap-1" aria-hidden>
        {days.map((on, i) => (
          <span key={i} className={`h-6 flex-1 rounded-[4px] ${on ? 'bg-orange' : 'bg-grey'}`} />
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink3">{t('progress.last14')}</p>
    </Card>
  );
}

/** Where the syllabus actually stands, subject by subject. */
export function SyllabusRail({ limit = 5 }: { limit?: number }) {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const rows = useMemo(
    () =>
      derived.subjects
        .slice(0, limit)
        .map((sid) => ({ sid, pct: subjectPct(sid, state.readSections, state.attempts) })),
    [derived.subjects, limit, state.readSections, state.attempts]
  );

  return (
    <Card flat>
      <Label>{t('progress.bySubject')}</Label>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.map(({ sid, pct }) => {
          return (
            <Link key={sid} href={`/learn/subject/${sid}`} className="block">
              <span className="flex items-baseline justify-between gap-2">
                <ScriptText
                  text={subjectName(subjectById(sid), lang)}
                  className="truncate text-[12.5px] font-extrabold text-ink"
                />
                <span className="text-[11.5px] font-extrabold text-ink2 tabular">{pct}%</span>
              </span>
              <span className="mt-1 block">
                <Bar pct={pct} tone="teal" h={5} />
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/** The three topics to fix first. Empty until there is enough evidence. */
export function WeakRail({ limit = 3 }: { limit?: number }) {
  const { state } = useApp();
  const t = useT();
  const rows = useMemo(() => weakTopics(state.attempts).slice(0, limit), [state.attempts, limit]);

  if (rows.length === 0) return null;

  return (
    <Card flat tint="bg-redtint" border="border-redtint">
      <Label className="text-red">{t('progress.weakTopics')}</Label>
      <ul className="mt-2.5 flex flex-col gap-2">
        {rows.map((w) => (
          <li key={w.topic}>
            <Link href={`/session/setup?chapter=${w.chapterId}`} className="flex items-center gap-2">
              {/* truncate clips the line's logical end, so an Urdu topic has
                  to carry dir="rtl" or the ellipsis eats its first word. */}
              <ScriptText
                text={w.topic}
                className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink"
                urduClassName="min-w-0 flex-1 truncate text-[13px] text-ink"
              />
              <Pill tone={w.accuracy < 50 ? 'red' : 'orange'}>{w.accuracy}%</Pill>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/insights/weak"
        className="mt-3 inline-flex min-h-9 items-center gap-1 text-[12.5px] font-extrabold text-red hover:underline"
      >
        {t('common.seeAll')}
        <Icon name="arrowRight" size={13} strokeWidth={2.4} />
      </Link>
    </Card>
  );
}

/** Overall coverage, as a single ring. */
export function CoverageRail() {
  const { state, derived } = useApp();
  const t = useT();
  const overall = useMemo(
    () => (derived.subjects.length ? Math.round(derived.subjects.reduce((n, s) => n + subjectPct(s, state.readSections, state.attempts), 0) / derived.subjects.length) : 0),
    [derived.subjects, state.readSections, state.attempts]
  );
  const acc = useMemo(() => accuracy(state.attempts), [state.attempts]);

  return (
    <Card flat className="flex items-center gap-4">
      <Ring pct={overall} size={68} stroke={8}>
        <span className="font-display text-[16px] text-ink tabular">{overall}%</span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-extrabold text-ink">{t('progress.syllabusCovered')}</p>
        <p className="text-[12.5px] text-ink2">
          {acc}% {t('dash.accuracy')} · {state.attempts.length} {t('common.questions')}
        </p>
      </div>
    </Card>
  );
}

/** AI budget for the day, where a student can see it before they need it. */
export function TutorBudgetRail() {
  const { derived } = useApp();
  const t = useT();
  // The server's quota when it has arrived; the local mirror until then.
  const [quota] = useTutorQuota();
  const left = quota ? quota.remaining : derived.aiLeft;
  const limit = quota ? quota.limit : derived.aiLimit;
  const usedPct = (limit ? (limit - left) / limit : 0) * 100;
  const low = left <= Math.max(1, Math.floor(limit * 0.2));

  return (
    <Card flat className="flex items-center gap-4">
      <Ring pct={usedPct} size={62} stroke={7} color={low ? 'var(--color-orange)' : 'var(--color-teal)'}>
        <span className="text-[12px] font-extrabold text-ink tabular">
          {left}/{limit}
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-extrabold text-ink">{t('tutor.leftToday', { n: left })}</p>
        <p className="text-[12.5px] leading-[1.5] text-ink2">
          {limit === 0 ? t('tutor.limitPremium') : t('tutor.limitBody', { n: limit })}
        </p>
      </div>
    </Card>
  );
}

/** A quiet nudge to the one thing this rail can't do: unlock everything. */
export function UpgradeRail() {
  const { state } = useApp();
  const t = useT();
  if (state.premium.active) return null;

  return (
    <Card flat tint="bg-tealtint" border="border-tealtint2">
      <div className="flex items-center gap-2">
        <Icon name="lock" size={16} className="shrink-0 text-teal" />
        <p className="text-[13px] font-extrabold text-ink">{t('billing.statusFree')}</p>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-[1.6] text-ink2">{t('billing.freeBody')}</p>
      <UpgradeButton sm className="mt-3" />
    </Card>
  );
}

/**
 * The weekly AI coach: two sentences about the week, the two weakest topics
 * with why they matter, three things to do. One model call per week, cached
 * server-side in coach_reports; quiet until there is practice to coach.
 */
export function CoachRail() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  /**
   * The settled result, tagged with who it belongs to.
   *
   * One piece of state rather than a report plus a loading flag, because
   * "loading" is then derived: a result for a different student, or none at
   * all, is a load in progress. That also keeps the effect from calling
   * setState synchronously to reset the flag when the student changes, which
   * is a cascading render and a lint error.
   */
  const [settled, setSettled] = useState<{ userId: string; report: CoachReport | null } | null>(null);
  const userId = state.user?.id ?? '';
  const loading = settled?.userId !== userId;
  const report = settled?.userId === userId ? settled.report : null;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    // A read. Reports are written by the nightly job, so opening the dashboard
    // never waits on a model call and never spends a question.
    void fetchLatestCoachReport()
      .then((r) => {
        if (alive) setSettled({ userId, report: r });
      })
      .catch(() => {
        // A failed read is still settled: show the welcome card rather than
        // spinning a skeleton forever.
        if (alive) setSettled({ userId, report: null });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  /**
   * A skeleton while the report is in flight, not the welcome card.
   *
   * Every student who has a report saw "welcome, here are three first steps"
   * for as long as the fetch took, then watched it swap to their actual week.
   * Two different pieces of writing in the same box, one of them wrong, on
   * every dashboard open. Shape-matched so nothing jumps when it arrives.
   */
  if (loading) {
    return (
      <Card flat tint="bg-tealtint" border="border-teal" className="flex flex-col gap-2">
        <Label className="text-teal">{t('tutor.coachTitle')}</Label>
        {/* Each bar carries the colour of the line it stands in for: the
            summary is ink, the label and the actions below it are ink2. */}
        <Skeleton className="h-3.5 w-full" tone="ink" />
        <Skeleton className="h-3.5 w-[88%]" tone="ink" />
        <Skeleton className="mb-1 h-3.5 w-[94%]" tone="ink" />
        <Skeleton className="h-3 w-2/5" tone="ink2" />
        <Skeleton className="h-3 w-4/5" tone="ink2" />
        <Skeleton className="h-3 w-3/4" tone="ink2" />
      </Card>
    );
  }

  if (!report) {
    /*
     * Never blank. This used to render nothing for a student with no history,
     * so the newest students, the ones least sure what to do, got the least
     * guidance. Written locally rather than asked of the model: there is
     * nothing to report on yet, and inventing a week they have not had would
     * be worse than saying so.
     */
    const firstName = (state.user?.name ?? '').split(' ')[0];
    const chapter = state.lastChapterId ? chapterById(state.lastChapterId) : undefined;
    const first = chapter ?? chaptersFor(derived.subjects[0] ?? 'phy')[0];
    return (
      <Card flat tint="bg-tealtint" border="border-teal" className="flex flex-col gap-2">
        <Label className="text-teal">{t('tutor.coachTitle')}</Label>
        <ScriptText
          text={t('tutor.coachWelcome', { name: firstName })}
          className="text-[13px] leading-[1.6] text-ink"
          urduClassName="text-[13px] text-ink"
        />
        <Label>{t('tutor.coachFirstSteps')}</Label>
        <ScriptNumbers
          items={[t('tutor.coachStep1', { chapter: first ? chapterName(first, lang) : '' }), t('tutor.coachStep2'), t('tutor.coachStep3')]}
          className="text-[12.5px] leading-[1.5] text-ink2"
          listClassName="flex flex-col gap-1"
        />
      </Card>
    );
  }
  return (
    <Card flat tint="bg-tealtint" border="border-teal" className="flex flex-col gap-2">
      <Label className="text-teal">{t('tutor.coachTitle')}</Label>
      <Markdown text={report.summary} className="text-[13px] leading-[1.6] text-ink" />
      {report.weak.slice(0, 2).map((w) => (
        <div key={w.topic}>
          <ScriptText text={w.topic} className="text-[13px] font-extrabold text-ink" urduClassName="text-[13px] text-ink" />
          <ScriptText text={w.why} className="text-[12px] leading-[1.5] text-ink2" urduClassName="text-[12px] text-ink2" />
        </div>
      ))}
      <Label>{t('tutor.coachActions')}</Label>
      {/* The list supplies the number. Strip one the model wrote, or a
          student reads "1. 1. Revise circular motion". */}
      <ScriptNumbers
        items={report.actions.slice(0, 3).map((a) => a.replace(/^\s*\d{1,2}[.)]\s*/, ''))}
        className="text-[12.5px] leading-[1.5] text-ink2"
        listClassName="flex flex-col gap-1"
      />
    </Card>
  );
}
