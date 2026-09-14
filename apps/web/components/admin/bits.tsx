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
 * A table that scrolls inside its own box rather than pushing the page wide.
 * Headings never wrap, so the table grows past its minimum and scrolls
 * instead of stacking "Paid out" on two lines.
 */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-start">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2.5 text-start text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">
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

/** `num` for money, counts and dates: one line, figures in even columns. */
export function Td({ children, className = '', num }: { children: React.ReactNode; className?: string; num?: boolean }) {
  return (
    <td className={`border-b border-line px-4 py-3 text-[13px] text-ink ${num ? 'whitespace-nowrap tabular' : ''} ${className}`}>
      {children}
    </td>
  );
}

/** A table row cannot legally contain an anchor, so rows are not clickable and
 *  the link lives on the cell that names the thing. See `CellLink`. */
export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="transition-colors duration-200 hover:bg-paper">{children}</tr>;
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

export function CellLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-extrabold text-teal transition-colors duration-200 hover:brightness-90">
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
