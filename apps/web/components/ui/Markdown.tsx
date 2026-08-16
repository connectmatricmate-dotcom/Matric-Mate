/**
 * Renders AI text as real typography instead of literal asterisks.
 *
 * The parser lives in @matricmate/core so the Android app draws the same
 * blocks from the same rules. Nothing here touches innerHTML: the parser
 * hands back data and this walks it, so model output can never inject
 * markup.
 *
 * Urdu-aware, like the rest of the app: a block written in Arabic script
 * gets the Nastaliq treatment and right-to-left flow, including its bullet
 * side, so an Urdu answer reads the way an Urdu answer should.
 */
import { type MdSpan, isUrduScript, parseMarkdown } from '@matricmate/core';
import { Ur } from './primitives';

function spanText(spans: MdSpan[]): string {
  return spans.map((s) => s.text).join('');
}

function Spans({ spans }: { spans: MdSpan[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.code ? (
          <code key={i} className="rounded bg-grey px-1 py-0.5 font-mono text-[0.92em] text-ink">
            {s.text}
          </code>
        ) : s.bold ? (
          <strong key={i} className="font-extrabold text-ink">
            {s.text}
          </strong>
        ) : s.italic ? (
          <em key={i}>{s.text}</em>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** One block, in the right script. */
function Block({ spans, className = '' }: { spans: MdSpan[]; className?: string }) {
  if (isUrduScript(spanText(spans))) {
    return (
      <Ur block className={className}>
        <Spans spans={spans} />
      </Ur>
    );
  }
  return <span className={`block ${className}`}>
    <Spans spans={spans} />
  </span>;
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Block
                key={i}
                spans={b.spans}
                className={
                  b.level === 1
                    ? 'font-display text-[16.5px] text-ink'
                    : b.level === 2
                      ? 'text-[13px] font-extrabold uppercase tracking-[0.07em] text-teal'
                      : 'text-[13.5px] font-extrabold text-ink'
                }
              />
            );
          case 'bullets':
            return (
              <ul key={i} className="flex flex-col gap-1.5">
                {b.items.map((item, j) => {
                  const rtl = isUrduScript(spanText(item));
                  return (
                    <li key={j} className={`flex items-start gap-2 ${rtl ? 'flex-row-reverse' : ''}`}>
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                      <Block spans={item} className="min-w-0 flex-1" />
                    </li>
                  );
                })}
              </ul>
            );
          case 'numbers':
            return (
              <ol key={i} className="flex flex-col gap-1.5">
                {b.items.map((item, j) => {
                  const rtl = isUrduScript(spanText(item));
                  return (
                    <li key={j} className={`flex items-start gap-2 ${rtl ? 'flex-row-reverse' : ''}`}>
                      <span className="mt-0.5 shrink-0 text-[12.5px] font-extrabold text-teal tabular">{b.start + j}.</span>
                      <Block spans={item} className="min-w-0 flex-1" />
                    </li>
                  );
                })}
              </ol>
            );
          case 'quote':
            return (
              <div
                key={i}
                className={
                  isUrduScript(spanText(b.spans))
                    ? 'border-r-[3px] border-tealtint2 pr-3'
                    : 'border-l-[3px] border-tealtint2 pl-3'
                }
              >
                <Block spans={b.spans} className="text-ink2" />
              </div>
            );
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-[10px] bg-grey p-3 font-mono text-[12.5px] text-ink">
                {b.text}
              </pre>
            );
          default:
            return <Block key={i} spans={b.spans} />;
        }
      })}
    </div>
  );
}
