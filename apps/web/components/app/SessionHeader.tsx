'use client';

/**
 * The one header every in-session screen wears: MCQs, the timed test,
 * flashcards, short questions and fill-in-the-blanks. Left is the way out
 * (close for a test, back for a chapter activity), the middle is always the
 * same progress bar with a caption, and the right is the screen's one piece of
 * meta (a topic pill, the exam timer). Five screens used to draw five
 * different headers for the same moment: mid-task.
 */
import Link from 'next/link';
import { IconButton } from '@/components/ui/controls';
import { Bar, Icon } from '@/components/ui/primitives';

export function SessionHeader({
  onClose,
  closeLabel,
  backHref,
  backLabel,
  pct,
  label,
  right,
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
}) {
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
        <Bar pct={pct} tone="teal" h={6} />
        <p className="mt-1 truncate text-[11px] font-extrabold text-ink2">{label}</p>
      </div>
      {right}
    </div>
  );
}
