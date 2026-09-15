'use client';

/**
 * The landing hero is a working question, and it answers itself.
 *
 * Everything MatricMate claims, real board questions, an honest confidence
 * check, an explanation that teaches, is provable in about ten seconds. So
 * the card demonstrates it on a loop rather than waiting for a visitor who
 * may never click: pick an option, admit how sure you were, check, read why,
 * move to the next question.
 *
 * The loop yields the moment anyone touches the card or tabs into it, and
 * never resumes. A demo that fights the person trying to use it is worse than
 * no demo. It also holds still while a mouse rests on it (someone reading the
 * explanation), and while it is scrolled out of view or the tab is hidden,
 * where it only burned timers.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { XP, type Confidence, type Mcq } from '@matricmate/core';
import { Btn, Card, Icon, Pill } from '@/components/ui';

const CONFIDENCE = [
  { value: 0, en: 'Guess' },
  { value: 1, en: 'Fairly sure' },
  { value: 2, en: 'Certain' },
] as const;

/** How the self-playing loop is paced, in milliseconds. */
const BEAT = { option: 1100, confidence: 950, check: 900, read: 3600, blank: 450 };

/**
 * Subscribes to the reduced-motion media query. Read during render rather than
 * set from an effect, so the demo never starts a loop it should not run and
 * then cancels it a frame later.
 */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const q = window.matchMedia('(prefers-reduced-motion: reduce)');
      q.addEventListener('change', onChange);
      return () => q.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

export function HeroDemo({ mcqs }: { mcqs: Mcq[] }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(true);
  const reduced = usePrefersReducedMotion();
  const auto = playing && !reduced && !hovered && inView;
  const box = useRef<HTMLDivElement>(null);

  // Out of view, or in a tab nobody is looking at: hold still.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let seen = true;
    const update = () => setInView(seen && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const mcq = mcqs[index % mcqs.length];
  const correct = chosen === mcq.answer;

  /** Every pending step, so stopping the loop cannot leave one queued. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const stopAuto = useCallback(() => {
    clearAll();
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!auto) return;

    // The demo deliberately answers the second question wrongly while claiming
    // to be certain. That is the product's whole argument, and a demo that is
    // always right never shows it.
    const wrongOnPurpose = index % mcqs.length === 1;
    const pick = wrongOnPurpose ? (mcq.answer + 1) % mcq.options.length : mcq.answer;
    const sureness = wrongOnPurpose ? 2 : index % 3 === 0 ? 2 : 1;

    const at = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms));
    };

    let t = BEAT.option;
    at(t, () => setChosen(pick));
    t += BEAT.confidence;
    at(t, () => setConfidence(sureness));
    t += BEAT.check;
    at(t, () => setChecked(true));
    t += BEAT.read;
    at(t, () => {
      setChosen(null);
      setConfidence(null);
      setChecked(false);
    });
    t += BEAT.blank;
    at(t, () => setIndex((i) => i + 1));

    return clearAll;
  }, [auto, index, mcq.answer, mcq.options.length, mcqs.length]);

  useEffect(() => clearAll, []);

  const verdict = correct
    ? confidence === 0
      ? 'Right, but you guessed.'
      : 'Correct.'
    : confidence === 2
      ? 'Wrong, and you were sure.'
      : 'Not quite.';

  function reset() {
    stopAuto();
    setChosen(null);
    setConfidence(null);
    setChecked(false);
  }

  return (
    // Exact height on desktop, not a minimum. Answering swaps a button for an
    // explanation; if the card could grow by a pixel the hero grid would
    // re-centre and the headline would jump under the reader's cursor.
    // A tablet gets the same height as a floor instead: its column is about
    // 320px wide, where four wrapped options can need more than 512px, and a
    // card that grows is better than one whose answers spill out of it.
    // The wrapper carries the handler because Card is a server-safe primitive
    // with no event props, and one listener here beats one per control.
    <div
      ref={box}
      onPointerDown={stopAuto}
      onFocus={stopAuto}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="w-full max-w-[430px]"
    >
    <Card
      className="relative flex w-full flex-col shadow-[0_24px_70px_rgba(4,34,47,0.45)] md:min-h-[512px] lg:h-[512px]"
    >
      {/* What the app really awards for this answer: 12 for certain, 10 for
          fairly sure, 5 for a guess, the same table the page quotes below. */}
      {checked && correct ? (
        <span className="fx-xp pointer-events-none absolute -top-3 end-5 rounded-full bg-greentint px-3 py-1 text-[12px] font-extrabold text-green">
          +{XP.forAnswer(true, confidence as Confidence | null)} XP
        </span>
      ) : null}

      <div className="flex items-center justify-between">
        <Pill tone="grey">{mcq.topic}</Pill>
        <span className="text-[12px] font-extrabold text-ink3">FBISE · Physics 9</span>
      </div>

      <p key={mcq.q} className="fx-rise mt-2.5 font-display text-[17px] leading-[1.45] text-ink">
        {mcq.q}
      </p>

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
            // onbrand, not white: these fills brighten in the dark theme and
            // white on them drops to about 2:1.
            ok: 'bg-green text-onbrand',
            bad: 'bg-red text-onbrand',
            sel: 'bg-teal text-onbrand',
            idle: 'bg-grey text-ink2',
          }[state];
          return (
            <button
              key={opt}
              type="button"
              disabled={checked}
              onClick={() => {
                stopAuto();
                setChosen(i);
              }}
              className={`flex items-center gap-3 rounded-[15px] border-[1.5px] px-3.5 py-2.5 text-start transition-all duration-300 ${style}`}
            >
              <span className={`flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] text-[12px] font-extrabold transition-colors duration-300 ${key}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-[15px] text-ink">{opt}</span>
              {checked && isAnswer ? <Icon name="check" size={18} className="ms-auto shrink-0 text-green" strokeWidth={2.6} /> : null}
            </button>
          );
        })}
      </div>

      {/* Tall enough on a phone for the longest state, the explanation, so the
          card holds one height through the loop instead of nudging the
          marquee below it at every step. */}
      <div className="flex min-h-[190px] min-w-0 flex-1 flex-col justify-end lg:min-h-[150px] lg:overflow-y-auto">
        {chosen !== null && !checked ? (
          <div className="fx-rise mt-4">
            <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink2">How sure are you?</p>
            <div className="flex gap-2">
              {CONFIDENCE.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    stopAuto();
                    setConfidence(c.value);
                  }}
                  className={`min-h-11 flex-1 rounded-[13px] border-[1.5px] px-2 py-2.5 text-[13px] font-extrabold transition-all duration-300 ${
                    confidence === c.value
                      ? 'border-orange bg-orangetint text-orangedark'
                      : 'border-line bg-card text-ink2 hover:border-[color-mix(in_oklab,var(--color-orange)_40%,transparent)]'
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
            onClick={() => {
              stopAuto();
              setChecked(true);
            }}
            disabled={chosen === null || confidence === null}
            className="mt-4 w-full"
          />
        ) : (
          <div
            className={`fx-rise mt-4 overflow-hidden rounded-[16px] border border-s-[3px] bg-card ${
              correct ? 'border-green' : 'border-red'
            }`}
          >
            <div className={`flex items-center gap-2 px-3.5 py-1 ${correct ? 'bg-greentint' : 'bg-redtint'}`}>
              <Icon
                name={correct ? 'check' : 'close'}
                size={16}
                strokeWidth={2.8}
                className={`shrink-0 ${correct ? 'text-green' : 'text-red'}`}
              />
              <span className={`min-w-0 flex-1 text-[14px] font-extrabold ${correct ? 'text-green' : 'text-red'}`}>
                {verdict}
              </span>
              <button
                type="button"
                onClick={reset}
                className="-me-1.5 flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-extrabold text-ink2 transition-colors duration-200 hover:bg-card hover:text-teal"
              >
                <Icon name="refresh" size={13} strokeWidth={2.6} />
                Try again
              </button>
            </div>
            <p className="px-3.5 py-2.5 text-[14px] leading-[1.6] text-ink2">{mcq.explanation}</p>
          </div>
        )}
      </div>
    </Card>
    </div>
  );
}
