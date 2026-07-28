'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { XP, accuracy, chapterById, grade } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { Card, Pill, Ring } from '@/components/ui/primitives';
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

  const answers = useMemo(() => (s ? Object.values(s.answers) : []), [s]);
  const score = answers.filter((a) => a.correct).length;
  const total = s?.mcqs.length ?? 0;
  const pct = total ? Math.round((score / total) * 100) : 0;

  const xp = useMemo(() => {
    const base = answers.reduce((n, a) => n + XP.forAnswer(a.correct, a.confidence), 0);
    return s?.mode === 'exam' ? base * XP.examMultiplier : base;
  }, [answers, s?.mode]);

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
  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      n += Math.max(1, Math.round(pct / 18));
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

  if (!s) return <NoSession />;

  const good = pct >= 70;
  const diff = pct - accuracy(state.attempts);

  return (
    <Page width="focus">
      <div className="flex flex-col items-center">
        <Ring pct={shown} size={150} stroke={12} color={good ? 'var(--color-orange)' : 'var(--color-red)'}>
          <span className="font-display text-[30px] text-ink tabular">{shown}%</span>
          <span className="text-[13px] font-extrabold text-ink2">
            {score} / {total}
          </span>
        </Ring>
        <h1 className="mt-4 text-center font-display text-[23px] text-ink">
          {good ? t('session.resultGood', { name: (state.user?.name ?? 'Student').split(' ')[0] }) : t('session.resultTry')}
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
          <p className="text-[13.5px] font-extrabold text-red">{t('session.weakSpot', { topic: weakest })}</p>
          <p className="mt-0.5 text-[13px] text-ink2">{t('session.weakSpotSub')}</p>
          <Btn
            title={t('session.studyNow')}
            variant="danger"
            sm
            className="mt-3"
            onClick={() => router.replace(`/learn/chapter/${s.chapterId ?? chapterById(s.mcqs[0].chapterId)?.id}`)}
          />
        </Card>
      ) : null}

      <div className="mt-6 flex gap-2.5">
        <Btn title={t('session.reviewAnswers')} variant="line" className="flex-1" onClick={() => router.replace('/session/review')} />
        <Btn
          title={t('common.done')}
          className="flex-1"
          onClick={() => {
            session.clear();
            router.replace('/practice');
          }}
        />
      </div>

      <p className="mt-4 text-center text-[13px] text-ink2">{t('session.resultFootnote')}</p>
    </Page>
  );
}
