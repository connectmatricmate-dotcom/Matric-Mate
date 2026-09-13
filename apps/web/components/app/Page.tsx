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
import { Ur } from '@/components/ui/primitives';
import { BackLink } from '@/components/app/BackLink';

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
  titleUrdu,
  subUrdu,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  back?: string;
  backLabel?: string;
  /** Renders the title through the Urdu treatment (Nastaliq, RTL). Pass it
   *  when the app language is Urdu and the Urdu name IS the title; the two
   *  language versions never stack. */
  titleUrdu?: boolean;
  /** Same for the sub line, for Urdu-script chapter blurbs. */
  subUrdu?: boolean;
}) {
  return (
    <header className="mb-5">
      {back ? (
        // no-print: the header itself prints (it is the report card's title),
        // a way back to the previous screen does not.
        <BackLink
          href={back}
          label={backLabel}
          className="no-print -ms-1 mb-1 inline-flex min-h-11 items-center gap-1 pe-2 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
        />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-0.5 text-[11.5px] font-extrabold uppercase tracking-[0.09em] text-ink3">{eyebrow}</p>
          ) : null}
          {titleUrdu ? (
            <h1>
              <Ur block className="text-[24px] leading-loose text-ink md:text-[27px]">{title}</Ur>
            </h1>
          ) : (
            <h1 className="font-display text-[26px] leading-[1.15] text-ink md:text-[30px] rtl:leading-[1.8]">{title}</h1>
          )}
          {sub ? (
            subUrdu ? (
              <p className="mt-1">
                <Ur block className="text-[14px] text-ink2">{sub}</Ur>
              </p>
            ) : (
              <p className="mt-1 text-[14px] text-ink2">{sub}</p>
            )
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * Work column + rail. Side by side from xl; below that the rail stacks under
 * the work. At lg the 236px sidebar and a 320px rail left the work column
 * about as wide as a phone screen, on a laptop.
 */
export function Split({ children }: { children: React.ReactNode }) {
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">{children}</div>;
}

/**
 * A size container, so what sits inside answers to the column's width rather
 * than the window's. The window says little once a sidebar and a rail have
 * taken their share of it.
 */
export function Work({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`@container min-w-0 ${className}`}>{children}</div>;
}

/** Sticky beside the work, and scrolls on its own when it is taller than the window. */
export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-[86px] xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain">
      {children}
    </aside>
  );
}

/**
 * The primary action row for a screen. Always in normal flow at the end of the
 * content: full-width buttons on a phone, regular-size aligned buttons on a
 * desktop. Nothing sticks or floats over the content.
 */
export function Actions({ children, align = 'end' }: { children: React.ReactNode; align?: 'start' | 'end' | 'full' }) {
  return (
    <div
      className={[
        'mt-6 flex gap-2.5',
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
 * Keyed on the Work column it sits in (@xl, 36rem), not the viewport, so two
 * columns only appear when each one has room.
 */
export function CardGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  /**
   * Cells stretch to the row: without it, two cards side by side ended at
   * whatever height their own text happened to reach, and settings read as
   * four cards of four heights instead of a grid.
   */
  return (
    <div className={`grid items-stretch gap-4 [&>*]:h-full ${cols === 3 ? 'lg:grid-cols-3' : '@xl:grid-cols-2'}`}>
      {children}
    </div>
  );
}
