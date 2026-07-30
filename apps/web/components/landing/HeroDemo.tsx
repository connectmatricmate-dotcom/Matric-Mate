'use client';

/**
 * The landing hero is a working question, not a picture of one.
 *
 * Everything MatricMate claims, real board questions, an honest confidence
 * check, an explanation that teaches, is provable in about ten seconds, so the
 * hero proves it instead of describing it. This is the page's signature.
 */
import { useState } from 'react';
import type { Mcq } from '@matricmate/core';
import { Btn, Card, Icon, Pill } from '@/components/ui';

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

  // Four short verdicts, because being right for the wrong reason is the whole point.
  const verdict = correct
    ? confidence === 0
      ? 'Right, but you guessed.'
      : 'Correct.'
    : confidence === 2
      ? 'Wrong, and you were sure.'
      : 'Not quite.';

  function reset() {
    setChosen(null);
    setConfidence(null);
    setChecked(false);
  }

  return (
    // Exact height on desktop, not a minimum. Answering swaps a button for an
    // explanation; if the card could grow by even a pixel the hero grid would
    // re-centre and the headline would jump under the reader's cursor. The
    // verdict and the explanation share one block so the reserved space stays
    // small enough that the card doesn't tower over the copy beside it.
    <Card className="flex w-full max-w-[430px] flex-col md:h-[486px]">
      <div className="flex items-center justify-between">
        <Pill tone="grey">{mcq.topic}</Pill>
        <span className="text-[11.5px] font-extrabold text-ink3">FBISE · Physics 9</span>
      </div>

      <p className="mt-2.5 font-display text-[16px] leading-[1.45] text-ink">{mcq.q}</p>

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
              className={`flex items-center gap-3 rounded-[15px] border-[1.5px] px-3.5 py-2.5 text-left transition-colors duration-200 ${style}`}
            >
              <span className={`flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] text-[12px] font-extrabold ${key}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-[14px] text-ink">{opt}</span>
              {checked && isAnswer ? <Icon name="check" size={18} className="ml-auto text-green" strokeWidth={2.6} /> : null}
            </button>
          );
        })}
      </div>

      {/* Scroll allowance only where the card height is fixed (md). On mobile the
          card grows with its content, so an inner scrollbar would be a bug. */}
      <div className="flex min-h-[142px] min-w-0 flex-1 flex-col justify-end md:overflow-y-auto">
      {/* The confidence step, the thing that makes the practice data worth something */}
      {chosen !== null && !checked ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">How sure are you?</p>
          <div className="flex gap-2">
            {CONFIDENCE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setConfidence(c.value)}
                className={`min-h-10 flex-1 rounded-[13px] border-[1.5px] px-2 py-2.5 text-[12.5px] font-extrabold transition-colors duration-200 ${
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
        <Btn
          title="Check answer"
          onClick={() => setChecked(true)}
          disabled={chosen === null || confidence === null}
          className="mt-4 w-full"
        />
      ) : (
        // Verdict, reason and reset in one block. Two stacked cards plus a
        // dangling link would double the space this state has to reserve, and
        // the explanation reads better in ink than in red on red.
        <div
          className={`mt-4 overflow-hidden rounded-[16px] border border-l-[3px] bg-card ${
            correct ? 'border-green' : 'border-red'
          }`}
        >
          <div
            className={`flex items-center gap-2 px-3.5 py-2 ${correct ? 'bg-greentint' : 'bg-redtint'}`}
          >
            <Icon
              name={correct ? 'check' : 'close'}
              size={16}
              strokeWidth={2.8}
              className={`shrink-0 ${correct ? 'text-green' : 'text-red'}`}
            />
            <span className={`min-w-0 flex-1 text-[13px] font-extrabold ${correct ? 'text-green' : 'text-red'}`}>
              {verdict}
            </span>
            <button
              type="button"
              onClick={reset}
              className="-mr-1 flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] font-extrabold text-ink2 transition-colors duration-200 hover:bg-card hover:text-teal"
            >
              <Icon name="refresh" size={13} strokeWidth={2.6} />
              Try again
            </button>
          </div>
          <p className="px-3.5 py-2.5 text-[13px] leading-[1.6] text-ink2">{mcq.explanation}</p>
        </div>
      )}
      </div>
    </Card>
  );
}
