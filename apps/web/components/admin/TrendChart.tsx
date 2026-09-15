import { rupees } from '@/components/admin/bits';

/**
 * Fourteen days of one number, as bars.
 *
 * Hand-rolled rather than a charting library: this is nine elements and a
 * maximum, and pulling a bundle into an admin page to draw it would cost more
 * than the page itself. Tokens only, so it follows dark mode like everything
 * else.
 *
 * A server component on purpose. There is no hover, no tooltip and no state,
 * so nothing here needs to reach the browser as JavaScript. The title on each
 * bar gives the exact figure to a mouse; a finger has no hover, so the best
 * day is also written out under the bars, and a screen reader gets every day
 * as a list.
 */

export type TrendPoint = { day: string; value: number };

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function TrendChart({
  title,
  points,
  tone = 'teal',
  money = false,
}: {
  title: string;
  points: TrendPoint[];
  tone?: 'teal' | 'green' | 'orange';
  money?: boolean;
}) {
  const total = points.reduce((n, p) => n + p.value, 0);
  const peak = Math.max(1, ...points.map((p) => p.value));
  const best = points.reduce<TrendPoint | null>((b, p) => (p.value > (b?.value ?? 0) ? p : b), null);
  const fill = tone === 'green' ? 'bg-green' : tone === 'orange' ? 'bg-orange' : 'bg-teal';
  const format = (n: number) => (money ? rupees(n) : n.toLocaleString('en-PK'));

  return (
    <section className="rounded-[16px] border border-line bg-card px-4 py-4">
      {/* Wraps rather than overflowing: in a narrow card the title and the
          total together are wider than the card. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="min-w-0 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">{title}</h2>
        <p className="whitespace-nowrap font-display text-[19px] text-ink tabular">{format(total)}</p>
      </div>

      {/* Fixed height, bars measured against the tallest day. An empty stretch
          still draws its baseline, so "nothing happened" reads as a flat run
          rather than a broken chart. */}
      <div className="mt-3 flex h-[92px] items-end gap-[3px]" aria-hidden>
        {points.map((p) => {
          const pct = Math.round((p.value / peak) * 100);
          return (
            <div key={p.day} className="flex h-full flex-1 flex-col justify-end" title={`${dayLabel(p.day)}: ${format(p.value)}`}>
              <div
                className={`w-full rounded-t-[3px] ${p.value ? fill : 'bg-line'}`}
                style={{ height: p.value ? `${Math.max(pct, 4)}%` : '2px' }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-ink3" aria-hidden>
        <span>{points.length ? dayLabel(points[0].day) : ''}</span>
        <span>{points.length ? dayLabel(points[points.length - 1].day) : ''}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-ink2">
        {best ? `Best day ${dayLabel(best.day)} · ${format(best.value)}` : 'Nothing in these days yet'}
      </p>
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.day}>{`${dayLabel(p.day)}: ${format(p.value)}`}</li>
        ))}
      </ul>
    </section>
  );
}
