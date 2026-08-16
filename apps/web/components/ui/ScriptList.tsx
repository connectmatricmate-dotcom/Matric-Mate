/**
 * Bulleted and numbered lists of plain content strings.
 *
 * These lists carry database rows and AI output, so any line can arrive in
 * Urdu. A marker typed straight into the text ("• {p}", "{i + 1}. {a}") lands
 * on the left of a right-to-left line, which reads as the marker belonging to
 * the line above. So the marker is its own element and the row flips, exactly
 * how Markdown.tsx handles its bullets and numbers blocks.
 */
import { isUrduScript } from '@matricmate/core';
import { ScriptText } from './primitives';

function Row({
  marker,
  text,
  className,
  urduClassName,
}: {
  marker: string;
  text: string;
  className: string;
  urduClassName?: string;
}) {
  const rtl = isUrduScript(text);
  return (
    <li className={`flex items-baseline gap-2 ${rtl ? 'flex-row-reverse' : ''}`}>
      <span aria-hidden className={`shrink-0 ${className}`}>
        {marker}
      </span>
      <ScriptText text={text} className={`min-w-0 flex-1 ${className}`} urduClassName={`min-w-0 flex-1 ${urduClassName ?? className}`} />
    </li>
  );
}

export function ScriptBullets({
  items,
  className = '',
  urduClassName,
  listClassName = 'mt-1 flex flex-col gap-1',
}: {
  items: string[];
  className?: string;
  /** Classes for the Urdu case; defaults to className, as in ScriptText. */
  urduClassName?: string;
  listClassName?: string;
}) {
  return (
    <ul className={listClassName}>
      {items.map((p, i) => (
        <Row key={i} marker="•" text={p} className={className} urduClassName={urduClassName} />
      ))}
    </ul>
  );
}

export function ScriptNumbers({
  items,
  className = '',
  urduClassName,
  listClassName = 'mt-1 flex flex-col gap-1',
  markerClassName,
}: {
  items: string[];
  className?: string;
  urduClassName?: string;
  listClassName?: string;
  /** The number often wants its own weight or colour, as in the coach card. */
  markerClassName?: string;
}) {
  return (
    <ol className={listClassName}>
      {items.map((a, i) => {
        const rtl = isUrduScript(a);
        return (
          <li key={i} className={`flex items-baseline gap-2 ${rtl ? 'flex-row-reverse' : ''}`}>
            <span aria-hidden className={`shrink-0 tabular-nums ${markerClassName ?? className}`}>
              {i + 1}.
            </span>
            <ScriptText
              text={a}
              className={`min-w-0 flex-1 ${className}`}
              urduClassName={`min-w-0 flex-1 ${urduClassName ?? className}`}
            />
          </li>
        );
      })}
    </ol>
  );
}
