'use client';

/**
 * The landing hero is a working question, not a picture of one.
 *
 * Everything MatricMate claims — real board questions, an honest confidence
 * check, an explanation that teaches — is provable in about ten seconds, so the
 * hero proves it instead of describing it. This is the page's signature.
 */
import { useState } from 'react';
import type { Mcq } from '@matricmate/core';
import { Card, Icon, Pill } from '@/components/ui';

const CONFIDENCE = [
  { value: 0, en: 'Guess', ur: 'Tukka' },
  { value: 1, en: 'Fairly sure', ur: 'Thora pakka' },
  { value: 2, en: 'Certain', ur: 'Pakka' },
] as const;

export function HeroDemo({ mcq }: { mcq: Mcq }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const correct = chosen === mcq.answer;

  function reset() {
    setChosen(null);
    setConfidence(null);
    setChecked(false);
  }

  return (
    <Card className="w-full max-w-[440px]">
      <div className="flex items-center justify-between">
        <Pill tone="grey">{mcq.topic}</Pill>
        <span className="text-[11.5px] font-extrabold text-ink3">FBISE · Physics 9</span>
      </div>

      <p className="mt-3 font-display text-[17px] leading-[1.5] text-ink">{mcq.q}</p>

      <div className="mt-3 flex flex-col gap-2">
        {mcq.options.map((opt, i) => {
          const isAnswer = i === mcq.answer;
          const isChosen = chosen === i;
          const state = checked ? (isAnswer ? 'ok' : isChosen ? 'bad' : 'idle') : isChosen ? 'sel' : 'idle';
          const style = {
            ok: 'border-green bg-greentint',
            bad: 'border-red bg-redtint',
            sel: 'border-teal bg-tealtint',
            idle: 'border-line bg-card hover:border-tealtint2',
          }[state];
          const key = {
            ok: 'bg-green text-white',
            bad: 'bg-red text-white',
            sel: 'bg-teal text-white',
            idle: 'bg-grey text-ink2',
          }[state];
          return (
            <button
              key={opt}
              type="button"
              disabled={checked}
              onClick={() => setChosen(i)}
              className={`flex items-center gap-3 rounded-[15px] border-[1.5px] px-3.5 py-3 text-left transition-colors ${style}`}
            >
              <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-extrabold ${key}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-[14.5px] text-ink">{opt}</span>
              {checked && isAnswer ? <Icon name="check" size={18} className="ml-auto text-green" strokeWidth={2.6} /> : null}
            </button>
          );
        })}
      </div>

      {/* The confidence step — the thing that makes the practice data worth something */}
      {chosen !== null && !checked ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">How sure are you?</p>
          <div className="flex gap-2">
            {CONFIDENCE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setConfidence(c.value)}
                className={`flex-1 rounded-[13px] border-[1.5px] px-2 py-2.5 text-[12.5px] font-extrabold transition-colors ${
                  confidence === c.value ? 'border-orange bg-orangetint text-orangedark' : 'border-line bg-card text-ink2 hover:border-orange/40'
                }`}
              >
                {c.en}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!checked ? (
        <button
          type="button"
          disabled={chosen === null || confidence === null}
          onClick={() => setChecked(true)}
          className="mt-4 w-full rounded-[16px] bg-teal px-5 py-3.5 font-display text-[16px] text-white transition-colors hover:bg-tealdark disabled:pointer-events-none disabled:opacity-40"
        >
          Check answer
        </button>
      ) : (
        <div className="mt-4">
          <div
            className={`flex items-center gap-2 rounded-[16px] border px-4 py-3 ${
              correct ? 'border-green bg-greentint' : 'border-red bg-redtint'
            }`}
          >
            <Icon name={correct ? 'check' : 'close'} size={19} className={correct ? 'text-green' : 'text-red'} strokeWidth={2.6} />
            <span className={`text-[14px] font-extrabold ${correct ? 'text-green' : 'text-red'}`}>
              {correct ? 'Correct — and you knew it.' : 'Not quite. Here’s why.'}
            </span>
          </div>

          {!correct && confidence === 2 ? (
            <p className="mt-2 rounded-[16px] border border-orange bg-orangetint px-4 py-3 text-[13.5px] font-extrabold text-orangedark">
              You said Certain — that’s exactly the kind of gap a test finds first.
            </p>
          ) : null}

          <div className="mt-2 rounded-[16px] border border-line bg-card px-4 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-teal">Why</p>
            <p className="mt-1 text-[14px] leading-[1.6] text-ink">{mcq.explanation}</p>
          </div>

          <button type="button" onClick={reset} className="mt-3 text-[13px] font-extrabold text-teal hover:underline">
            Try it again →
          </button>
        </div>
      )}
    </Card>
  );
}
