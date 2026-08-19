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
import Link from 'next/link';

/** Whole rupees, grouped the way they are read in Pakistan. */
export const rupees = (n: number): string => `Rs ${Math.round(n).toLocaleString('en-PK')}`;

export function Stat({ value, label, tone }: { value: string; label: string; tone?: 'teal' | 'green' | 'orange' }) {
  const colour = tone === 'green' ? 'text-green' : tone === 'orange' ? 'text-orangedark' : tone === 'teal' ? 'text-teal' : 'text-ink';
  return (
    <div className="rounded-[16px] border border-line bg-card px-4 py-3.5">
      <p className={`font-display text-[24px] leading-tight ${colour}`}>{value}</p>
      <p className="mt-0.5 text-[12px] text-ink2">{label}</p>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
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

/** A table that scrolls inside its own box rather than pushing the page wide. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-start">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-start text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">
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

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-line px-4 py-3 text-[13px] text-ink ${className}`}>{children}</td>;
}

/** A table row cannot legally contain an anchor, so rows are not clickable and
 *  the link lives on the cell that names the thing. See `CellLink`. */
export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="transition-colors duration-200 hover:bg-paper">{children}</tr>;
}

export function CellLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-extrabold text-teal transition-colors duration-200 hover:brightness-90">
      {children}
    </Link>
  );
}

export function Tag({ tone, children }: { tone: 'green' | 'grey' | 'red' | 'orange'; children: React.ReactNode }) {
  const map = {
    green: 'bg-greentint text-green',
    grey: 'bg-grey text-ink2',
    red: 'bg-redtint text-red',
    orange: 'bg-orangetint text-orangedark',
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
