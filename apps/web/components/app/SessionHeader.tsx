'use client';

/**
 * The one header every in-session screen wears: MCQs, the timed test,
 * flashcards, short questions and fill-in-the-blanks. Left is the way out
 * (close for a test, back for a chapter activity), the middle is the
 * progress, and the right is the screen's one piece of meta (a topic pill,
 * the exam timer).
 *
 * Progress is a row of segments, one per item, because "how many are left"
 * is the question a student mid-session actually has: a continuous bar
 * answers it vaguely, ten pieces answer it exactly. Past segments are
 * filled, the current one wears a ring, the rest wait. Screens that know
 * right from wrong can colour the past (practice); screens that must not
 * reveal it keep everything teal (the exam). Beyond 16 items the segments
 * would shrink into noise, so it falls back to the continuous bar.
 */
import Link from 'next/link';
import { IconButton } from '@/components/ui/controls';
import { Bar, Icon } from '@/components/ui/primitives';

const MAX_SEGMENTS = 16;

export type SegmentMark = 'ok' | 'bad' | 'done' | 'todo' | 'current';

export function SessionHeader({
  onClose,
  closeLabel,
  backHref,
  backLabel,
  pct,
  label,
  right,
  segments,
}: {
  /** Close control for a running test; wins over backHref if both given. */
  onClose?: () => void;
  closeLabel?: string;
  /** Back link for a chapter activity. */
  backHref?: string;
  backLabel?: string;
  pct: number;
  label: string;
  right?: React.ReactNode;
  /** One mark per item. Omit (or exceed 16) to keep the continuous bar. */
  segments?: SegmentMark[];
}) {
  const segmented = segments && segments.length > 1 && segments.length <= MAX_SEGMENTS;
  return (
    <div className="flex items-center gap-2.5 pt-1">
      {onClose ? (
        <IconButton icon="close" label={closeLabel ?? ''} tone="plain" onClick={onClose} />
      ) : backHref ? (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-ink2 transition-colors duration-200 hover:bg-paper hover:text-ink"
        >
          <Icon name="back" size={20} />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        {segmented ? (
          <div className="flex items-center gap-1" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            {segments.map((m, i) => (
              <span
                key={i}
                className={`h-[7px] flex-1 rounded-full transition-colors duration-300 ${
                  m === 'ok'
                    ? 'bg-green'
                    : m === 'bad'
                      ? 'bg-red'
                      : m === 'done'
                        ? 'bg-teal'
                        : m === 'current'
                          ? 'bg-card shadow-[inset_0_0_0_2px_var(--color-teal)]'
                          : 'bg-track'
                }`}
              />
            ))}
          </div>
        ) : (
          <Bar pct={pct} tone="teal" h={6} />
        )}
        <p className="mt-1 truncate text-[11.5px] font-extrabold text-ink2">{label}</p>
      </div>
      {right}
    </div>
  );
}
