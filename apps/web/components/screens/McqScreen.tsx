'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type Confidence, type StringKey, XP } from '@matricmate/core';
import { Btn, IconButton } from '@/components/ui/controls';
import { Bar, Card, Icon, Label, Pill } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';
import { session } from '@/lib/session';
import { NoSession } from './NoSession';
import { Page } from '@/components/app/Page';

const LEVELS: { value: Confidence; label: StringKey }[] = [
  { value: 0, label: 'session.conf0' },
  { value: 1, label: 'session.conf1' },
  { value: 2, label: 'session.conf2' },
];

/**
 * Answer → confidence → check. Confidence is stored with every attempt, which is
 * what makes the "how sure vs how right" analytics possible.
 */
export function McqScreen() {
  const { actions } = useApp();
  const t = useT();
  const router = useRouter();
  const s = session.current;
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [checked, setChecked] = useState(false);

  const mcq = s?.mcqs[i];
  if (!s || !mcq) return <NoSession />;

  const answeredCount = Object.keys(s.answers).length;
  const correct = checked && chosen === mcq.answer;
  const xpGain = XP.forAnswer(true, confidence);

  function check() {
    if (!s || !mcq || chosen == null || confidence == null) return;
    const isRight = chosen === mcq.answer;
    setChecked(true);
    session.answer({ mcqId: mcq.id, chosen, confidence, correct: isRight });
    actions.recordAttempt({
      mcqId: mcq.id,
      chapterId: mcq.chapterId,
      subjectId: s.subjectId,
      topic: mcq.topic,
      correct: isRight,
      confidence,
      mode: 'practice',
    });
  }

  function next() {
    if (!s) return;
    if (i + 1 >= s.mcqs.length) {
      router.replace('/session/result');
      return;
    }
    setI(i + 1);
    setChosen(null);
    setConfidence(null);
    setChecked(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <Page width="focus">
      <div className="flex items-center gap-2.5 pt-1">
        <IconButton
          icon="close"
          label={t('common.close')}
          tone="plain"
          onClick={() => router.replace(answeredCount ? '/session/result' : '/practice')}
        />
        <div className="min-w-0 flex-1">
          <Bar pct={((i + (checked ? 1 : 0)) / s.mcqs.length) * 100} tone="teal" h={6} />
          <p className="mt-1 text-[11px] font-extrabold text-ink2">
            {t('session.questionOf', { a: i + 1, b: s.mcqs.length })}
          </p>
        </div>
        <Pill tone="grey">{mcq.topic}</Pill>
      </div>

      <h1 className="mt-4 mb-4 font-display text-[19px] leading-[1.5] text-ink">{mcq.q}</h1>

      <div className="flex flex-col gap-2.5">
        {mcq.options.map((opt, n) => {
          const isChosen = chosen === n;
          const isAnswer = n === mcq.answer;
          const kind = checked ? (isAnswer ? 'ok' : isChosen ? 'bad' : 'idle') : isChosen ? 'sel' : 'idle';
          const shell = {
            ok: 'border-green bg-greentint',
            bad: 'border-red bg-redtint',
            sel: 'border-teal bg-tealtint',
            idle: 'border-line bg-card hover:border-tealtint2',
          }[kind];
          const key = {
            ok: 'bg-green text-white',
            bad: 'bg-red text-white',
            sel: 'bg-teal text-white',
            idle: 'bg-grey text-ink2',
          }[kind];

          return (
            <button
              key={n}
              type="button"
              disabled={checked}
              aria-pressed={isChosen}
              onClick={() => setChosen(n)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-[15px] border-[1.5px] px-3.5 py-3.5 text-left transition-colors duration-200 disabled:cursor-default ${shell}`}
            >
              <span className={`flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-extrabold ${key}`}>
                {String.fromCharCode(65 + n)}
              </span>
              <span className="min-w-0 flex-1 text-[14.5px] leading-[1.5] text-ink">{opt}</span>
              {checked && isAnswer ? <Icon name="check" size={19} strokeWidth={2.6} className="shrink-0 text-green" /> : null}
            </button>
          );
        })}
      </div>

      {/* confidence, the Pakka-meter */}
      {chosen != null && !checked ? (
        <div className="mt-4">
          <Label>{t('session.howSure')}</Label>
          <div className="mt-2 flex gap-2.5">
            {LEVELS.map((l) => {
              const on = confidence === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setConfidence(l.value)}
                  className={`min-h-12 flex-1 rounded-[13px] border-[1.5px] px-2 py-3 text-[12.5px] font-extrabold transition-colors duration-200 ${
                    on ? 'border-orange bg-orangetint text-orangedark' : 'border-line bg-card text-ink2 hover:border-orange'
                  }`}
                >
                  {t(l.label)}
                </button>
              );
            })}
          </div>
          {confidence != null ? (
            <p className="mt-2 text-[13px] text-ink2">
              {confidence === 2
                ? t('session.confHintSure', { xp: xpGain })
                : confidence === 0
                  ? t('session.confHintGuess')
                  : t('session.confHintMid', { xp: xpGain })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* feedback */}
      {checked ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <Card
            flat
            tint={correct ? 'bg-greentint' : 'bg-redtint'}
            border={correct ? 'border-green' : 'border-red'}
            className="flex items-center gap-2.5"
          >
            <Icon name={correct ? 'check' : 'close'} size={20} strokeWidth={2.6} className={correct ? 'text-green' : 'text-red'} />
            <p className={`flex-1 text-[14px] font-extrabold ${correct ? 'text-green' : 'text-red'}`}>
              {correct ? t('session.correct', { xp: XP.forAnswer(true, confidence) }) : t('session.wrong')}
            </p>
          </Card>

          {!correct && confidence === 2 ? (
            <Card flat tint="bg-orangetint" border="border-orange">
              <p className="text-[13.5px] font-extrabold text-orangedark">{t('session.confidentWrong')}</p>
            </Card>
          ) : null}
          {correct && confidence === 0 ? (
            <Card flat tint="bg-tealtint" border="border-tealtint2">
              <p className="text-[13.5px] text-ink2">{t('session.luckyGuess')}</p>
            </Card>
          ) : null}

          <Card>
            <Label className="text-teal">{t('session.why')}</Label>
            <p className="mt-1 text-[14.5px] leading-[1.6] text-ink">{mcq.explanation}</p>
            <Link
              href={`/learn/reader/${mcq.chapterId}`}
              className="mt-3 inline-block text-[12.5px] font-extrabold text-teal hover:underline"
            >
              {t('session.readInChapter')} →
            </Link>
          </Card>
        </div>
      ) : null}

      <div className="sticky bottom-0 mt-5 flex gap-2.5 bg-paper/95 py-4 backdrop-blur">
        {checked ? (
          <>
            <Btn
              title={t('session.askAi')}
              variant="line"
              icon="spark"
              className="flex-1"
              onClick={() => router.push(`/tutor/chat?q=${encodeURIComponent(mcq.q)}`)}
            />
            <Btn
              title={i + 1 >= s.mcqs.length ? t('session.seeResult') : t('session.nextQuestion')}
              onClick={next}
              className="flex-1"
            />
          </>
        ) : (
          <Btn title={t('session.check')} onClick={check} disabled={chosen == null || confidence == null} className="w-full" />
        )}
      </div>
    </Page>
  );
}
