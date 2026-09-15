/**
 * The handful of shapes the admin and affiliate panels are built from.
 *
 * Their own file rather than additions to `components/ui`, for two reasons.
 * These are staff screens, not the product: they can be plainer than anything
 * a student sees, and nothing here should become a thing somebody reaches for
 * on a student screen by accident. And the shared kit is being edited by
 * another pass at the moment, so adding to it would be a merge argument for no
 * gain.
 *
 * Copy is English only, deliberately. Both panels are read by Adnan and by
 * teachers, in a business context that is conducted in English, and running
 * staff tooling through the student string table would double the translation
 * work every time a label changed.
 */
import { Children } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/primitives';

/** Whole rupees, grouped the way they are read in Pakistan. */
export const rupees = (n: number): string => `Rs ${Math.round(n).toLocaleString('en-PK')}`;

export function Stat({ value, label, tone }: { value: string; label: string; tone?: 'teal' | 'green' | 'orange' }) {
  const colour = tone === 'green' ? 'text-green' : tone === 'orange' ? 'text-orangedark' : tone === 'teal' ? 'text-teal' : 'text-ink';
  // One line, always: "Rs" wrapping away from its number read as two values.
  // Sized to the card rather than the screen, since the same card is 130px
  // wide on a phone and in a row of four beside the sidebar, and 200px
  // between those.
  return (
    <div className="@container rounded-[16px] border border-line bg-card px-4 py-3.5">
      <p className={`whitespace-nowrap font-display text-[20px] leading-tight tabular @min-[9.5rem]:text-[24px] ${colour}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-ink2">{label}</p>
    </div>
  );
}

/**
 * Columns on a wide screen, by how many stats there are, so a row is never
 * left half empty. Five only from xl: beside the sidebar at lg, a fifth of the
 * row is too narrow for a rupee total.
 */
const WIDE: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-3 xl:grid-cols-5',
};

/**
 * Two to a row below lg, and an odd one out spans both rather than leaving a
 * gap beside it. Four across only from lg: at md the sidebar is already
 * showing, and a quarter of what is left is about 108px.
 */
export function StatGrid({ children }: { children: React.ReactNode }) {
  const wide = WIDE[Children.count(children)] ?? 'lg:grid-cols-4';
  return (
    <div
      className={`grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1 ${wide}`}
    >
      {children}
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-2.5 flex items-end justify-between gap-4">
        <h2 className="font-display text-[17px] text-ink">{title}</h2>
        {action}
      </div>
      <div className="overflow-hidden rounded-[16px] border border-line bg-card">{children}</div>
    </section>
  );
}

/**
 * On a phone, a `stack` table stops being a table: each row becomes a card,
 * two columns of labelled values, with the cells marked `span` (the name, the
 * buttons) across the full width. Scrolling a wide table sideways hid exactly
 * the columns Adnan and the teachers came for, the plan buttons, Outstanding,
 * WhatsApp, off the right edge of the screen with nothing to say they were
 * there. Styled from the table itself, so a row and a cell need no variant of
 * their own; the labels come from each cell's `label`.
 */
const STACK = [
  'max-md:block',
  'max-md:[&_thead]:hidden',
  'max-md:[&_tbody]:block',
  'max-md:[&_tr]:grid max-md:[&_tr]:grid-cols-2 max-md:[&_tr]:gap-x-4 max-md:[&_tr]:gap-y-3',
  'max-md:[&_tr]:border-b max-md:[&_tr]:border-line max-md:[&_tr]:px-4 max-md:[&_tr]:py-4 max-md:[&_tr:last-child]:border-b-0',
  'max-md:[&_td]:block max-md:[&_td]:min-w-0 max-md:[&_td]:border-0 max-md:[&_td]:p-0',
  'max-md:[&_td[data-span]]:col-span-2 max-md:[&_td[data-span]]:text-start',
  // A cell with nothing in it is a column on a wide screen and a gap on a card.
  'max-md:[&_td:empty]:hidden',
].join(' ');

/**
 * A table that scrolls inside its own box rather than pushing the page wide.
 * Headings never wrap, so the table grows past its minimum and scrolls
 * instead of stacking "Paid out" on two lines. `stack`: cards on a phone, see
 * STACK.
 */
export function Table({ head, children, stack }: { head: string[]; children: React.ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? 'md:overflow-x-auto' : 'overflow-x-auto'}>
      <table className={`w-full border-collapse text-start ${stack ? `md:min-w-[640px] ${STACK}` : 'min-w-[640px]'}`}>
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={`${h}-${i}`} className="whitespace-nowrap px-4 py-2.5 text-start text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * `num` for money, counts and dates: one line, figures in even columns.
 * In a `stack` table on a phone, `label` names the value above it and `span`
 * takes the card's full width.
 */
export function Td({
  children,
  className = '',
  num,
  label,
  span,
}: {
  children: React.ReactNode;
  className?: string;
  num?: boolean;
  label?: string;
  span?: boolean;
}) {
  return (
    <td
      data-span={span ? '' : undefined}
      className={`border-b border-line px-4 py-3 text-[13px] text-ink ${num ? 'whitespace-nowrap tabular' : ''} ${className}`}
    >
      {label ? <span className="mb-0.5 block text-[11.5px] font-extrabold text-ink3 md:hidden">{label}</span> : null}
      {children}
    </td>
  );
}

/** A row that goes nowhere. A row that opens something is a `TapRow`
 *  (components/staff/TapRow), with a `ViewLink` in it. */
export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="transition-colors duration-200 hover:bg-paper">{children}</tr>;
}

/**
 * The button on a row that says where the row goes: "View report", "View
 * student". The row itself is tappable too, but a teacher on a phone does not
 * know that until told, and this is the telling. A real link, so it opens in
 * a new tab, and a keyboard or a screen reader finds it. Full width at the
 * foot of a card on a phone.
 */
export function ViewLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-teal bg-card ps-3.5 pe-2.5 text-[12.5px] font-extrabold text-teal transition-colors duration-200 hover:bg-tealtint max-md:w-full md:h-10"
    >
      {children}
      <Icon name="chevron" size={16} strokeWidth={2.4} />
    </Link>
  );
}

/**
 * The way back to a list, as PageHead draws it: a chevron and a 44px target.
 * A bare 13px word was about 20px tall. no-print, like PageHead's.
 */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="no-print -ms-1 mb-1 inline-flex min-h-11 items-center gap-1 pe-2 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
    >
      <Icon name="chevron" size={17} className="rotate-180" />
      {children}
    </Link>
  );
}

/**
 * The name at the head of a tappable row: a link with a mouse, where the eye
 * expects one, and plain text on a phone card, where the whole card and its
 * View button are the targets and an 18px link inside it is only something to
 * miss.
 */
export function RowName({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <>
      <Link href={href} className="font-extrabold text-teal transition-colors duration-200 hover:brightness-90 max-md:hidden">
        {children}
      </Link>
      <span className="block font-extrabold text-ink md:hidden">{children}</span>
    </>
  );
}

export function CellLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-extrabold text-teal transition-colors duration-200 hover:brightness-90">
      {children}
    </Link>
  );
}

/** A secondary action shaped like a button, for next to one: a full 44px target where a text link would be 20. */
export function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-card px-3 text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:border-teal hover:text-teal md:h-10"
    >
      {children}
    </Link>
  );
}

export function Tag({ tone, children }: { tone: 'green' | 'grey' | 'red' | 'orange' | 'teal'; children: React.ReactNode }) {
  const map = {
    green: 'bg-greentint text-green',
    grey: 'bg-grey text-ink2',
    red: 'bg-redtint text-red',
    orange: 'bg-orangetint text-orangedark',
    teal: 'bg-tealtint text-teal',
  } as const;
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${map[tone]}`}>{children}</span>;
}

export function Note({ tone = 'grey', children }: { tone?: 'grey' | 'green' | 'red'; children: React.ReactNode }) {
  const map = {
    grey: 'border-line bg-card text-ink2',
    green: 'border-green bg-greentint text-ink',
    red: 'border-red bg-redtint text-ink',
  } as const;
  return <p className={`rounded-[12px] border px-3.5 py-2.5 text-[13px] ${map[tone]}`}>{children}</p>;
}
