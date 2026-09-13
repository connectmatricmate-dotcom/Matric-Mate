/**
 * A small markdown reader for AI text.
 *
 * Every prompt in this app asks the model for plain prose, and most of the
 * time it obliges. "Most of the time" is the problem: one reply in ten comes
 * back with `## KEY DEFINITIONS` or `**Newton's law**`, and a student then
 * reads the asterisks out loud. Cheat sheets made it worse, because they are
 * cached globally, so a single markdown-y generation was served to everyone
 * forever.
 *
 * So the apps stop trusting the prompt and start reading the text properly.
 * This turns AI output into blocks both platforms render natively: no
 * dependency, no HTML, no dangerouslySetInnerHTML, and nothing to sanitise,
 * because the output is data the renderers walk, never markup.
 *
 * Deliberately partial. It covers what the models actually emit in this app
 * (headings, bold, italics, bullet and numbered lists, inline code, fenced
 * blocks, blockquotes) and leaves out what they never do (tables, images,
 * reference links, HTML). Anything unrecognised stays literal text, which is
 * the safe direction to fail in.
 */

export type MdSpan = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export type MdBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: MdSpan[] }
  | { kind: 'para'; spans: MdSpan[] }
  | { kind: 'bullets'; items: MdSpan[][] }
  | { kind: 'numbers'; items: MdSpan[][]; start: number }
  | { kind: 'quote'; spans: MdSpan[] }
  | { kind: 'code'; text: string };

/**
 * House style, applied before parsing: the em dash is the tell the client
 * calls out, and models still slip one in against instructions. Used as a
 * pause between words it becomes a comma; anywhere else a plain hyphen.
 *
 * A range is not a pause. Three to five marks written with an en dash was
 * coming out as "3, 5 marks", a list where the model meant a span, so a dash
 * between two numbers, or an unspaced one inside a compound, becomes a hyphen
 * and keeps its meaning.
 */
function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/(\d)\s*[\u2013\u2014]\s*(?=\d)/g, '$1-')
    .replace(/(\w)\u2013(?=\w)/g, '$1-')
    .replace(/(\w)\s*[\u2013\u2014]\s*(\w)/g, '$1, $2')
    .replace(/[\u2013\u2014]/g, '-');
}

/** Inline pass: **bold**, *italic*, `code`, and __bold__ / _italic_. */
export function parseInline(text: string): MdSpan[] {
  const spans: MdSpan[] = [];
  // One regex, alternation ordered so the two-character fences win over the
  // single-character ones (** before *, __ before _).
  const re = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|(\*|_)(?=\S)([\s\S]*?\S)\3|`([^`\n]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) spans.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) spans.push({ text: m[4], italic: true });
    else if (m[5] !== undefined) spans.push({ text: m[5], code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text }];
}

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBER = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const FENCE = /^\s{0,3}(```|~~~)/;

/** Turn AI text into blocks. Never throws: worst case you get paragraphs. */
export function parseMarkdown(input: string): MdBlock[] {
  const lines = normalise(input ?? '').split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    // Joined on a line break, not a space. Standard markdown folds single
    // newlines away, but a model writes one on purpose ("Formula: W = mg"
    // then "W = weight (N), m = mass (kg)" on the next line), and folded they
    // ran together as "W = mg W = weight".
    blocks.push({ kind: 'para', spans: parseInline(para.join('\n').trim()) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      flushPara();
      continue;
    }

    if (FENCE.test(line)) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushPara();
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, spans: parseInline(heading[2].trim()) });
      continue;
    }

    if (BULLET.test(line)) {
      flushPara();
      const items: MdSpan[][] = [];
      while (i < lines.length) {
        const hit = BULLET.exec(lines[i]);
        if (!hit) break;
        items.push(parseInline(hit[1].trim()));
        i++;
      }
      i--;
      blocks.push({ kind: 'bullets', items });
      continue;
    }

    const numbered = NUMBER.exec(line);
    if (numbered) {
      flushPara();
      const items: MdSpan[][] = [];
      const start = Number(numbered[1]) || 1;
      while (i < lines.length) {
        const hit = NUMBER.exec(lines[i]);
        if (!hit) break;
        items.push(parseInline(hit[2].trim()));
        i++;
      }
      i--;
      blocks.push({ kind: 'numbers', items, start });
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      flushPara();
      blocks.push({ kind: 'quote', spans: parseInline(quote[1].trim()) });
      continue;
    }

    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

/**
 * True when the text carries markdown worth parsing. Lets a caller keep its
 * existing plain-text path (and its script switching) for the common case
 * and only reach for the block renderer when the model actually marked
 * something up.
 */
export function hasMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d{1,3}[.)]\s|>\s)|\*\*\S|__\S|`[^`\n]+`|```/.test(text ?? '');
}
