/**
 * Rules every generated question is held to on its way into the database.
 *
 * Shared by generate-content.mjs, which applies them as it writes, and by the
 * scripts that repair what was written before the rules existed, so a
 * question written tomorrow and one repaired today come out the same way and
 * the two can never drift apart.
 *
 * WHY ANSWER PLACEMENT IS A RULE AND NOT A DETAIL
 *
 * The model puts the right answer first. Two thirds of 9,940 MCQs had it in
 * slot A and fewer than 2% in slot D, and neither app shuffles options, so a
 * student who always tapped A passed most chapters without reading a word.
 * Blanks were worse: the right chip came first 96% of the time. Placement is
 * therefore decided here, from the question's own id, never from the model.
 *
 * Deterministic on purpose, and even rather than merely random. A question's
 * id says which chapter it is in and which number it is there. Numbers run
 * in fours (1 to 4, 5 to 8, ...), and each four takes the slots A to D once
 * each, in an order drawn from the chapter and the four, so every chapter,
 * and so every subject, has its answers spread within a question or two of
 * evenly. The medium is left out of the draw, so a re-run lands every
 * question where it already is, and a one-language subject's English and
 * Urdu copies (the same question filed twice) come out identical.
 */

import { createHash } from 'node:crypto';

/* ------------------------------------------------------------ small pieces */

/** U+FFFD, what a decoder writes when it meets half a character. */
export const BROKEN = '\uFFFD';
export const hasBrokenChar = (value) => JSON.stringify(value ?? '').includes(BROKEN);

/** The same key for a row in either medium: `phy-3-en-4-q` and `phy-3-ur-4-q` share one. */
export const mediumFree = (id) => String(id).replace(/-(en|ur)-(?=\d+-(q|b)$)/, '-');

const digest = (key) => createHash('sha256').update(key).digest();

/** The 24 orders of four slots. */
const ORDERS = (() => {
  const out = [];
  const go = (done, rest) => (rest.length ? rest.forEach((x, i) => go([...done, x], [...rest.slice(0, i), ...rest.slice(i + 1)])) : out.push(done));
  go([], [0, 1, 2, 3]);
  return out;
})();

/**
 * The slot, 0 to 3, the right answer of this question belongs in. `kind` keeps
 * MCQs and blanks of the same chapter from sharing one pattern.
 */
export function answerSlot(id, kind = 'q') {
  const m = /^(.+)-(?:en|ur)-(\d+)-[a-z]+$/.exec(String(id));
  if (!m) return digest(`slot:${kind}:${id}`)[0] % 4;
  const n = Number(m[2]) - 1;
  const four = Math.floor(n / 4);
  return ORDERS[digest(`slot:${kind}:${m[1]}:${four}`).readUInt32BE(0) % ORDERS.length][n % 4];
}

/* ------------------------------------------------------------- em dashes */

const ARABIC_LETTER = /[\u0600-\u06FF]/;
const LATIN_LETTER = /[A-Za-z]/;

/** Mostly Urdu script, or mostly Latin? */
const urduLeaning = (text) => (String(text).match(/[\u0600-\u06FF]/g)?.length ?? 0) > (String(text).match(/[A-Za-z]/g)?.length ?? 0);

/**
 * The comma an em dash becomes, chosen by the words it sits between.
 *
 * It used to be chosen by the row's medium, which is right for most rows and
 * wrong for the ones that matter here: Urdu lessons filed under English
 * medium and English lessons filed under Urdu. Those got the Urdu comma "،"
 * in the middle of English sentences and the Latin "," inside Urdu ones. Now
 * the letters either side of the dash decide; where one side is Urdu and the
 * other English, the string as a whole does.
 */
function commaAt(text, at, length) {
  const before = [...text.slice(0, at)].reverse().find((ch) => ARABIC_LETTER.test(ch) || LATIN_LETTER.test(ch));
  const after = [...text.slice(at + length)].find((ch) => ARABIC_LETTER.test(ch) || LATIN_LETTER.test(ch));
  const side = (ch) => (ch === undefined ? null : ARABIC_LETTER.test(ch) ? 'ur' : 'en');
  const [a, b] = [side(before), side(after)];
  const urdu = a && a === b ? a === 'ur' : a && !b ? a === 'ur' : b && !a ? b === 'ur' : urduLeaning(text);
  return urdu ? '، ' : ', ';
}

/**
 * No em dash reaches a student: the repo's rule for every line of copy, and
 * the one the model breaks most. Dropped at the start or end of a string,
 * otherwise replaced with the comma the sentence almost always wanted.
 */
export function dashless(value) {
  if (typeof value === 'string') {
    const trimmed = value.replace(/^\s*\u2014\s*/, '').replace(/\s*\u2014\s*$/, '');
    return trimmed.replace(/\s*\u2014\s*/g, (m, at) => commaAt(trimmed, at, m.length));
  }
  if (Array.isArray(value)) return value.map(dashless);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dashless(v)]));
  return value;
}

/* ------------------------------------------------------------------ blanks */

/**
 * Fill-in-the-blank chips in an order that gives nothing away.
 *
 * The right chip goes to its slot by the same rule as an MCQ's right option;
 * the others fill the remaining places in an order drawn from each chip's own
 * text. Nothing depends on the order the chips arrived in, so running it
 * twice changes nothing.
 */
export function orderBlankOptions(id, options, answer) {
  if (!Array.isArray(options) || options.length < 2) return options;
  const key = mediumFree(id);
  const right = options.findIndex((o) => String(o).trim() === String(answer ?? '').trim());
  const rank = (o, i) => ({ o, i, h: digest(`blank:${key}:${String(o).trim()}`).readUInt32BE(0) });
  const others = options
    .map(rank)
    .filter((x) => x.i !== right)
    .sort((a, b) => a.h - b.h || a.i - b.i)
    .map((x) => x.o);
  if (right === -1) return options.map(rank).sort((a, b) => a.h - b.h || a.i - b.i).map((x) => x.o);
  const slot = answerSlot(id, 'b') % options.length;
  return [...others.slice(0, slot), options[right], ...others.slice(slot)];
}

/**
 * One gap per sentence.
 *
 * The model is asked for the sentence in two halves and often writes it whole
 * instead, with its own "____" where the answer goes. The apps draw the gap
 * between the halves, so a student then saw two: the model's inside the
 * sentence, and the real one after the full stop. The halves are rebuilt
 * around the model's gap. A run of underscores touching a letter is code
 * (`__init__`), not a gap, and is left alone; so is a sentence with more than
 * one gap, which cannot be split without guessing.
 */
const GAP = /(?<![\p{L}\p{N}_])_{2,}(?![\p{L}\p{N}_])/gu;
export function splitAtGap(before, after) {
  const b = String(before ?? '');
  const a = String(after ?? '');
  const gaps = [...b.matchAll(GAP)].length + [...a.matchAll(GAP)].length;
  if (gaps !== 1) return { before: b, after: a, changed: false };
  // Where the halves met is where the apps already draw a gap. The model's
  // own gap replaces it, so the two halves join back into one sentence.
  const joined = [b.trimEnd(), a.trimStart()].filter(Boolean).join(' ');
  const m = [...joined.matchAll(GAP)][0];
  return {
    before: joined.slice(0, m.index).trimEnd(),
    after: joined.slice(m.index + m[0].length).trimStart(),
    changed: true,
  };
}

/* -------------------------------------------------------------------- MCQs */

const LATIN = 'abcd';
const URDU_LETTERS = ['الف', 'ب', 'ج', 'د'];
const URDU_DIGITS = '۱۲۳۴';
const ORD_EN = ['first', 'second', 'third', 'fourth'];
const ORD_UR = ['پہل', 'دوسر', 'تیسر', 'چوتھ'];
const AR = '\\u0600-\\u06FF';

/** Options that name other options by position cannot move without lying. */
const POSITIONAL_OPTION = /\b(all|none|both|neither|either)\s+of\s+the\s+(above|below)\b|\bboth\s+\(\s*[a-d]\s*\)\s+and\s+\(\s*[a-d]\s*\)|مذکورہ\s*بالا|درج\s*بالا|اوپر\s+والے\s+(سب|تمام)/i;

/** What a label reads as when it starts a clause: "(c) is", "C wrongly", "(ب) غلط ہے". */
const VERB_EN = /^\s*(is|are|was|were|would|could|might|only|also|just|simply|actually|wrongly|mistakenly|incorrectly|merely|then|[a-z]+(?:s|ed))\b/i;
/**
 * Stricter, for a letter with no bracket or keyword at all: only a verb the
 * model actually uses of an option. "A saturated compound has" is an article,
 * "A is tempting" is an option.
 */
const VERB_BARE_EN = /^\s*(is|are|was|were|would|could|might|only|also|just|simply|actually|wrongly|mistakenly|incorrectly|merely|describes|confuses|reverses|refers|assumes|mixes|comes|results|forgets|ignores|swaps|shows|states|claims|contradicts|overstates|understates|lists|makes|drops|inverts|gives|omits|treats|suggests|applies|misses|predicts|places|skips|defines|repeats|adds|multiplies|divides|subtracts|doubles|keeps|fails|denies|flips|misplaces|invents|seems|sounds|tempts|mistakes|reuses|oversimplifies|overreaches|picks|limits|reduces|miscounts)\b/;
const VERB_UR = new RegExp(`^\\s*(غلط|درست|صحیح|دراصل|بھی|صرف|تو|میں|کا|کی|کے|سے|کو|نے|پر|وال[اےی]|دونوں|حقیقت|اس|یہ|وہ|ایک|عام|بالکل|بالترتیب)(?![${AR}])`);
const CLAUSE_START = new RegExp(`(^|[.;:!?،۔]\\s*|,\\s*|\\b(?:and|while|whereas|but)\\s+|(?:اور|جبکہ|مگر)\\s+)$`, 'i');
const RESPECTIVELY = /respectively|بالترتیب/i;

/** The slot a label names, and how to write another slot the same way. */
function labelInfo(atom) {
  const lower = atom.toLowerCase();
  if (atom.length === 1 && LATIN.includes(lower)) {
    const upper = atom !== lower;
    return { slot: LATIN.indexOf(lower), script: 'latin', write: (s) => (upper ? LATIN[s].toUpperCase() : LATIN[s]) };
  }
  if (URDU_LETTERS.includes(atom)) return { slot: URDU_LETTERS.indexOf(atom), script: 'urdu', write: (s) => URDU_LETTERS[s] };
  if (/^[1-4]$/.test(atom)) return { slot: Number(atom) - 1, script: 'digit', write: (s) => String(s + 1) };
  if (URDU_DIGITS.includes(atom)) return { slot: URDU_DIGITS.indexOf(atom), script: 'digit', write: (s) => URDU_DIGITS[s] };
  return null;
}

/**
 * Words that follow a bare lowercase "a" when it is an option label ("option
 * a is tempting", "option a wrongly adds"). Anything else after it, "a
 * student", "a common slip", means the "a" was an article.
 */
const LABEL_FOLLOWER = /^(is|was|are|were|and|or|would|could|might|may|can|also|only|just|actually|wrongly|mistakenly|simply|merely|incorrectly|correctly|instead|literally|alone|then|here|too|[a-z]+(?:s|ed|ly))\b/;

/**
 * Read one label starting at `p`: "c", "(c)", "C)", "'c'", "ب", "(ب)", "'ب'",
 * "3", optionally followed by a second spelling of the same slot in brackets,
 * "ج (C)". Returns null when what is there is a word, a formula or an article.
 */
function readLabel(text, p) {
  const m = new RegExp(`^(\\s*)(\\(\\s*|['‘"“])?(الف|ب|ج|د|[a-dA-D]|[1-4]|[۱-۴])(\\s*\\)|['’"”])?`).exec(text.slice(p));
  if (!m) return null;
  const [, lead, open, atom, close] = m;
  if (open && !close) return null; // "(a+b)" is algebra, "'a" is a word
  if (open && close && (open.trim() === '(') !== (close.trim() === ')')) return null;
  const info = labelInfo(atom);
  if (!info) return null;
  const atomStart = p + lead.length + (open?.length ?? 0);
  const end = p + m[0].length;
  const next = text.slice(end);
  const urdu = info.script === 'urdu';
  if (!close) {
    if (urdu ? new RegExp(`^[${AR}]`).test(next) : /^[\p{L}\p{N}]/u.test(next) || (/^['’]/.test(next) && !/^['’]s\b/.test(next))) return null;
    if (/^[-–]\s*[\p{L}\p{N}]/u.test(next) && !/^[-–]\s*\(?[a-dA-D]\)?(?![\p{L}\p{N}])/u.test(next)) return null; // "a-bi", "d-block"
    if (atom === 'a' && /^\s+[a-z]/.test(next) && !LABEL_FOLLOWER.test(next.trimStart())) return null;
    if (/^\.\d/.test(next)) return null; // "option 3.5"
  }
  const tokens = [{ start: atomStart, end: atomStart + atom.length, ...info }];
  let stop = end;
  // "آپشن ج (C)": the same option, spelled twice.
  const alt = /^\s*\(\s*([a-dA-D])\s*\)/.exec(text.slice(end));
  if (alt && urdu) {
    const s = end + alt[0].indexOf(alt[1]);
    tokens.push({ start: s, end: s + 1, ...labelInfo(alt[1]), alt: true });
    stop = end + alt[0].length;
  }
  return { tokens, end: stop, slot: info.slot, script: info.script };
}

const SEP = new RegExp(`^\\s*(?:,\\s*(?:and|or)\\s+|,|،|\\band\\b|\\bor\\b|اور(?![${AR}])|یا(?![${AR}])|\\/|&)\\s*`, 'i');
const RANGE = new RegExp(`^\\s*(?:-|–|\\bto\\b|تا(?![${AR}]))\\s*`, 'i');

/**
 * Is this Latin letter a quantity somewhere in the question: "F = ma", "the
 * nucleon number A", "Ampere (A)"? Then a bracketed or bare one in the
 * explanation might be the quantity rather than an option.
 */
function isQuantity(letter, texts) {
  const re = new RegExp(`(?<![A-Za-z])${letter}(?![A-Za-z])`, 'g');
  for (const t of texts) {
    for (const m of String(t).matchAll(re)) {
      const around = String(t).slice(Math.max(0, m.index - 3), m.index + 4);
      if (letter !== 'a' || /[=+\-−×*/^²³()0-9]/.test(around.replace(/^\(|\)$/g, ''))) {
        // An option label quoted as a label ("option (c)") is not a quantity.
        const before = String(t).slice(Math.max(0, m.index - 12), m.index);
        if (/(options?|choices?|آپشنز?|جز)\s*\(?\s*$/i.test(before)) continue;
        return true;
      }
    }
  }
  return false;
}

/**
 * Every place an explanation names an option by its position, in the ways
 * the model writes them:
 *
 *   after a keyword     option c · Options (b), (c) and (d) · آپشن (ب) · آپشن 'ب' · آپشن ج (C) · option 3
 *   by ordinal          the second option · دوسرا آپشن · آخری آپشن · the first two options
 *   in brackets alone   (ب) · (b) and (d) · Restarting the router (b) · صحیح جواب (a)
 *   continuing a list   "آپشن ب ... ہے، ج ... اور د ..." · "Option b ..., c ... and d ..."
 *   the others in turn  "the other three are X, Y and Z respectively" · "باقی تینوں بالترتیب ..."
 *
 * Anything that might be a label or might be a quantity (the nucleon number
 * (A), acceleration (a)) comes back marked `unsure`, never guessed at.
 */
export function findReferences(text, options = [], question = '') {
  const refs = [];
  const taken = [];
  const free = (s, e) => !taken.some(([a, b]) => s < b && e > a);
  const claim = (s, e) => taken.push([s, e]);
  const context = [question, ...options];

  // 1. Keyword, then one label, a list of them or a range.
  const KEY = new RegExp(`\\b(options?|choices?)\\b|(آپشنز|آپشن|جز)(?![${AR}])`, 'gi');
  for (const k of text.matchAll(KEY)) {
    let p = k.index + k[0].length;
    const colon = /^\s*:/.exec(text.slice(p));
    if (colon) p += colon[0].length;
    const first = readLabel(text, p);
    if (!first) continue;
    const group = { kind: 'list', labels: [first], start: first.tokens[0].start, end: first.end, keyed: true };
    let q = first.end;
    for (;;) {
      const r = RANGE.exec(text.slice(q));
      if (r) {
        const to = readLabel(text, q + r[0].length);
        if (to && to.script === first.script) {
          group.kind = 'range';
          group.labels.push(to);
          group.end = q = to.end;
          continue;
        }
      }
      const s = SEP.exec(text.slice(q));
      if (!s) break;
      const nxt = readLabel(text, q + s[0].length);
      if (!nxt || nxt.script !== first.script) break;
      group.labels.push(nxt);
      group.end = q = nxt.end;
    }
    if (!free(group.start, group.end)) continue;
    claim(group.start, group.end);
    refs.push(group);
  }
  const keyedScripts = new Set(refs.flatMap((r) => r.labels.map((l) => l.script)));

  // 1b. "(c) والا آپشن": the label before the keyword.
  for (const m of text.matchAll(new RegExp(`(\\(\\s*)?(?<![A-Za-z])([a-dA-D]|ب|ج|د)(\\s*\\))?\\s+وال[اےی]\\s+آپشن`, 'g'))) {
    const start = m.index + (m[1]?.length ?? 0);
    const end = start + m[2].length;
    if (!free(start, end)) continue;
    claim(start, end);
    const info = labelInfo(m[2]);
    refs.push({ kind: 'list', labels: [{ tokens: [{ start, end, ...info }], slot: info.slot, script: info.script }], start, end, keyed: true });
  }

  // 2. Ordinals.
  const ORDS = [
    { re: /\b(first|last)\s+(two|three)\s+(options|choices)\b/gi, set: true, en: true },
    { re: new RegExp(`(پہلے|آخری)\\s+(دو|تین)\\s+(آپشنز|آپشن)(?![${AR}])`, 'g'), set: true },
    { re: /\b(first|second|third|fourth|last)\s+(option|choice)\b/gi, en: true },
    { re: new RegExp(`(?<![${AR}])(پہلا|پہلے|پہلی|دوسرا|دوسرے|دوسری|تیسرا|تیسرے|تیسری|چوتھا|چوتھے|چوتھی|آخری)\\s+(آپشن|جواب)(?![${AR}])`, 'g') },
  ];
  for (const { re, set, en } of ORDS) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (!free(start, end)) continue;
      claim(start, end);
      const word = m[1];
      if (set) {
        const n = en ? (m[2].toLowerCase() === 'two' ? 2 : 3) : m[2] === 'دو' ? 2 : 3;
        const last = /^(last|آخری)$/i.test(word);
        refs.push({ kind: 'set', slots: Array.from({ length: n }, (_, i) => (last ? 4 - n + i : i)), start, end, phrase: m[0], en });
        continue;
      }
      const lower = word.toLowerCase();
      const slot = en ? (lower === 'last' ? 3 : ORD_EN.indexOf(lower)) : word === 'آخری' ? 3 : ORD_UR.findIndex((s) => word.startsWith(s));
      const cap = en && word[0] !== lower[0];
      const tail = text.slice(end);
      let ending = 'ا';
      if (!en && word !== 'آخری') ending = word.slice(-1);
      else if (!en && new RegExp(`^\\s*(میں|کا|کی|کے|کو|سے|پر|نے|وال[اےی])(?![${AR}])`).test(tail)) ending = 'ے';
      const write = en ? (s) => (cap ? ORD_EN[s][0].toUpperCase() + ORD_EN[s].slice(1) : ORD_EN[s]) : (s) => ORD_UR[s] + ending;
      refs.push({ kind: 'list', labels: [{ tokens: [{ start, end: start + word.length, slot, write }], slot, script: 'ordinal' }], start, end, keyed: true });
    }
  }

  // 3. Bracketed labels with no keyword before them, alone or in a run.
  const BRACKET = new RegExp(`(?<![\\p{L}\\p{N}_)\\]])\\(\\s*(الف|ب|ج|د|[a-dA-D])\\s*\\)`, 'gu');
  const found = [...text.matchAll(BRACKET)].filter((m) => free(m.index, m.index + m[0].length));
  for (let i = 0; i < found.length; i++) {
    const run = [i];
    for (let j = i + 1; j < found.length; j++) {
      const prev = found[run.at(-1)];
      const gap = text.slice(prev.index + prev[0].length, found[j].index);
      if (new RegExp(`^\\s*(?:,\\s*(?:and|or)\\s+|,|،|\\band\\b|\\bor\\b|اور|یا|\\/|&|-|–|\\bto\\b|تا)\\s*$`, 'i').test(gap)) run.push(j);
      else break;
    }
    const labels = run.map((j) => {
      const x = found[j];
      const atomStart = x.index + x[0].indexOf(x[1]);
      const info = labelInfo(x[1]);
      return { tokens: [{ start: atomStart, end: atomStart + x[1].length, ...info }], slot: info.slot, script: info.script, end: x.index + x[0].length };
    });
    const m = found[i];
    i = run.at(-1);
    const start = labels[0].tokens[0].start;
    const end = labels.at(-1).end;
    const isRange =
      run.length === 2 && /^\s*(?:-|–|\bto\b|تا)\s*$/i.test(text.slice(found[run[0]].index + found[run[0]][0].length, found[run[1]].index));
    const urdu = labels[0].script === 'urdu';
    const before = text.slice(Math.max(0, m.index - 90), m.index);
    const after = text.slice(end, end + 30);
    // Symbols in brackets beside it, "(Z)", "(N)", "(v)", mean this one is a symbol too.
    const symbols = !urdu && /\(\s*[E-Ze-z]\s*\)/.test(text);
    const quantity = !urdu && (symbols || labels.some((l) => isQuantity(text.slice(l.tokens[0].start, l.tokens[0].end), context)));
    const sure =
      urdu ||
      (!quantity &&
        (run.length > 1 ||
          /(answer|جواب)\s*(is\s*|ہے\s*)?$/i.test(before) ||
          echoesOption(before, options[labels[0].slot]) ||
          (CLAUSE_START.test(before) && (VERB_EN.test(after) || VERB_UR.test(after)))));
    claim(start, end);
    refs.push({ kind: isRange ? 'range' : 'list', labels, start, end, unsure: !sure });
  }

  // 4. A list carried on without its keyword: "آپشن ب ...، ج ... اور د ...".
  const BARE = new RegExp(`(?<![${AR}\\p{L}\\p{N}'’°(\\-])(ب|ج|د|[a-dA-D])(?![${AR}\\p{L}\\p{N}'’)\\-])`, 'gu');
  for (const m of text.matchAll(BARE)) {
    const start = m.index;
    const end = start + m[1].length;
    if (!free(start, end)) continue;
    const info = labelInfo(m[1]);
    const before = text.slice(Math.max(0, start - 40), start);
    const after = text.slice(end, end + 30);
    if (!CLAUSE_START.test(before)) continue;
    if (!(info.script === 'urdu' ? VERB_UR.test(after) || SEP.test(after) : VERB_BARE_EN.test(after))) continue;
    if (info.script === 'latin' && m[1] === 'a') continue; // the article, at the start of a clause
    // Only once the explanation has shown it labels options this way.
    const keyed = keyedScripts.has(info.script);
    if (info.script === 'latin' && !keyed && m[1] === m[1].toLowerCase()) continue; // "c is the speed of light"
    const quantity = info.script === 'latin' && isQuantity(m[1], context);
    claim(start, end);
    refs.push({ kind: 'list', labels: [{ tokens: [{ start, end, ...info }], slot: info.slot, script: info.script }], start, end, unsure: !keyed || quantity, bare: true });
  }

  // 5. "The other three are X, Y and Z respectively": the rest, in order.
  for (const m of text.matchAll(/(باقی|بقیہ|دیگر)\s*(تینوں|تین|آپشنز|آپشن|اختیارات|جوابات|کتابیں)?[^۔.]{0,50}بالترتیب|\b(the\s+)?(other|remaining|rest)\b[^.]{0,60}\brespectively\b/gi)) {
    refs.push({ kind: 'others', start: m.index, end: m.index + m[0].length, phrase: m[0] });
  }

  return refs.sort((a, b) => a.start - b.start);
}

/** Does the text just before a bracket repeat the option it would label? */
function echoesOption(before, option) {
  if (!option) return false;
  const norm = (s) => String(s).toLowerCase().replace(/['"‘’“”]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const opt = norm(option);
  const words = norm(before).split(' ').filter(Boolean);
  for (let k = Math.min(5, words.length); k >= 2; k--) {
    const tail = words.slice(-k).join(' ');
    if (tail.length >= 5 && opt.includes(tail)) return true;
  }
  // One word is only an echo when it is how the option starts, or nearly all
  // of it: "Sucrose (b)" echoes "Sucrose", "top number (A)" does not echo
  // "235 is the nucleon (mass) number".
  const last = words.at(-1) ?? '';
  return last.length >= 4 && (opt.startsWith(last) || (opt.split(' ').length <= 3 && opt.includes(last)));
}

/** Options quoted in the explanation's own language, for a reference no single letter can carry. */
function quoted(options, slots, urdu) {
  const parts = slots.map((s) => `'${String(options[s]).trim().replace(/[.۔]$/, '')}'`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(urdu ? '، ' : ', ')}${urdu ? ' اور ' : ' and '}${parts.at(-1)}`;
}

/**
 * Rewrite an explanation for options that have moved. `perm[old] = new`.
 *
 * A reference to a moved option gets the new letter, number or ordinal in the
 * spelling it had ("(c)" stays bracketed, "ج" stays Urdu). A set or range that
 * no longer names the same options becomes those options quoted in full.
 * What cannot be settled, a bracketed letter that may be a quantity, or "the
 * others, respectively" once the others are in a new order, comes back in
 * `unsure` and the text is returned untouched. `labels` settles the first
 * kind: true reads every unsure letter as an option, false as a quantity.
 */
export function remapExplanation(text, perm, options, question = '', labels = null) {
  const urdu = (text.match(/[\u0600-\u06FF]/g)?.length ?? 0) > (text.match(/[A-Za-z]/g)?.length ?? 0);
  const refs = findReferences(text, options, question);
  const moved = (s) => perm[s] !== s;
  const edits = [];
  const unsure = [];
  const rewritten = [];
  for (const ref of refs) {
    if (ref.kind === 'others') {
      // The wrong options in the order a student met them, and in the order
      // they meet them now. "Respectively" only survives if those agree.
      const was = [0, 1, 2, 3].filter((s) => s !== perm.answerFrom);
      const now = [0, 1, 2, 3].map((to) => perm.indexOf(to)).filter((s) => s !== perm.answerFrom);
      if (was.join() !== now.join()) unsure.push({ at: ref.start, why: 'others in turn', snippet: ref.phrase });
      continue;
    }
    if (ref.kind === 'set') {
      const now = new Set(ref.slots.map((s) => perm[s]));
      if (ref.slots.every((s) => now.has(s))) continue;
      edits.push({ start: ref.start, end: ref.end, text: `${urdu ? 'آپشن' : 'options'} ${quoted(options, ref.slots, urdu)}` });
      rewritten.push(ref.phrase);
      continue;
    }
    const slots = ref.labels.map((l) => l.slot);
    if (!slots.some(moved)) continue;
    if (ref.unsure) {
      if (labels === false) continue;
      if (labels !== true) {
        unsure.push({ at: ref.start, why: 'label or quantity', snippet: text.slice(Math.max(0, ref.start - 40), ref.end + 30) });
        continue;
      }
    }
    if (ref.kind === 'range') {
      const [lo, hi] = [slots[0], slots.at(-1)].sort((a, b) => a - b);
      const inside = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      const now = new Set(inside.map((s) => perm[s]));
      if (inside.every((s) => now.has(s))) continue;
      const first = ref.labels[0].tokens[0];
      const start = text[first.start - 1] === '(' ? first.start - 1 : first.start;
      edits.push({ start, end: ref.end, text: quoted(options, inside, urdu) });
      rewritten.push(text.slice(start, ref.end));
      continue;
    }
    // A list: move each label; put a plain list back in order, "(a), (b) and
    // (d)" rather than "(b), (a) and (d)", unless the sentence pairs them off
    // "respectively", where the order is the meaning.
    const targets = ref.labels.map((l) => perm[l.slot]);
    const sortable = ref.labels.length > 1 && !RESPECTIVELY.test(text);
    const order = sortable ? [...targets].sort((a, b) => a - b) : targets;
    ref.labels.forEach((l, i) => {
      for (const t of l.tokens) edits.push({ start: t.start, end: t.end, text: t.write(order[i]) });
    });
  }
  if (unsure.length) return { text, unsure, rewritten };
  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { text: out, unsure, rewritten };
}

/**
 * Put one MCQ's right answer in its slot and keep its explanation honest.
 *
 * The right option trades places with whatever holds its slot; the other two
 * stay put, so as little of the explanation as possible has to change. When
 * the explanation names a moved option in a way that cannot be settled, the
 * question is left exactly as it was and the reason comes back in `held`,
 * unless `settle` says how: true or false for unsure letters (see
 * remapExplanation), or { explanation, to }, a whole explanation written by
 * hand for the answer landing in slot `to`, used only if that is where it lands.
 */
export function placeAnswer(mcq, id, settle = null) {
  const options = [...mcq.options];
  const from = mcq.answer;
  if (!Number.isInteger(from) || options.length !== 4) return { ...mcq, held: 'not a four-option question' };
  if (options.some((o) => POSITIONAL_OPTION.test(String(o)))) return { ...mcq, held: 'an option names other options by position' };
  const to = answerSlot(id);
  if (from === to) return { ...mcq, moved: false };
  const perm = [0, 1, 2, 3];
  perm[from] = to;
  perm[to] = from;
  perm.answerFrom = from;
  [options[from], options[to]] = [options[to], options[from]];
  if (settle && typeof settle === 'object') {
    if (settle.to === to) return { ...mcq, options, answer: to, explanation: settle.explanation, moved: true, rewritten: ['whole explanation'] };
    settle = null; // written for a different slot, so it says nothing about this one
  }
  const r = remapExplanation(String(mcq.explanation ?? ''), perm, mcq.options, mcq.q, settle);
  if (r.unsure.length) return { ...mcq, held: 'explanation names a moved option ambiguously', unsure: r.unsure };
  return { ...mcq, options, answer: to, explanation: r.text, moved: true, rewritten: r.rewritten };
}
