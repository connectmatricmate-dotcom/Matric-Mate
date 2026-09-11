#!/usr/bin/env node
/**
 * Urdu names for the Punjab chapters no Urdu-medium book gives one.
 *
 *   node scripts/translate-punjab-titles.mjs
 *
 * Most Punjab chapters take their Urdu name from the Urdu-medium edition of
 * the same book (build-punjab-catalogue.mjs). Fifty-nine have none: Biology,
 * Chemistry and Computer Science 9 and some of Physics and Pakistan Studies 10
 * have no current Urdu-medium copy in hand, and English has no Urdu edition at
 * all. Every FBISE chapter has an Urdu name, so an Urdu-interface student met
 * English ones only here.
 *
 * These are translations, not printed titles, and live in their own file,
 * data/punjab/urdu-titles.json, so nothing downstream can mistake one for the
 * other. The builder uses them only where no book supplies a name, and a
 * printed name from a book that arrives later replaces them without anyone
 * having to remember to.
 *
 * Style follows the Punjab Urdu-medium books, not FBISE's: those keep science
 * terms as transliterated English ("سیل سائیکل"), so the model is shown the
 * printed names already in each subject and asked to match them.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { C, ROOT, askJson, loadEnv, scrubDashes } from './pdf-vision.mjs';

const OUT = resolve(ROOT, 'data/punjab/urdu-titles.json');
const catalogue = JSON.parse(await readFile(resolve(ROOT, 'data/punjab/catalogue.json'), 'utf8'));
const missing = catalogue.chapters.filter((c) => !c.urduTitle);
if (!missing.length) {
  console.log(C.green('  every chapter already has an Urdu name'));
  process.exit(0);
}

const examples = (subject) =>
  catalogue.chapters
    .filter((c) => c.subject === subject && c.urduTitle)
    .slice(0, 8)
    .map((c) => `  ${c.title} = ${c.urduTitle}`)
    .join('\n');

const bySubject = new Map();
for (const c of missing) {
  if (!bySubject.has(c.subject)) bySubject.set(c.subject, []);
  bySubject.get(c.subject).push(c);
}

const prompt = `Give an Urdu chapter name for each Pakistani school textbook chapter below, the way a Punjab board Urdu-medium textbook would print it.

Rules:
- Urdu script only. No Latin letters, no em dash, no quotation marks.
- Science and computer terms follow the Punjab Urdu-medium books: common English technical words are transliterated into Urdu script (for example Cell Cycle = سیل سائیکل), exactly as the printed names shown for that subject do. Match their style.
- For English literature lessons and poems, give the Urdu rendering of the title's meaning, keeping proper names (people, places) as they are pronounced.
- Keep it as short as the English title. Do not add words like "chapter" or "باب".

${[...bySubject]
  .map(
    ([subject, list]) =>
      `SUBJECT ${subject}\nPrinted Urdu names already in this subject, for style:\n${examples(subject) || '  (none)'}\nName these:\n${list.map((c) => `  ${c.id}: ${c.title}`).join('\n')}`,
  )
  .join('\n\n')}

Return ONLY JSON, no prose, no code fence: { "titles": { "<chapter id>": "<Urdu name>" } }`;

const env = await loadEnv();
const reply = scrubDashes(await askJson(env, { system: 'You name textbook chapters in Urdu for Pakistani students. You follow the style you are shown.', prompt, maxTokens: 8000, effort: 'low' }));

const titles = {};
const problems = [];
for (const c of missing) {
  const t = reply.titles?.[c.id]?.trim();
  if (!t) problems.push(`${c.id}: no name`);
  else if (/[A-Za-z]/.test(t) || !/[؀-ۿ]/.test(t)) problems.push(`${c.id}: not Urdu script (${t})`);
  else titles[c.id] = t;
}
if (problems.length) {
  console.log(C.red(`  ${problems.length} unusable:`));
  for (const p of problems) console.log(C.red(`    ${p}`));
}

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      note: 'Translated Urdu chapter names for Punjab chapters no Urdu-medium book names. Not printed titles. Used only where no book supplies one.',
      titles,
    },
    null,
    1,
  )}\n`,
);
console.log(`${C.green('  ok')} ${Object.keys(titles).length} of ${missing.length} named, in data/punjab/urdu-titles.json`);
