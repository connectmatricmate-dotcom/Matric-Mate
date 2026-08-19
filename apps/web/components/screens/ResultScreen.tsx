'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { accuracy, chapterById, grade, xpForAttempt } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { Card, Pill, Ring, ScriptText } from '@/components/ui/primitives';
import { fireConfetti } from '@/lib/confetti';
import { useApp, useT } from '@/lib/store';
import { session } from '@/lib/session';
import { NoSession } from './NoSession';
import { Page } from '@/components/app/Page';

export function ResultScreen() {
  const { state, actions } = useApp();
  const t = useT();
  const router = useRouter();
  const s = session.current;
  const saved = useRef(false);
  const [shown, setShown] = useState(0);
  const [leaving, startLeaving] = useTransition();

  const answers = useMemo(() => (s ? Object.values(s.answers) : []), [s]);
  const score = answers.filter((a) => a.correct).length;
  const total = s?.mcqs.length ?? 0;
  const pct = total ? Math.round((score / total) * 100) : 0;

  /* Through core's own rule, so the figure shown here is exactly what the
     store credits and what a later recompute rebuilds. */
  const xp = useMemo(
    () => answers.reduce((n, a) => n + xpForAttempt({ ...a, mode: s?.mode ?? 'practice' }), 0),
    [answers, s?.mode],
  );

  // The result is written once, on arrival, re-rendering must not double-count it.
  useEffect(() => {
    if (!s || saved.current) return;
    saved.current = true;
    actions.addResult({
      subjectId: s.subjectId,
      chapterId: s.chapterId,
      label: s.label,
      score,
      total,
      xp,
      mode: s.mode,
      attemptIds: [],
    });
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  // The ring counts up rather than snapping, the one flourish on this screen.
  // The CSS reduced-motion guard cannot reach a JS interval, so under reduced
  // motion the first (and only) tick jumps straight to the final value.
  // One burst when a good score lands. fireConfetti no-ops under reduced
  // motion, so this needs no separate guard.
  useEffect(() => {
    if (total && Math.round((score / total) * 100) >= 70) fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let n = 0;
    const timer = setInterval(() => {
      n = reduce ? pct : n + Math.max(1, Math.round(pct / 18));
      if (n >= pct) {
        n = pct;
        clearInterval(timer);
      }
      setShown(n);
    }, 24);
    return () => clearInterval(timer);
  }, [pct]);

  const weakest = useMemo(() => {
    const counts = new Map<string, number>();
    answers
      .filter((a) => !a.correct)
      .forEach((a) => {
        const topic = s?.mcqs.find((m) => m.id === a.mcqId)?.topic;
        if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
      });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [answers, s]);

  // Memoized: this render runs ~42 times a second while the ring counts up,
  // and accuracy() walks the full attempts history on every call.
  const overallAccuracy = useMemo(() => accuracy(state.attempts), [state.attempts]);

  if (!s) return <NoSession />;

  const good = pct >= 70;
  const diff = pct - overallAccuracy;

  return (
    <Page width="focus">
      <div className="flex flex-col items-center">
        <Ring pct={shown} size={150} stroke={12} color={good ? 'var(--color-orange)' : 'var(--color-red)'}>
          <span className="font-display text-[30px] text-ink tabular">{shown}%</span>
          <span className="text-[13px] font-extrabold text-ink2">
            {score} / {total}
          </span>
        </Ring>
        {/* Stars land one at a time after the ring settles, the same beat as
            the Android result screen. */}
        <div className="mt-4 flex gap-1.5" aria-label={`${pct >= 90 ? 3 : pct >= 70 ? 2 : 1} of 3 stars`}>
          {[0, 1, 2].map((i) => {
            const earned = i < (pct >= 90 ? 3 : pct >= 70 ? 2 : 1);
            return (
              <span key={i} className={`fx-pop ${i === 0 ? 'fx-pop-d1' : i === 1 ? 'fx-pop-d2' : 'fx-pop-d3'}`}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill={earned ? '#F7C948' : 'var(--color-grey)'}>
                  <path d="M12 2.6 15 9l7 .9-5.2 4.8 1.4 7-6.2-3.5L5.8 21.7l1.4-7L2 9.9 9 9l3-6.4Z" />
                </svg>
              </span>
            );
          })}
        </div>
        <h1 className="mt-2 text-center font-display text-[23px] text-ink">
          {good ? t('session.resultGood', { name: (state.user?.name ?? t('common.student')).split(' ')[0] }) : t('session.resultTry')}
        </h1>
        <p className="text-center text-[13px] text-ink2">{s.label}</p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Pill tone={good ? 'green' : 'red'}>{t('session.grade', { g: grade(pct) })}</Pill>
        <Pill tone="orange">{s.mode === 'exam' ? t('session.xpDoubled', { n: xp }) : t('session.xpEarned', { n: xp })}</Pill>
        <Pill tone="grey">{t('session.vsAverage', { n: `${diff >= 0 ? '+' : ''}${diff}` })}</Pill>
      </div>

      {weakest ? (
        <Card flat tint="bg-redtint" border="border-red" className="mt-6">
          <ScriptText
            text={t('session.weakSpot', { topic: weakest })}
            className="text-[13.5px] font-extrabold text-red"
            urduClassName="text-[13.5px] text-red"
          />
          <p className="mt-0.5 text-[13px] text-ink2">{t('session.weakSpotSub')}</p>
          <Btn
            title={t('session.studyNow')}
            variant="danger"
            sm
            className="mt-3"
            loading={leaving}
            onClick={() => startLeaving(() => router.replace(`/learn/chapter/${s.chapterId ?? chapterById(s.mcqs[0].chapterId)?.id}`))}
          />
        </Card>
      ) : null}

      <div className="mt-6 flex gap-2.5">
        <Btn
          title={t('session.reviewAnswers')}
          variant="line"
          className="flex-1"
          onClick={() => startLeaving(() => router.replace('/session/review'))}
        />
        <Btn
          title={t('common.done')}
          className="flex-1"
          loading={leaving}
          onClick={() => {
            session.clear();
            startLeaving(() => router.replace('/practice'));
          }}
        />
      </div>

      <p className="mt-4 text-center text-[13px] text-ink2">{t('session.resultFootnote')}</p>
    </Page>
  );
}
