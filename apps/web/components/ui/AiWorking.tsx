'use client';

import { useEffect, useState } from 'react';
import type { StringKey } from '@matricmate/core';
import { useT } from '@/lib/store';

/**
 * The screen a student looks at while the AI writes something.
 *
 * Twenty to forty seconds is a long time to sit in front of a button that has
 * only gone dim: the client read that as a tap that had missed. So this takes
 * the whole viewport, names what is being made, and keeps moving. The Android
 * app has the same thing, deliberately (src/components/AiWorking.tsx).
 *
 * No percentage. The route reports no progress, and a bar that creeps to 90%
 * and waits there is the oldest lie in software. These stages rotate on a
 * timer and each one names something the route genuinely does.
 */

const STAGES: StringKey[] = [
  'states.workReading',
  'states.workPattern',
  'states.workWriting',
  'states.workChecking',
  'states.workAlmost',
];

const STAGE_MS = 6500;

export function AiWorking({
  open,
  title,
  onCancel,
}: {
  open: boolean;
  title: string;
  /**
   * A way out. This covered the whole viewport with no control on it and
   * nothing behind it timed out, so a student on bad signal could be held here
   * with only the browser's back button, which leaves the request running.
   */
  onCancel?: () => void;
}) {
  // Mounted only while it is wanted, so the stage counter starts at the first
  // line every time rather than wherever the last run left it.
  if (!open) return null;
  return <Working title={title} onCancel={onCancel} />;
}

function Working({ title, onCancel }: { title: string; onCancel?: () => void }) {
  const t = useT();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStage((n) => Math.min(n + 1, STAGES.length - 1)), STAGE_MS);
    return () => clearInterval(id);
  }, []);

  /* Escape is the key people press to get out of something covering the page,
     and it should do what the button does. */
  useEffect(() => {
    if (!onCancel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  /*
   * The page underneath must not scroll behind this, and a student pressing
   * Escape or Tab must not land on a control they cannot see.
   */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-paper px-6 text-center"
    >
      <div className="flex h-[54px] items-end gap-2.5" aria-hidden>
        <span className="fx-work h-[54px] w-3 rounded-full bg-teal" />
        <span className="fx-work fx-work-2 h-[54px] w-3 rounded-full bg-orange" />
        <span className="fx-work fx-work-3 h-[54px] w-3 rounded-full bg-green" />
      </div>

      <div>
        {/* Nastaliq needs far more than the Latin 1.15, or an Urdu title's
            two lines run into each other. */}
        <h2 className="font-display text-[24px] leading-[1.15] text-ink md:text-[28px] rtl:leading-[1.8]">{title}</h2>
        {/* Fixed height, so a longer line does not shove the heading up the
            screen every time the stage changes. Taller in Urdu, whose line
            box is taller. */}
        <p className="flex h-12 items-center justify-center text-[15px] text-ink2 rtl:h-16">{t(STAGES[stage])}</p>
      </div>

      <p className="max-w-[320px] rounded-full bg-tealtint px-4 py-2.5 text-[13px] font-extrabold text-teal">
        {t('states.workStay')}
      </p>

      {/* Quiet, and below the reassurance, because leaving is not the thing to
          do here. It just has to be possible. */}
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 cursor-pointer px-4 text-[13.5px] font-extrabold text-ink2 underline-offset-4 hover:text-teal hover:underline"
        >
          {t('common.cancel')}
        </button>
      ) : null}
    </div>
  );
}
