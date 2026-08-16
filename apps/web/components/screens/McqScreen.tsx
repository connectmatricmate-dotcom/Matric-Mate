'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { type Confidence, type StringKey, XP } from '@matricmate/core';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Label, Pill, ScriptText } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';
import { session } from '@/lib/session';
import { NoSession } from './NoSession';
import { Page } from '@/components/app/Page';
import { Markdown } from '@/components/ui/Markdown';

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
  // Navigation pending state: the button spins until the next route paints,
  // so there is never a moment where a tap appears to do nothing.
  const [leaving, startLeaving] = useTransition();

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
      startLeaving(() => router.replace('/session/result'));
      return;
    }
    setI(i + 1);
    setChosen(null);
    setConfidence(null);
    setChecked(false);
    // 'instant', not the default: html has scroll-behavior smooth, and a
    // question change animating the scroll reads as the app lagging.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  return (
    <Page width="focus">
      <SessionHeader
        onClose={() => startLeaving(() => router.replace(answeredCount ? '/session/result' : '/practice'))}
        closeLabel={t('common.close')}
        pct={((i + (checked ? 1 : 0)) / s.mcqs.length) * 100}
        label={t('session.questionOf', { a: i + 1, b: s.mcqs.length })}
        right={<Pill tone="grey">{mcq.topic}</Pill>}
        segments={s.mcqs.map((q, j) => {
          const a = s.answers[q.id];
          if (j === i && !checked) return 'current';
          if (a) return a.correct ? 'ok' : 'bad';
          return j < i ? 'done' : 'todo';
        })}
      />

      {/* On a desktop the question earns a surface of its own; unframed, the
          same markup read as a phone screen stretched across empty paper. */}
      <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:p-7 md:shadow-[0_5px_14px_rgba(15,80,100,0.07)]">
      <h1 className="mb-4"><ScriptText text={mcq.q} className="font-display text-[19px] leading-[1.5] text-ink md:text-[22px]" urduClassName="text-[18px] text-ink" /></h1>

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
              <span className="min-w-0 flex-1"><ScriptText text={opt} className="text-[14.5px] leading-[1.5] text-ink" urduClassName="text-[14px] text-ink" /></span>
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
      </div>

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
            <Markdown text={mcq.explanation} className="mt-1 text-[14.5px] leading-[1.6] text-ink" />
            <Link
              href={`/learn/reader/${mcq.chapterId}`}
              className="mt-3 inline-block text-[12.5px] font-extrabold text-teal hover:underline"
            >
              {t('session.readInChapter')} →
            </Link>
          </Card>
        </div>
      ) : null}

      <div className="mt-6 flex gap-2.5">
        {checked ? (
          <>
            <Btn
              title={t('session.askAi')}
              variant="line"
              icon="spark"
              className="flex-1"
              loading={leaving}
              onClick={() =>
                startLeaving(() => {
                  // Tell the tutor what was picked, so the answer addresses
                  // THIS student's confusion instead of re-teaching the topic.
                  const wrong = chosen != null && chosen !== mcq.answer;
                  const prompt = wrong
                    ? `I answered "${mcq.options[chosen]}" but the correct answer is "${mcq.options[mcq.answer]}" for: ${mcq.q}. Why is my answer wrong?`
                    : mcq.q;
                  // The chapter rides along, so the tutor answers from the very notes
                  // this question came from instead of from general memory.
                  router.push(`/tutor/chat?q=${encodeURIComponent(prompt)}&chapter=${mcq.chapterId}`);
                })
              }
            />
            <Btn
              title={i + 1 >= s.mcqs.length ? t('session.seeResult') : t('session.nextQuestion')}
              onClick={next}
              loading={leaving && i + 1 >= s.mcqs.length}
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
