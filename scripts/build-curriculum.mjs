#!/usr/bin/env node
/**
 * Turn the extracted FBISE text into structured curriculum JSON.
 *
 *   node scripts/build-curriculum.mjs          all subjects
 *   node scripts/build-curriculum.mjs phy      one subject, prints a sample
 *
 * Input:  content/fbise/text/framework-<subject>.txt   (gitignored, re-fetchable)
 * Output: data/fbise/<subject>.json                     (committed, small, ours)
 *
 * WHY THE FRAMEWORK AND NOT THE CURRICULUM PDF
 *
 * There are two FBISE documents per subject and they disagree. The curriculum
 * PDFs under notifications/ssc/ are the 2006 national curriculum, organised into
 * numbered units. The Assessment Frameworks are built on the National Curriculum
 * of Pakistan 2022-23, organised into lettered domains, and they are what the
 * board's own notification says the paper is now set from. So the framework
 * wins. It also carries two things the curriculum does not:
 *
 *   * formative vs summative, which is literally "will this be on the exam"
 *   * a cognitive level per outcome (Knowledge / Understanding / Application),
 *     which is what makes a generated question the right kind of question
 *
 * HOW THE PARSE WORKS
 *
 * pdftotext -layout keeps the table geometry, so every row arrives as one line
 * with its columns separated by runs of two or more spaces. Splitting on that
 * run gives real cells, which beats trying to regex prose out of a flattened
 * page. Two table shapes exist across the nine subjects and both fall out of the
 * same rule:
 *
 *   Physics  [SLO: P-09-A-05] text…      | Summative | Understanding | Remarks
 *   Chemistry  A | Nature of Science | SLO: C-09-A-01 | text… | Knowledge | …
 *
 * Grade is read from the code itself, so the English framework's Class 10 rows
 * (E-10-…) drop out on their own rather than needing a page range.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TXT = resolve(ROOT, 'content/fbise/text');
const OUT = resolve(ROOT, 'data/fbise');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * The nine SSC-I subjects, with the id the app already uses.
 *
 * `script: 'urdu'` marks the two documents that are typeset in Urdu with no
 * usable character map: the PDF draws the right glyphs but tells us the wrong
 * code points, so extraction returns scrambled text. That is a property of the
 * file, not of the extractor, and no parser setting fixes it. Both were read off
 * the rendered pages by hand instead, and this script leaves their committed
 * JSON alone rather than overwriting it.
 */
const SUBJECTS = [
  { id: 'phy', name: 'Physics', prefix: 'P' },
  { id: 'chem', name: 'Chemistry', prefix: 'C' },
  { id: 'bio', name: 'Biology', prefix: 'B' },
  { id: 'math', name: 'Mathematics', prefix: 'M' },
  { id: 'cs', name: 'Computer Science', prefix: 'CS' },
  { id: 'pst', name: 'Pakistan Studies', prefix: 'PS' },
  { id: 'eng', name: 'English', prefix: 'E' },
  { id: 'urd', name: 'Urdu', prefix: 'U', script: 'urdu' },
  { id: 'isl', name: 'Islamiyat', prefix: 'IS', script: 'urdu' },
];

/**
 * An SLO code in any of the spellings the nine documents use:
 * [SLO: P-09-A-05] · [SLO:P-09-B-01] · [SLO CS-09-A-01] · SLO: C-09-A-01
 * · [SLO: M-09-C -02] · [SLO:PS-09-A1-03]
 * Group 4 is the sub-domain digit that Pakistan Studies and English carry and
 * the sciences do not.
 */
const SLO_RE = /\[?\s*SLO[:\s]\s*([A-Z]{1,3})\s*-\s*(\d{2})\s*-\s*([A-Z])\s*(\d*)\s*-\s*(\d+)\s*\]?/;
const SLO_RE_G = new RegExp(SLO_RE.source, 'g');

/** `Domain: A Measurements` and `Domain A: Numbers and Algebra`, both real. */
const DOMAIN_RE = /^Domain:?\s*([A-Z])\s*:?\s+(.{3,60})$/;

const COGNITIVE_RE = /^(Knowledge|Understanding|Application)/i;
const ASSESSMENT_RE = /^(Summative|Formative)/i;
/**
 * Mathematics abbreviates the cognitive column to a single letter, and its key
 * page spells out K/U/A. Matched only as an entire cell, so the "A" that labels
 * a domain column and the "U" inside prose cannot be mistaken for it.
 */
const COGNITIVE_LETTER_RE = /^[KUA]$/;

/**
 * Column headers and page furniture that repeat on every page of the table.
 * They arrive as ordinary lines and would otherwise be appended to whichever
 * outcome happened to be open when the page broke.
 */
const NOISE_RE =
  /^(NCP SLOs? Description|Domains?|Content Area|SLO No|Cognitive|Level|Type of|Form of|Assessment|Remarks|Number of|Time|allocation|Periods?|\d+\s*Period|=\s*40|minutes|K:|U:|A:|Note:?|Key:?)\b/i;

/**
 * The Remarks column, which only ever restates `assessment` in a sentence.
 * It wraps over three or four lines, so the tails have to be caught too or they
 * are read as more of the learning outcome and end up inside its text.
 */
const REMARK_RE =
  /^(?:(?:Lab work-)?Questions?\(?s?\)? will|(?:in )?the annual examination|in the annual examination|however,? it will|regular teaching|classroom teaching|part of classroom|Page \d+ of \d+|annual (?:theory )?paper)/i;

const clean = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * pdftotext only guarantees a column break where the PDF left visible space.
 * Where a description runs the full width of its cell the next column lands one
 * space away, so "…instruments to measure" and "Summative" arrive glued into a
 * single cell. Pull the trailing column value back off, and report it.
 */
const TRAILING_COLUMN_RE =
  /\s+(Summative|Formative)(\s+(?:for\s+)?(?:Theory|PBA|Practical))?\s*(Knowledge|Understanding|Application)?\s*\+?\s*$/i;

function splitTrailingColumns(text) {
  const m = text.match(TRAILING_COLUMN_RE);
  if (!m) return { text, assessment: null, cognitive: null };
  return {
    text: text.slice(0, m.index).trim(),
    assessment: normaliseAssessment(m[1]),
    cognitive: m[3] ? normaliseCognitive(m[3]) : null,
  };
}

/** Split a -layout line into table cells on runs of two or more spaces. */
const cells = (line) =>
  line
    .split(/ {2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

/**
 * Read the domain titles the document states in prose. Only the ones it
 * actually writes down: a missing title stays null rather than being guessed,
 * because a wrong chapter name is worse than an unnamed one.
 */
function readDomainTitles(lines) {
  const titles = new Map();
  for (const raw of lines) {
    for (const cell of cells(raw)) {
      const m = cell.match(DOMAIN_RE);
      if (!m) continue;
      const [, letter, rest] = m;
      // Reject the accidental matches: a line that carries an SLO code is a
      // table row that happens to start with the domain letter, not a heading.
      if (SLO_RE.test(rest) || /^(has|OR\b)/i.test(rest)) continue;
      const title = clean(rest).replace(/[.,:;]+$/, '');
      if (title && !titles.has(letter)) titles.set(letter, title);
    }
  }
  return titles;
}

/** Take the cognitive level and assessment type off whichever cells hold them. */
function absorb(slo, cellList) {
  for (const c of cellList) {
    if (!slo.cognitive && COGNITIVE_RE.test(c)) slo.cognitive = normaliseCognitive(c);
    else if (!slo.cognitive && COGNITIVE_LETTER_RE.test(c)) slo.cognitive = LETTER[c];
    else if (!slo.assessment && ASSESSMENT_RE.test(c)) slo.assessment = normaliseAssessment(c);
  }
}

/**
 * Every framework states each outcome twice: once in the assessment table with
 * its full text and columns, and again in the model paper's question mapping
 * with the text clipped to fit a narrow cell. Same code, so keep the richer of
 * the two rather than letting the clipped copy through as a second outcome.
 */
function dedupe(slos) {
  const best = new Map();
  const score = (s) => (s.assessment ? 4 : 0) + (s.cognitive ? 2 : 0) + Math.min(s.text.length / 500, 1);
  for (const s of slos) {
    const seen = best.get(s.code);
    if (!seen || score(s) > score(seen)) best.set(s.code, s);
  }
  return [...best.values()];
}

/** Parse one subject's framework text into domains of learning outcomes. */
function parseFramework(text, subject) {
  const lines = text.split('\n');
  const titles = readDomainTitles(lines);

  const slos = [];
  let current = null;

  for (const raw of lines) {
    const parts = cells(raw);
    if (!parts.length) continue;

    // Does this line open a new outcome?
    const codeCell = parts.findIndex((c) => SLO_RE.test(c));

    if (codeCell !== -1) {
      const m = parts[codeCell].match(SLO_RE);
      const [, prefix, grade, domain, sub, num] = m;

      // Wrong subject or wrong class. Both really occur: the English framework
      // interleaves Class 9 and Class 10, and the Computer Science one quotes a
      // handful of English outcomes.
      if (prefix !== subject.prefix || grade !== '09') {
        current = null;
        continue;
      }

      // The description is whatever follows the code in the same cell, or the
      // next cell when the code sits in a column of its own.
      const tail = clean(parts[codeCell].slice(m.index + m[0].length).replace(/^[:.\s]+/, ''));
      const after = parts.slice(codeCell + 1);
      let text0 = tail;
      let rest = after;
      if (!text0 && after.length) {
        text0 = clean(after[0]);
        rest = after.slice(1);
      }

      const glued = splitTrailingColumns(text0);

      current = {
        code: `${prefix}-09-${domain}${sub}-${num.padStart(2, '0')}`,
        domain,
        subDomain: sub || null,
        number: Number(num),
        text: glued.text,
        cognitive: glued.cognitive,
        assessment: glued.assessment,
      };
      absorb(current, rest);
      slos.push(current);
      continue;
    }

    if (!current) continue;

    // A continuation line. The first cell usually carries the rest of the
    // description, but not always: where the description was short the row's
    // second visual line starts at the assessment column instead. So read the
    // columns off every cell, including the first, and only then decide whether
    // the first cell was prose worth keeping.
    const [first] = parts;
    absorb(current, parts);
    if (NOISE_RE.test(first) || REMARK_RE.test(first) || COGNITIVE_RE.test(first) || ASSESSMENT_RE.test(first)) continue;
    // A bare page number, or the running footer.
    if (/^\d{1,3}$/.test(first) || /Assessment Framework/i.test(first)) continue;
    const more = splitTrailingColumns(first);
    current.assessment ??= more.assessment;
    current.cognitive ??= more.cognitive;
    current.text = clean(`${current.text} ${more.text}`);
  }

  // Group into domains, in the order the codes first appear.
  const byDomain = new Map();
  for (const s of dedupe(slos)) {
    if (!byDomain.has(s.domain)) byDomain.set(s.domain, []);
    byDomain.get(s.domain).push(s);
  }

  const domains = [...byDomain.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, list]) => ({
      code,
      title: titles.get(code) ?? null,
      slos: list
        .sort((a, b) => (a.subDomain ?? '').localeCompare(b.subDomain ?? '') || a.number - b.number)
        .map(({ domain, subDomain, number, ...keep }) => keep),
    }));

  return domains;
}

const LETTER = { K: 'knowledge', U: 'understanding', A: 'application' };

const normaliseCognitive = (s) => {
  // "Understanding+", "Knowledge +", "Understanding + Application" all occur.
  // The board's own note says higher levels are collapsed into Application, so
  // a compound keeps its highest level and nothing is invented.
  const t = s.toLowerCase();
  if (t.includes('application')) return 'application';
  if (t.includes('understanding')) return 'understanding';
  if (t.includes('knowledge')) return 'knowledge';
  return null;
};

const normaliseAssessment = (s) => (/^summative/i.test(s.trim()) ? 'summative' : 'formative');

/**
 * The examinable unit list, from the cover page FBISE staples onto each
 * curriculum PDF.
 *
 * It reads, verbatim: "The question paper of Physics for Class IX will be based
 * on the SLOs of the following units:" and then a numbered list. That is the
 * board naming the chapters of the Class 9 paper in its own words, which is a
 * far better chapter list than anything recoverable from the framework tables,
 * where the Content Area column wraps mid-name and truncates to fragments like
 * "Periodic Table &".
 *
 * The numbering is not always 1..n. Mathematics examines units 1-7 and then
 * jumps to 14, 15, 17-23 and 29, because Class 9 and Class 10 share one
 * numbering. Keep the board's number, and keep our own position separately.
 */
// The sentence wraps mid-phrase in the Mathematics and Pakistan Studies
// documents ("…based on the SLOs of the" / "following unit:"), so match only as
// far as the part that always lands on the first line.
const COVER_RE = /question paper of .{2,30} for Class[- ]?IX will be based on the SLOs/i;
const NEXT_CLASS_RE = /for Class[- ]?X\b/i;
const ITEM_RE = /^\s*(\d{1,2}|[IVX]{1,5})\s*[.)]\s+(\S.{2,80})$/;

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

/** Title Case, because the cover pages shout: "PHYSICAL QUANTITIES AND MEASUREMENT". */
const titleCase = (s) =>
  s
    .toLowerCase()
    .replace(/\b([a-z])([a-z’']*)/g, (_, a, b) => a.toUpperCase() + b)
    .replace(/\b(And|Of|The|To|In|With|For|A|An)\b/g, (w) => w.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());

function parseExamUnits(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => COVER_RE.test(l));
  if (start === -1) return null;

  const units = [];
  for (let i = start + 1; i < Math.min(start + 60, lines.length); i++) {
    const line = lines[i];
    // The Class X list follows immediately; everything from there is not ours.
    if (NEXT_CLASS_RE.test(line)) break;
    const m = line.match(ITEM_RE);
    if (!m) {
      // One blank line is a wrap, several mean the list is over.
      if (!line.trim() && units.length) continue;
      continue;
    }
    const [, marker, title] = m;
    const number = ROMAN[marker] ?? Number(marker);
    if (!Number.isFinite(number)) continue;
    units.push({ number, title: titleCase(clean(title)) });
  }
  return units.length ? units : null;
}

/**
 * Computer Science, which has no cover page, so its units come from the table
 * of contents under "CURRICULUM FOR COMPUTER SCIENCE - GRADE IX". The label and
 * the title sit on separate lines there:
 *
 *     Unit 1:
 *         Fundamentals of Computer. ....................... 5
 *
 * English is deliberately not handled: it is organised by competency and
 * benchmark rather than by chapter, so there is no unit list to find.
 */
function parseTocUnits(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /CURRICULUM FOR .+GRADE IX\b/i.test(l));
  if (start === -1) return null;

  const units = [];
  for (let i = start + 1; i < Math.min(start + 40, lines.length); i++) {
    const label = lines[i].match(/^\s*Unit\s+(\d+)\s*:\s*$/i);
    if (!label) {
      if (/GRADE X\b/i.test(lines[i])) break;
      continue;
    }
    const next = lines.slice(i + 1, i + 3).find((l) => l.trim());
    if (!next) continue;
    const title = clean(next.replace(/\.{2,}.*$/, '').replace(/[\s.]+$/, ''));
    if (title) units.push({ number: Number(label[1]), title: titleCase(title) });
  }
  return units.length ? units : null;
}

/** Quality gates. A parse that silently produces rubbish is worse than none. */
function audit(domains) {
  const all = domains.flatMap((d) => d.slos);
  return {
    domains: domains.length,
    slos: all.length,
    summative: all.filter((s) => s.assessment === 'summative').length,
    formative: all.filter((s) => s.assessment === 'formative').length,
    unclassified: all.filter((s) => !s.assessment).length,
    untitledDomains: domains.filter((d) => !d.title).length,
    shortText: all.filter((s) => s.text.length < 20).length,
  };
}

/**
 * Say what the parse could not establish, in the file itself.
 *
 * Some frameworks merge the assessment column across a whole content area, so
 * one "Summative" governs the six outcomes printed beside it. Reading that back
 * per outcome is guesswork, and an outcome wrongly marked non-examinable is one
 * we would never write a question for. So it stays null and gets said out loud
 * here, where whoever generates content will see it.
 */
function coverageNotes(stats) {
  const notes = [];
  if (stats.unclassified > stats.slos / 4)
    notes.push(
      `${stats.unclassified} of ${stats.slos} outcomes have no formative/summative marking: the source table` +
        ' merges that column across a content area. Treat them as unknown, not as excluded.',
    );
  if (stats.untitledDomains)
    notes.push(`${stats.untitledDomains} domains are unnamed in the source. Name them from the Table of Specifications before publishing.`);
  return notes;
}

async function main() {
  const only = process.argv[2];
  await mkdir(OUT, { recursive: true });

  const manifest = JSON.parse(await readFile(resolve(ROOT, 'content/fbise/manifest.json'), 'utf8')).files;
  const byId = Object.fromEntries(manifest.map((f) => [f.id, f]));
  const index = [];
  let problems = 0;

  for (const subject of SUBJECTS) {
    if (only && subject.id !== only) continue;

    // Urdu and Islamiyat are not parsed, they are transcribed.
    //
    // Their PDFs draw the right glyphs and report the wrong code points, so
    // every extractor returns scrambled text and no parser setting fixes it.
    // Both files were read off the rendered pages by hand and committed. This
    // step must never overwrite them: read what is there, count it, and move on.
    if (subject.script === 'urdu') {
      try {
        const doc = JSON.parse(await readFile(resolve(OUT, `${subject.id}.json`), 'utf8'));
        const slos = (doc.domains ?? []).flatMap((d) => d.slos);
        index.push({
          subject: subject.id,
          name: subject.name,
          status: doc.complete === false ? 'transcribed-partial' : 'transcribed',
          domains: (doc.domains ?? []).length,
          slos: slos.length,
          summative: slos.filter((s) => s.assessment === 'summative').length,
        });
        console.log(
          `${C.green('kept')} ${subject.id.padEnd(5)} ${C.dim(`${slos.length} SLOs, transcribed by hand, left untouched`)}`,
        );
      } catch {
        console.log(`${C.yellow('skip')} ${subject.id.padEnd(5)} ${C.dim(`${subject.name}: not transcribed yet, see docs/CONTENT.md`)}`);
        index.push({ subject: subject.id, name: subject.name, status: 'needs-transcription', slos: 0 });
      }
      continue;
    }

    const file = resolve(TXT, `framework-${subject.id}.txt`);
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      console.error(`${C.red('miss')} ${subject.id.padEnd(5)} ${C.dim('run scripts/fetch-fbise.mjs first')}`);
      problems++;
      continue;
    }

    const domains = parseFramework(text, subject);

    // The unit list lives in the other document, and not every subject has one:
    // English is organised by competency rather than by chapter, and Computer
    // Science states its units only in a table of contents.
    let examUnits = null;
    try {
      const doc = await readFile(resolve(TXT, `curriculum-${subject.id}.txt`), 'utf8');
      examUnits = parseExamUnits(doc) ?? parseTocUnits(doc);
    } catch {
      /* no curriculum document for this subject */
    }

    const stats = { ...audit(domains), examUnits: examUnits?.length ?? 0 };

    // A handful of outcomes for a whole year's subject means the parse missed
    // the table. Fifteen is the floor because Computer Science really does
    // state only eighteen, each one broad and carrying its detail in bullets.
    const bad = stats.slos < 15;
    if (bad) problems++;

    const doc = {
      subject: subject.id,
      name: subject.name,
      grade: 9,
      board: 'fbise',
      curriculum: 'NCP 2022-23',
      source: {
        document: byId[`framework-${subject.id}`]?.path ?? null,
        sha256: byId[`framework-${subject.id}`]?.sha256 ?? null,
        retrieved: '2026-08-11',
      },
      stats,
      notes: coverageNotes(stats),
      examUnits: examUnits
        ? {
            scheme: 'Examinable unit list from the FBISE cover page of the curriculum document',
            document: byId[`curriculum-${subject.id}`]?.path ?? null,
            units: examUnits,
          }
        : null,
      domains,
    };

    await writeFile(resolve(OUT, `${subject.id}.json`), `${JSON.stringify(doc, null, 2)}\n`);
    index.push({ subject: subject.id, name: subject.name, status: 'ok', ...stats });

    const flag = bad ? C.red('thin') : C.green('  ok');
    console.log(
      `${flag} ${subject.id.padEnd(5)} ${C.dim(
        `${stats.domains} domains · ${stats.slos} SLOs · ${stats.summative} examinable` +
          `${stats.unclassified ? ` · ${stats.unclassified} unclassified` : ''}` +
          `${stats.untitledDomains ? ` · ${stats.untitledDomains} untitled` : ''}`,
      )}`,
    );

    if (only) {
      console.log(C.dim('\nfirst domain, first three outcomes:\n'));
      const d = domains[0];
      console.log(C.bold(`  ${d.code}. ${d.title ?? '(untitled)'}`));
      d.slos.slice(0, 3).forEach((s) => console.log(`  ${C.dim(s.code)} [${s.cognitive}/${s.assessment}] ${s.text}`));
    }
  }

  if (!only) {
    await writeFile(resolve(OUT, 'index.json'), `${JSON.stringify({ grade: 9, board: 'fbise', subjects: index }, null, 2)}\n`);
    const total = index.reduce((n, s) => n + (s.slos ?? 0), 0);
    console.log(C.dim(`\n${total} learning outcomes across ${index.filter((s) => s.status === 'ok').length} subjects → data/fbise/`));
  }

  if (problems) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
