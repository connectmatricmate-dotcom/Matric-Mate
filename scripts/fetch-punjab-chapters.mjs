#!/usr/bin/env node
/**
 * Pull the Punjab chapter and topic tree from the government's own e-learning app.
 *
 *   node scripts/fetch-punjab-chapters.mjs                 every subject, both classes
 *   node scripts/fetch-punjab-chapters.mjs --subject bio    one subject
 *   node scripts/fetch-punjab-chapters.mjs --dry-run        fetch and report, write nothing
 *
 * WHY THIS EXISTS
 *
 * FBISE publishes Student Learning Outcomes with its own codes, and every note
 * and question we generate points at the outcome it was written for. Punjab
 * publishes nothing equivalent: PCTB holds curriculum authority through
 * textbooks, and PBCC sets the paper pattern. So for Punjab the examinable unit
 * is the textbook topic, and this is where that hierarchy comes from.
 *
 * elearn.gov.pk is PITB's official digitisation of the PCTB textbooks. It is
 * the same books the boards examine, already broken into a numbered chapter and
 * topic tree, which is a far better source than reading a scan. Three hops:
 *
 *   grades/{9|10}          the subject cards, each linking to a numeric id
 *   chapters/{subjectId}   that subject's chapters
 *   topics/{id}/{chapter}  the numbered topic tree for one chapter
 *
 * WHAT THIS DOES NOT COVER
 *
 * Only the four science and maths subjects are on the portal. English, Urdu,
 * Islamiat, Pakistan Studies and Computer Science are not, and their chapter
 * lists have to come from the textbooks themselves. The manifest in
 * scripts/punjab-sources.json says so rather than leaving it to be discovered.
 *
 * The output is structure only: chapter numbers, titles and the topics under
 * them. No textbook prose is copied. That is deliberate, and it is the same
 * line the FBISE pipeline draws: what lives in git is the structure we derive,
 * never the board's own material.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/punjab/chapters.json');
const BASE = 'https://www.elearn.gov.pk/elearn_app';
const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';

/**
 * Subject ids as the portal numbers them, read off the grade pages rather than
 * guessed. They differ per class, which is why they are listed per class and
 * not derived from one another.
 */
const SUBJECTS = {
  9: { bio: 3, math: 7, chem: 8, phy: 15 },
  10: { bio: 1, math: 5, chem: 6, phy: 13 },
};

const args = process.argv.slice(2);
const only = args.includes('--subject') ? args[args.indexOf('--subject') + 1] : null;
const dryRun = args.includes('--dry-run');

const get = async (path) => {
  const res = await fetch(`${BASE}/${path}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.text();
};

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** Which chapter numbers a subject actually has, from its chapter page. */
function chapterNumbers(html, subjectId) {
  const found = new Set();
  for (const m of html.matchAll(new RegExp(`/topics/${subjectId}/(\\d+)`, 'g'))) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
}

/**
 * The topic tree for one chapter.
 *
 * The page repeats a parent heading before its children, so a plain list has
 * duplicates in it. Topics are numbered (10.2, 10.2.1), and that numbering is
 * the real structure: depth comes from counting dots, and the number doubles as
 * a stable key. Anything unnumbered is a heading, not a topic, and is dropped.
 */
function parseTopics(html) {
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ');
  const seen = new Set();
  const topics = [];
  let chapterTitle = null;

  for (const raw of body.split(/<\/?(?:a|li|div|h[1-6]|p)[^>]*>/i)) {
    const text = strip(raw);
    if (!text || text.length > 200) continue;

    /*
     * The page's own furniture, which the label-first pattern below happily
     * mistook for a topic: "Biology Grade 9" reads as label + number and was
     * being filed as topic 9 in every chapter of the subject.
     */
    if (/^(elearn|select topic|home|back)$/i.test(text)) continue;
    if (/\bgrade\s+\d+$/i.test(text)) continue;

    /*
     * Four shapes, all of them real on this portal, found by checking the
     * chapters that came back empty rather than assuming the portal had gaps:
     *
     *   2.4 Terms Associated with Motion   science: number first
     *   6.1. Solution                      chemistry: number first, trailing dot
     *   6 Introduction                     a chapter-level heading, no sub-number
     *   Theorem 11.1.1                     maths: label first, number after
     *   THEOREM 3 (APOLLONIUS THEOREM)     maths again, undotted, with a suffix
     *
     * Matching only the first shape lost twelve chapters to an empty topic
     * list, which looked like a portal gap and was ours.
     */
    const leading = /^(\d+(?:\.\d+)*)\.?\s+(.*\S)$/.exec(text);
    const trailing = /^[A-Za-z][A-Za-z .'()-]{0,30}?\s+(\d+(?:\.\d+)*)\b/.exec(text);
    if (!leading && !trailing) continue;

    const number = leading ? leading[1] : trailing[1];
    // For the label-first shape the label and its number together are the title.
    const title = leading ? leading[2] : text;
    if (seen.has(number)) continue;
    seen.add(number);
    topics.push({ number, title, depth: number.split('.').length - 1 });
  }

  const heading = /Select Topic/i.test(body) ? strip((body.match(/>([^<]{4,60}Grade \d+)</) ?? [])[1] ?? '') : '';
  if (heading) chapterTitle = heading;

  return { topics, chapterTitle };
}

async function subjectTree(subject, grade, subjectId) {
  const listing = await get(`chapters/${subjectId}`);
  const numbers = chapterNumbers(listing, subjectId);
  const chapters = [];

  for (const number of numbers) {
    const page = await get(`topics/${subjectId}/${number}`);
    const { topics } = parseTopics(page);
    /*
     * A chapter's own title is not printed on the topic page, but its topics
     * are numbered from it, so the chapter number is confirmed by its topics
     * rather than assumed from the URL. A chapter whose topics disagree is
     * reported instead of silently filed under the wrong number.
     */
    const dotted = topics.find((t) => t.number.includes('.'));
    /*
     * Only a dotted number carries its chapter ("10.2" means chapter 10). The
     * maths theorem chapters number their topics from one ("Theorem 1"), which
     * says nothing about the chapter, so there is nothing to cross-check and
     * flagging them as mismatched was crying wolf.
     */
    const impliedChapter = dotted ? Number(dotted.number.split('.')[0]) : number;
    chapters.push({
      number,
      impliedChapter,
      matches: impliedChapter === number,
      topicCount: topics.length,
      topics,
    });
    process.stdout.write(`   ${subject}-${grade} chapter ${number}: ${topics.length} topics\n`);
  }

  return { subject, grade, subjectId, chapters };
}

const out = { source: 'elearn.gov.pk', fetchedAt: new Date().toISOString().slice(0, 10), subjects: [] };

for (const grade of [9, 10]) {
  for (const [subject, subjectId] of Object.entries(SUBJECTS[grade])) {
    if (only && only !== subject) continue;
    process.stdout.write(`\n${subject} class ${grade} (portal id ${subjectId})\n`);
    try {
      out.subjects.push(await subjectTree(subject, grade, subjectId));
    } catch (err) {
      process.stdout.write(`   FAILED: ${err.message}\n`);
    }
  }
}

const totals = out.subjects.reduce(
  (acc, s) => ({
    chapters: acc.chapters + s.chapters.length,
    topics: acc.topics + s.chapters.reduce((n, c) => n + c.topicCount, 0),
    mismatched: acc.mismatched + s.chapters.filter((c) => !c.matches).length,
  }),
  { chapters: 0, topics: 0, mismatched: 0 }
);

process.stdout.write(
  `\n${out.subjects.length} subject-classes, ${totals.chapters} chapters, ${totals.topics} topics` +
    (totals.mismatched ? `, ${totals.mismatched} with a chapter number their topics disagree with\n` : '\n')
);

if (dryRun) {
  process.stdout.write('dry run, nothing written\n');
} else {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`);
  process.stdout.write(`written to ${OUT.replace(ROOT, '.')}\n`);
}
