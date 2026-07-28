/**
 * Heading for a screen you arrived at from somewhere. The back control points at
 * a real parent route rather than browser history, so a deep link still has a
 * way up. Server-safe.
 */
import Link from 'next/link';
import { Icon } from '@/components/ui/primitives';

export function ScreenHeader({
  backHref,
  backLabel = 'Back',
  eyebrow,
  title,
  sub,
  right,
  urduTitle,
}: {
  backHref: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  urduTitle?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <Link
        href={backHref}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-2 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
      >
        <Icon name="chevron" size={18} className="rotate-180" />
        {backLabel}
      </Link>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-[12.5px] font-extrabold uppercase tracking-[0.07em] text-ink3">{eyebrow}</p> : null}
          <h1 className="font-display text-[25px] leading-tight text-ink">{title}</h1>
          {urduTitle}
          {sub ? <p className="mt-0.5 text-[13.5px] text-ink2">{sub}</p> : null}
        </div>
        {right}
      </div>
    </div>
  );
}
