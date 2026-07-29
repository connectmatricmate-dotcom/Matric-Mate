/**
 * Page layout primitives, "the desk".
 *
 * A student at a laptop has a work surface and a margin for things they glance
 * at: the plan, the streak, how sure they've been. Desktop screens are a work
 * column plus a 320px rail; on a phone the rail simply stacks underneath. That
 * is the whole system, and it is why nothing here is a phone column stretched
 * across 1360px.
 *
 * Three widths, named after the job, never an ad-hoc pixel value in a screen:
 *   page   index screens that earn a rail
 *   focus  one task at a time (a question, a form, a checkout)
 *   read   prose
 *
 * Server-safe: no hooks, no handlers.
 */
import Link from 'next/link';
import { Icon } from '@/components/ui/primitives';

const WIDTH = {
  page: 'max-w-[1180px]',
  focus: 'max-w-[820px]',
  read: 'max-w-[760px]',
} as const;

export function Page({
  width = 'page',
  children,
  className = '',
}: {
  width?: keyof typeof WIDTH;
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full ${WIDTH[width]} ${className}`}>{children}</div>;
}

/**
 * One heading treatment for every screen. `back` turns it into a sub-page
 * header; `actions` sits on the same line at desktop and wraps under on a phone.
 */
export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
  back,
  backLabel,
  urduTitle,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  back?: string;
  backLabel?: string;
  urduTitle?: React.ReactNode;
}) {
  return (
    <header className="mb-5">
      {back ? (
        <Link
          href={back}
          className="-ml-1 mb-1 inline-flex min-h-9 items-center gap-1 pr-2 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
        >
          <Icon name="chevron" size={17} className="rotate-180" />
          {backLabel ?? 'Back'}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-0.5 text-[11.5px] font-extrabold uppercase tracking-[0.09em] text-ink3">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-[26px] leading-[1.15] text-ink md:text-[30px]">{title}</h1>
          {urduTitle}
          {sub ? <p className="mt-1 text-[14px] text-ink2">{sub}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Work column + rail. The rail follows the page on desktop and stacks on a phone. */
export function Split({ children }: { children: React.ReactNode }) {
  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">{children}</div>;
}

export function Work({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-w-0 ${className}`}>{children}</div>;
}

export function Rail({ children }: { children: React.ReactNode }) {
  return <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[86px]">{children}</aside>;
}

/**
 * The primary action for a screen. On a phone it docks to the bottom, where a
 * thumb is; on a desktop it sits inline under the content, where the eye already
 * is. Same component, so no screen has to remember the rule.
 */
export function Actions({ children, align = 'end' }: { children: React.ReactNode; align?: 'start' | 'end' | 'full' }) {
  return (
    <div
      className={[
        'sticky bottom-0 z-10 -mx-4 mt-6 flex gap-2.5 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur',
        'md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-filter-none',
        align === 'full' ? '' : align === 'start' ? 'md:justify-start' : 'md:justify-end',
        '[&>*]:flex-1 md:[&>*]:flex-none',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/**
 * Settings-style rows read badly when a toggle floats half a metre from its
 * label. Two columns on desktop keeps every row near its natural reading width.
 */
export function CardGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  /**
   * Cells stretch to the row: without it, two cards side by side ended at
   * whatever height their own text happened to reach, and settings read as
   * four cards of four heights instead of a grid.
   */
  return (
    <div className={`grid items-stretch gap-4 [&>*]:h-full ${cols === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
      {children}
    </div>
  );
}
