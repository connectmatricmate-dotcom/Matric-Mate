#!/usr/bin/env node
/**
 * Read inside each Punjab chapter: where it starts, the learning outcomes it
 * prints, and the headings it is built from.
 *
 *   node scripts/extract-punjab-outcomes.mjs                every book with a contents tree
 *   node scripts/extract-punjab-outcomes.mjs --only phy-10  one book
 *   node scripts/extract-punjab-outcomes.mjs --force        redo everything, locating included
 *   node scripts/extract-punjab-outcomes.mjs --reread       re-read chapters, keep where they are
 *
 * WHAT THE BOOKS TURNED OUT TO CARRY
 *
 * Punjab publishes no outcome matrix with codes the way FBISE does, and the
 * plan was to treat each textbook topic as the examinable unit. Then the 2023
 * editions turned out to print the outcomes themselves: every chapter opens
 * with a box headed "Student's learning outcomes (SLOs)", the national
 * curriculum's own statements, verbatim. That is better ground than topic
 * titles, and it makes the Punjab pipeline the same shape as FBISE's: the
 * generator writes against outcomes, every question carries the one it was
 * written for. Only the codes are ours, minted at seeding.
 *
 * TWO PASSES
 *
 * 1. LOCATE. Contents pages give printed page numbers, and a scan's page 4 is
 *    printed page 1, by an offset that differs per book and can drift where a
 *    scan dropped a page. So the whole book is looked at once, as grids of
 *    thumbnails labelled with their PDF page number, and the model names the
 *    page each chapter opens on. Checked against the contents: the gaps
 *    between chapter openings must match the gaps between printed page
 *    numbers, which a misidentified opening cannot fake.
 *
 * 2. READ. Each chapter's pages, the opening ones at a resolution where small
 *    print is legible. Sciences, maths, computer science and Pakistan Studies
 *    are read to the end for their numbered headings, which become topics;
 *    their contents pages mostly list chapter titles alone. Languages and
 *    Islamiyat only need the opening pages: their units are lessons, and the
 *    contents already names them.
 *
 * Written to data/punjab/outcomes/, one file per book, saved after every
 * chapter so an interrupted run resumes where it stopped. Structure and
 * outcome statements only, never the chapter's prose.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SUBJECTS, listBooks } from './extract-punjab-contents.mjs';
import { C, ROOT, STRONG_MODEL, VISION_MODEL, askJson, loadEnv, pageCount, renderGrids, renderPages, scrubDashes, tally } from './pdf-vision.mjs';

const BOOKS = resolve(ROOT, 'content/punjab/textbooks');
const CONTENTS = resolve(ROOT, 'data/punjab/contents');
const OUT = resolve(ROOT, 'data/punjab/outcomes');

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');
const reread = args.includes('--reread');

/** Subjects read to the end of every chapter for headings. */
const READ_WHOLE = new Set(['phy', 'chem', 'bio', 'math', 'cs', 'pst']);
/** Opening pages at a resolution small print survives; enough for any outcomes box seen so far. */
const OPENING_PAGES = 3;

const SYSTEM = `You read scanned pages of Pakistani school textbooks and report what is printed on them as JSON. You are exact: you copy text as printed, you never invent an outcome, heading or page, and you never tidy numbering the book prints differently. When something is illegible or ambiguous you say so in "notes" rather than guessing.`;

/* ---------------------------------------------------------------- locate */

function locatePrompt(book, contents, gridCount, pages) {
  const subject = `${SUBJECTS[book.subject]} textbook for Class ${book.grade}`;
  const list = contents
    ? contents.chapters.map((c) => `  ${c.number}. ${c.titleEn ?? c.title}${c.page != null ? ` (printed page ${c.page})` : ''}`).join('\n')
    : null;

  return `These ${gridCount} images are grids of thumbnails showing every page of a Punjab board ${subject}, ${pages} pages in all. Each thumbnail is labelled underneath with its page number in the PDF ("page 22").

${
  list
    ? `The book's contents lists these chapters:\n${list}\n\nFind the page where each of them opens.`
    : `This copy has no contents page. Find every chapter or unit that opens in it.`
}

A chapter opening is usually a distinct page: a large banner with the chapter or unit number and title, often with a learning outcomes box. Answer with the PDF page number from the label, never the number printed on the page itself.

Return ONLY a JSON object, no prose, no code fence:

{
  "chapters": [ { "number": 10, "pdfPage": 4, "titleSeen": "title as far as it is legible in the thumbnail, else null" } ],
  "backMatterStart": PDF page where material after the last chapter begins (glossary, answers, index, bibliography, pairing scheme, model paper), or null if the last chapter runs to the end,
  "notes": "anything uncertain, else null"
}`;
}

/**
 * The checks that make a location trustworthy. The decisive one: between two
 * chapter openings the PDF gap must equal the printed gap. A thumbnail
 * mistaken for an opening shifts one gap and breaks that equality.
 */
function checkLocation(located, contents, pages) {
  const problems = [];
  const found = located.chapters ?? [];
  if (!found.length) return ['no chapter openings found'];

  found.forEach((c, i) => {
    if (!Number.isInteger(c.pdfPage) || c.pdfPage < 1 || c.pdfPage > pages) problems.push(`chapter ${c.number} has no valid page`);
    if (i > 0 && c.pdfPage <= found[i - 1].pdfPage) problems.push(`chapter ${c.number} opens before chapter ${found[i - 1].number}`);
  });

  if (contents) {
    const want = contents.chapters.map((c) => c.number).join(',');
    const got = found.map((c) => c.number).join(',');
    if (want !== got) problems.push(`found chapters ${got}, contents lists ${want}`);
    else {
      contents.chapters.forEach((c, i) => {
        const next = contents.chapters[i + 1];
        if (!next || c.page == null || next.page == null) return;
        const printedGap = next.page - c.page;
        const pdfGap = found[i + 1].pdfPage - found[i].pdfPage;
        if (printedGap !== pdfGap) problems.push(`chapter ${c.number} to ${next.number}: ${pdfGap} PDF pages but ${printedGap} printed`);
      });
    }
  }
  return problems;
}

/* ------------------------------------------------------------------ read */

function readPrompt(book, chapter, count, whole) {
  return `These are ${whole ? 'the pages' : `the first ${count} pages`} of chapter ${chapter.number}, "${chapter.titleEn ?? chapter.title ?? 'title unknown'}", from the Punjab board ${SUBJECTS[book.subject]} textbook for Class ${book.grade}, in order, as images 1 to ${count}.${whole ? ` The first ${Math.min(OPENING_PAGES, count)} are at a higher resolution.` : ''}

Return ONLY a JSON object, no prose, no code fence:

{
  "openingConfirmed": true if image 1 is the opening page of this chapter, else false,
  "number": the chapter or unit number printed on the opening page, as an integer,
  "title": the chapter title as printed on the opening page,
  "titleEn": English rendering if that title is not English, else null,
  "sloHeading": the heading printed above the learning outcomes, e.g. "Student's learning outcomes (SLOs)", or null if there is none,
  "sloLead": the line introducing them, e.g. "After studying this unit, students will be able to:", or null,
  "slos": [ "one string per outcome, verbatim" ],
  "headings": [ { "number": "10.1", "title": "Thermal Expansion", "image": 2 } ],
  "notes": "anything uncertain or unusual, else null"
}

Rules for "slos":
- Copy each outcome exactly as printed, including bracketed examples and clarifications. Only rejoin words split across a line break.
- One string per bullet. If a bullet has lettered sub-points, keep them inside that bullet's string.
- Leave out the bullet mark itself. If an outcome continues onto the next page, join it.
- If the chapter prints no learning outcomes, return an empty array.

Rules for "headings":
${
  whole
    ? `- Every numbered section heading (10.1, 10.2, 10.2.1) in the order it appears, with the image it is on.
- If the chapter has no numbered headings, give its main unnumbered section headings instead, with number null.
- Leave out boxed features (Tidbit, Do You Know, Brain Teaser, For Your Information, Key Points, Summary, Activity, Experiment), worked examples, the exercise and its parts, and figure or table captions.`
    : `- Not needed for this book. Return an empty array.`
}`;
}

function checkChapter(read, chapter, whole) {
  const problems = [];
  const warnings = [];
  if (read.openingConfirmed === false) problems.push('image 1 is not the chapter opening');
  if (read.number !== chapter.number) problems.push(`opening page says chapter ${read.number}, expected ${chapter.number}`);
  if (!Array.isArray(read.slos)) problems.push('no slos array');
  else if (!read.slos.length) warnings.push('prints no learning outcomes');
  for (const h of read.headings ?? []) {
    if (h.number && !String(h.number).startsWith(`${chapter.number}.`)) warnings.push(`heading ${h.number} under chapter ${chapter.number}`);
  }
  if (whole && !(read.headings ?? []).length) warnings.push('no headings found');
  return { problems, warnings };
}

/* ------------------------------------------------------------------ main */

async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const env = await loadEnv();
  if (!env.ANTHROPIC_API_KEY) {
    console.error(C.red('apps/web/.env.local needs ANTHROPIC_API_KEY'));
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  const books = await listBooks(only);
  const docs = new Map();
  const saving = new Map();
  // Chapters of one book finish in parallel, so their saves are queued.
  const save = (name) => {
    const next = (saving.get(name) ?? Promise.resolve()).then(() =>
      writeFile(join(OUT, `${name}.json`), `${JSON.stringify(docs.get(name), null, 2)}\n`),
    );
    saving.set(name, next);
    return next;
  };

  const pool = async (items, width, fn) => {
    const queue = [...items];
    await Promise.all(Array.from({ length: width }, async () => {
      while (queue.length) await fn(queue.shift());
    }));
  };

  /* Pass 1: where every chapter opens. */
  const failed = [];
  await pool(books, 4, async (book) => {
    const pdf = resolve(BOOKS, book.file);
    const contents = await loadJson(join(CONTENTS, `${book.name}.json`));
    const existing = force ? null : await loadJson(join(OUT, `${book.name}.json`));
    if (existing?.chapters?.length) {
      docs.set(book.name, existing);
      console.log(C.dim(`  ${book.name}: located already`));
      return;
    }
    try {
      const pages = await pageCount(pdf);
      const grids = await renderGrids(pdf, { pages });
      const located = scrubDashes(
        await askJson(env, { system: SYSTEM, images: grids, prompt: locatePrompt(book, contents, grids.length, pages), model: STRONG_MODEL }),
      );
      const problems = checkLocation(located, contents, pages);
      if (problems.length) {
        console.log(C.red(`  ${book.name}: location FAILED checks`));
        for (const p of problems.slice(0, 8)) console.log(C.red(`      ${p}`));
        failed.push(book.name);
        return;
      }

      const found = located.chapters;
      const lastPage = (located.backMatterStart ?? pages + 1) - 1;
      const byNumber = new Map((contents?.chapters ?? []).map((c) => [c.number, c]));
      const offsets = contents ? [...new Set(found.map((c) => c.pdfPage - (byNumber.get(c.number)?.page ?? NaN)).filter(Number.isFinite))] : [];

      docs.set(book.name, {
        source: `content/punjab/textbooks/${book.file}`,
        subject: book.subject,
        grade: book.grade,
        medium: book.medium,
        pdfPages: pages,
        extractedAt: new Date().toISOString().slice(0, 10),
        model: STRONG_MODEL,
        // A book with no contents page (Computer Science 10 as supplied) gets
        // its chapter list from the openings alone.
        contentsPage: Boolean(contents),
        pageOffsets: offsets,
        backMatterStart: located.backMatterStart ?? null,
        locateNotes: located.notes ?? null,
        chapters: found.map((c, i) => ({
          number: c.number,
          title: byNumber.get(c.number)?.title ?? c.titleSeen ?? null,
          titleEn: byNumber.get(c.number)?.titleEn ?? null,
          pdfStart: c.pdfPage,
          pdfEnd: i + 1 < found.length ? found[i + 1].pdfPage - 1 : lastPage,
          read: null,
        })),
      });
      await save(book.name);
      console.log(`  ${book.name}: ` + C.green(`${found.length} chapters located`) + C.dim(`  offset ${offsets.join('/') || 'n/a'}${located.backMatterStart ? `, back matter from ${located.backMatterStart}` : ''}`));
    } catch (e) {
      console.log(C.red(`  ${book.name}: locate ERROR ${e.message}`));
      failed.push(book.name);
    }
  });

  /* Pass 2: inside each chapter. */
  const jobs = [];
  for (const [name, doc] of docs) {
    for (const chapter of doc.chapters) if (force || reread || !chapter.read) jobs.push({ name, doc, chapter });
  }
  console.log(C.dim(`\n  ${jobs.length} chapters to read\n`));

  let warned = 0;
  await pool(jobs, 5, async ({ name, doc, chapter }) => {
    const book = books.find((b) => b.name === name);
    const pdf = resolve(BOOKS, book.file);
    const whole = READ_WHOLE.has(book.subject);
    const last = whole ? chapter.pdfEnd : Math.min(chapter.pdfEnd, chapter.pdfStart + OPENING_PAGES - 1);
    const label = `${name} ch${chapter.number}`;
    try {
      const openingLast = Math.min(last, chapter.pdfStart + OPENING_PAGES - 1);
      const images = [
        ...(await renderPages(pdf, { first: chapter.pdfStart, last: openingLast, px: 1560 })),
        ...(last > openingLast ? await renderPages(pdf, { first: openingLast + 1, last, px: 850 }) : []),
      ];
      const read = scrubDashes(await askJson(env, { system: SYSTEM, images, prompt: readPrompt(book, chapter, images.length, whole) }));
      const { problems, warnings } = checkChapter(read, chapter, whole);
      if (problems.length) {
        console.log(C.red(`  ${label}: FAILED ${problems.join('; ')}`));
        return;
      }
      chapter.title ??= read.title;
      chapter.titleEn ??= read.titleEn ?? null;
      chapter.read = {
        model: VISION_MODEL,
        titleOnPage: read.title,
        sloHeading: read.sloHeading ?? null,
        sloLead: read.sloLead ?? null,
        slos: read.slos,
        headings: (read.headings ?? []).map((h) => ({
          number: typeof h.number === 'string' ? h.number.replace(/[^\d.]+$/, '').replace(/\.$/, '') || null : null,
          title: h.title,
          pdfPage: Number.isInteger(h.image) ? chapter.pdfStart + h.image - 1 : null,
        })),
        notes: read.notes ?? null,
      };
      await save(name);
      if (warnings.length) warned++;
      console.log(
        `  ${label}: ` + C.green(`${read.slos.length} outcomes, ${chapter.read.headings.length} headings`) +
          (warnings.length ? C.yellow(`  ${warnings.join('; ')}`) : ''),
      );
    } catch (e) {
      console.log(C.red(`  ${label}: ERROR ${e.message}`));
    }
  });

  let slos = 0;
  let headings = 0;
  let unread = 0;
  for (const doc of docs.values()) {
    for (const c of doc.chapters) {
      if (!c.read) unread++;
      slos += c.read?.slos.length ?? 0;
      headings += c.read?.headings.length ?? 0;
    }
  }
  console.log(`\n${docs.size} books located${failed.length ? `, ${failed.length} failed: ${failed.join(', ')}` : ''}`);
  console.log(`${slos} outcomes and ${headings} headings read${unread ? `, ${unread} chapters still unread` : ''}${warned ? `, ${warned} with warnings` : ''}`);
  if (tally.input) console.log(C.dim(`${tally.input.toLocaleString()} tokens in, ${tally.output.toLocaleString()} out`));
}

await main();
