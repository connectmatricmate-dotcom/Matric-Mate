'use client';

/**
 * Rail cards, the things a student glances at while working, not the work
 * itself. Deliberately small, quiet and never the primary action.
 */
import Link from 'next/link';
import { useMemo } from 'react';
import { accuracy, confidenceBreakdown, last14, subjectById, subjectPct, weakTopics } from '@matricmate/core';
import { Bar, Card, Icon, Label, Pill, Ring } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

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
                <span className="truncate text-[12.5px] font-extrabold text-ink">{subjectById(sid)?.name}</span>
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
              <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink">{w.topic}</span>
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
  const { derived, state } = useApp();
  const t = useT();
  const usedPct = ((derived.aiLimit - derived.aiLeft) / derived.aiLimit) * 100;
  const low = derived.aiLeft <= Math.max(1, Math.floor(derived.aiLimit * 0.2));

  return (
    <Card flat className="flex items-center gap-4">
      <Ring pct={usedPct} size={62} stroke={7} color={low ? 'var(--color-orange)' : 'var(--color-teal)'}>
        <span className="text-[12px] font-extrabold text-ink tabular">
          {derived.aiLeft}/{derived.aiLimit}
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-extrabold text-ink">{t('tutor.leftToday', { n: derived.aiLeft })}</p>
        <p className="text-[12.5px] leading-[1.5] text-ink2">
          {state.premium.active ? t('tutor.limitBody', { n: derived.aiLimit }) : t('tutor.limitPremium')}
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
      <Link
        href="/pricing"
        className="mt-3 inline-flex min-h-10 items-center rounded-[12px] bg-teal px-3.5 text-[13px] font-extrabold text-white transition-colors duration-200 hover:bg-tealdark"
      >
        {t('account.upgrade')}
      </Link>
    </Card>
  );
}
