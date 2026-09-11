#!/usr/bin/env node
/**
 * Read each Punjab textbook's own contents page into a chapter and topic tree.
 *
 *   node scripts/extract-punjab-contents.mjs                every book in the folder
 *   node scripts/extract-punjab-contents.mjs --only bio-9   one book
 *   node scripts/extract-punjab-contents.mjs --force        redo books already done
 *
 * WHY THE BOOKS AND NOT ELEARN
 *
 * The first Punjab tree came from elearn.gov.pk, and it matched the textbooks
 * line by line, which is exactly what made it wrong: it matched the OLD ones.
 * The 2023 revision of the curriculum reorganised the books. Biology 9 went
 * from nine chapters to eleven, with a new first chapter and new ones on
 * biomolecules, plant physiology, reproduction in plants and biostatistics.
 * The portal has not caught up, so the books themselves are the only current
 * source, and their contents pages already carry the whole structure,
 * numbered, with page numbers.
 *
 * HOW
 *
 * Almost every book is a scan, so there is no text to parse. The first pages
 * are rendered to images and a model finds the contents page among them and
 * transcribes it. Then the result is checked hard rather than trusted:
 * chapters must run in sequence, page numbers must rise, and a numbered topic
 * must sit under the chapter its number says it belongs to. A book that fails
 * those checks is reported and not written, because a quietly wrong tree is
 * how a whole subject gets generated against the wrong syllabus.
 *
 * What is written is structure only: numbers, titles, page numbers. No
 * textbook prose, the same line every other pipeline here draws.
 *
 * Books arriving later (the colleague's batch) need nothing but a re-run: the
 * script skips what is done and picks up whatever is new in the folder.
 *
 * The next step, extract-punjab-outcomes.mjs, reads inside each chapter.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { C, ROOT, VISION_MODEL, askJson, loadEnv, renderPages, scrubDashes, tally } from './pdf-vision.mjs';

const BOOKS = resolve(ROOT, 'content/punjab/textbooks');
const OUT = resolve(ROOT, 'data/punjab/contents');

export const SUBJECTS = {
  phy: 'Physics', chem: 'Chemistry', bio: 'Biology', math: 'Mathematics', cs: 'Computer Science',
  eng: 'English', urd: 'Urdu', isl: 'Islamiyat', pst: 'Pakistan Studies',
};

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');

const SYSTEM = `You transcribe the table of contents of Pakistani school textbooks into JSON. You are exact: you copy titles as printed, you never invent a chapter or a topic that is not on the page, and you never tidy numbering that the book prints differently. When something is illegible or ambiguous you say so in "notes" rather than guessing.`;

function instructions(subjectName, grade, pageCount) {
  return `These are the first ${pageCount} pages of the Punjab board ${subjectName} textbook for Class ${grade}, as images numbered 1 to ${pageCount} in order.

Find the table of contents (it may be headed "Contents", "Table of Contents" or "فہرست", and may span several pages). Transcribe the whole of it.

Return ONLY a JSON object, no prose, no code fence:

{
  "bookTitle": "title as printed on the cover or title page",
  "publisher": "e.g. Punjab Curriculum and Textbook Board, Lahore",
  "curriculum": "the curriculum line if printed, e.g. Based on Revised National Curriculum of Pakistan 2023, else null",
  "language": "en" | "ur" | "mixed",
  "contentsPages": [image numbers that show the contents],
  "contentsComplete": true if the full contents is visible in these images, false if it continues past the last image,
  "chapters": [
    {
      "number": 1,
      "title": "chapter or unit title exactly as printed",
      "titleEn": "English rendering if the printed title is not English, else null",
      "page": 1,
      "topics": [
        { "number": "1.1", "title": "topic title as printed", "titleEn": null, "page": 5 }
      ]
    }
  ],
  "notes": "anything uncertain, illegible or unusual, else null"
}

Rules:
- "number" on a chapter is the integer the book prints (Chapter 6, Unit 6, باب ششم is 6). Keep the book's own numbering even if it does not start at 1.
- Topic "number" is the label as printed ("6.1", "6.1.2"). If topics are unnumbered, use null.
- Include every sub-topic the contents lists, at every depth. If the contents lists only chapters, give an empty topics array.
- "page" is the page number printed in the contents, as an integer, or null if none is printed.
- Leave out front and back matter such as preface, glossary, answers and index. Only teaching chapters.`;
}

/**
 * Everything that must be true of a real contents page.
 *
 * Returns problems rather than throwing, so a book that fails is reported with
 * all of its faults at once instead of the first one.
 */
function check(tree) {
  const problems = [];
  const chapters = tree.chapters ?? [];
  if (!chapters.length) problems.push('no chapters found');
  if (tree.contentsComplete === false) problems.push('contents continues past the pages read');

  let lastPage = -Infinity;
  chapters.forEach((ch, i) => {
    if (!Number.isInteger(ch.number)) problems.push(`chapter ${i + 1} has no integer number`);
    if (i > 0 && Number.isInteger(ch.number) && ch.number !== chapters[i - 1].number + 1) {
      problems.push(`chapter numbers jump from ${chapters[i - 1].number} to ${ch.number}`);
    }
    if (!ch.title?.trim()) problems.push(`chapter ${ch.number} has no title`);
    // The English rendering is how an Urdu-medium book is matched to its
    // English twin, so an Urdu title without one is an incomplete read.
    const urdu = (ch.title?.match(/[\u0600-\u06FF]/g)?.length ?? 0) > (ch.title?.match(/[A-Za-z]/g)?.length ?? 0);
    if (urdu && !ch.titleEn?.trim()) problems.push(`chapter ${ch.number} has an Urdu title and no English rendering`);
    if (Number.isInteger(ch.page)) {
      if (ch.page < lastPage) problems.push(`chapter ${ch.number} starts on page ${ch.page}, before the previous one`);
      lastPage = ch.page;
    }
    for (const t of ch.topics ?? []) {
      // A topic numbered 6.x belongs to chapter 6. One that says otherwise is a
      // misread, or a contents page that was stitched together wrongly.
      const lead = typeof t.number === 'string' ? Number(t.number.split('.')[0]) : null;
      if (lead !== null && Number.isFinite(lead) && lead !== ch.number && String(t.number).includes('.')) {
        problems.push(`topic ${t.number} sits under chapter ${ch.number}`);
      }
      if (Number.isInteger(t.page) && Number.isInteger(ch.page) && t.page < ch.page) {
        problems.push(`topic ${t.number ?? t.title} is on page ${t.page}, before its chapter`);
      }
    }
  });
  return problems;
}

/**
 * Books print topic labels with stray punctuation ("1.1-", "2.3."). The label
 * is an identifier from here on, so it is reduced to its digits and dots.
 */
function tidy(tree) {
  for (const ch of tree.chapters ?? []) {
    for (const t of ch.topics ?? []) {
      if (typeof t.number === 'string') t.number = t.number.trim().replace(/[^\d.]+$/, '').replace(/\.$/, '') || null;
    }
  }
  return scrubDashes(tree);
}

async function extract(env, book) {
  const outFile = join(OUT, `${book.name}.json`);
  if (!force) {
    try {
      await readFile(outFile);
      console.log(C.dim(`  ${book.name}: already done, skipping (use --force to redo)`));
      return null;
    } catch {}
  }

  try {
    // Most contents pages sit within the first sixteen. If a book's runs on,
    // read further once rather than accept half a syllabus.
    const pdf = resolve(BOOKS, book.file);
    const read = async (last) => {
      const images = await renderPages(pdf, { last, px: 1300 });
      return askJson(env, { system: SYSTEM, images, prompt: instructions(SUBJECTS[book.subject], book.grade, images.length) });
    };
    let tree = await read(16);
    if (tree.contentsComplete === false) tree = await read(30);
    tree = tidy(tree);

    // One more read when the checks fail. Most failures are one field the
    // model left out this time and fills in the next.
    let problems = check(tree);
    if (problems.length) {
      tree = tidy(await read(tree.contentsComplete === false ? 30 : 16));
      problems = check(tree);
    }

    const topics = (tree.chapters ?? []).reduce((n, c) => n + (c.topics?.length ?? 0), 0);
    if (problems.length) {
      console.log(C.red(`  ${book.name}: FAILED checks, not written`));
      for (const p of problems.slice(0, 8)) console.log(C.red(`      ${p}`));
      return { name: book.name, status: 'failed', problems };
    }

    const record = {
      source: `content/punjab/textbooks/${book.file}`,
      subject: book.subject,
      grade: book.grade,
      medium: book.medium,
      extractedAt: new Date().toISOString().slice(0, 10),
      model: VISION_MODEL,
      ...tree,
    };
    await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
    console.log(
      `  ${book.name}: ` +
        C.green(`${tree.chapters.length} chapters, ${topics} topics`) +
        (tree.notes ? C.yellow(`  note: ${String(tree.notes).slice(0, 110)}`) : ''),
    );
    return { name: book.name, status: 'ok', chapters: tree.chapters.length, topics };
  } catch (e) {
    console.log(C.red(`  ${book.name}: ERROR ${e.message}`));
    return { name: book.name, status: 'error', problems: [e.message] };
  }
}

/** Every textbook in the folder, as { file, name, subject, grade, medium }. */
export async function listBooks(filter = null) {
  return (await readdir(BOOKS))
    .map((f) => ({ file: f, m: f.match(/^([a-z]+)-(9|10)(-ur)?\.pdf$/) }))
    .filter(({ m }) => m && SUBJECTS[m[1]])
    .map(({ file, m }) => ({ file, name: file.replace(/\.pdf$/, ''), subject: m[1], grade: Number(m[2]), medium: m[3] ? 'ur' : 'en' }))
    .filter((b) => !filter || b.name === filter)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const env = await loadEnv();
  if (!env.ANTHROPIC_API_KEY) {
    console.error(C.red('apps/web/.env.local needs ANTHROPIC_API_KEY'));
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  // Four books at a time: well inside the rate limit, and a full run takes
  // minutes instead of a quarter of an hour.
  const queue = await listBooks(only);
  const summary = [];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const result = await extract(env, queue.shift());
        if (result) summary.push(result);
      }
    }),
  );

  const ok = summary.filter((s) => s.status === 'ok');
  const bad = summary.filter((s) => s.status !== 'ok');
  console.log(`\n${ok.length} written, ${bad.length} need attention${bad.length ? `: ${bad.map((b) => b.name).join(', ')}` : ''}`);
  if (ok.length) console.log(`${ok.reduce((n, s) => n + s.chapters, 0)} chapters, ${ok.reduce((n, s) => n + s.topics, 0)} topics across ${ok.length} books`);
  if (tally.input) console.log(C.dim(`${tally.input.toLocaleString()} tokens in, ${tally.output.toLocaleString()} out`));
}

// Imported for listBooks and SUBJECTS by the outcomes step; only a direct run extracts.
if (import.meta.url === `file://${process.argv[1]}`) await main();
