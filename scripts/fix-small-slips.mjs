#!/usr/bin/env node
/**
 * The small slips a content audit found, put right in one pass.
 *
 *   node scripts/fix-small-slips.mjs --dry-run   list what would change
 *   node scripts/fix-small-slips.mjs             change it, keeping a backup
 *
 * None of these is big enough for a script of its own, and each one is also
 * fixed where it came from, so a re-seed or a rewrite does not bring it back:
 *
 *   1. Chapter titles ending in a full stop: 22 FBISE Islamiyat and Urdu
 *      chapters read "Reading." and "Quran and Hadith." in every list. The
 *      Class 10 source (data/fbise/chapters-ssc2.json) is corrected, and both
 *      seeders now drop a closing full stop from any title they write.
 *   2. Em dashes in the curriculum outcomes (10 FBISE rows, copied from the
 *      board's PDFs) and in the one cached cheat sheet that had one. In the
 *      outcomes a dash joins two words ("speed-time graph"), stands for a minus
 *      sign, or separates a list, so each gets the mark it stood for rather
 *      than one blanket comma; data/fbise/*.json gets the same treatment.
 *   3. Blanks with no outcome code: six Urdu-medium blanks in cs-10-4 and the
 *      twelve in urd-pj-10-11. Every other question in those chapters carries
 *      one, and each of these was matched to the outcome it tests by reading
 *      it; the generator's JSON on disk gets the codes too.
 *   4. A capitalisation blank whose "wrong" chips included "Ravi river", which
 *      many style guides accept. It becomes "ravi River", unambiguously wrong.
 *      The other case-variant chips in these blanks ("lahore" beside
 *      "Lahore") are the point of a capitalisation question and stay: the
 *      apps compare answers exactly.
 *
 * Every row changed is saved to content/.small-slips-backup/ first.
 */

import dns from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { dirname, relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { dashless, orderBlankOptions } from './content-rules.mjs';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DRY = process.argv.includes('--dry-run');
const BACKUP = resolve(ROOT, 'content/.small-slips-backup', new Date().toISOString().replace(/[:.]/g, '-'));
const DASH = '\u2014';

/** An outcome's em dashes, each as the mark it stood for, in the database and in data/fbise alike. */
function outcomeDashes(text) {
  if (typeof text !== 'string' || !text.includes(DASH)) return text;
  return text
    .replace(/a\u2014CH2\u2014 unit/g, 'a -CH2- unit')
    .replace(/-\u2014/g, '-')
    .replace(/(\p{L})\u2014 ?(?=\p{L})/gu, '$1-')
    .replace(/ \u2014 (?=[\u{1D400}-\u{1D7FF}])/gu, ' \u2212 ')
    .replace(/(radio waves|microwaves|infrared|visible light|ultraviolet|X-rays|gamma rays) \u2014 /g, '$1: ')
    .replace(/\s*\u2014\s*/g, '; ');
}

/** A cheat sheet's: a heading keeps its shape with a colon, prose gets the comma. */
const sheetDashes = (body) =>
  body
    .split('\n')
    .map((line) => (/^#+\s/.test(line) ? line.replace(/\s*\u2014\s*/g, ': ') : dashless(line)))
    .join('\n');

/** Blanks and the outcome each one tests, read one by one. */
const BLANK_CODES = {
  'cs-10-4-ur-1-b': 'CS-10-D-01', // machine learning
  'cs-10-4-ur-2-b': 'CS-10-D-01', // chatbots and image recognition are AI
  'cs-10-4-ur-3-b': 'CS-10-D-01', // unsupervised learning
  'cs-10-4-ur-4-b': 'CS-10-D-02', // primary key
  'cs-10-4-ur-5-b': 'CS-10-D-02', // what a box plot shows
  'cs-10-4-ur-6-b': 'CS-10-D-03', // first stage of the data science life cycle
  ...Object.fromEntries(
    ['en', 'ur'].flatMap((m) => [
      [`urd-pj-10-11-${m}-1-b`, 'PJ-URD-10-C11-S01'], // the story's theme: neglected elders
      [`urd-pj-10-11-${m}-2-b`, 'PJ-URD-10-C11-S02'], // why the family system is decaying
      [`urd-pj-10-11-${m}-3-b`, 'PJ-URD-10-C11-S04'], // the sketch as a prose form
      [`urd-pj-10-11-${m}-4-b`, 'PJ-URD-10-C11-S04'], // words with two meanings
      [`urd-pj-10-11-${m}-5-b`, 'PJ-URD-10-C11-S04'], // simile
      [`urd-pj-10-11-${m}-6-b`, 'PJ-URD-10-C11-S03'], // the old age home as a symbol
    ]),
  ),
};

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const must = async (q, what) => {
  const { data, error } = await q;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const plan = []; // { table, key, row, patch, why }

// 1. Titles.
for (const c of await must(db.from('chapters').select('id,title').order('id').range(0, 999), 'chapters')) {
  if (/\.\s*$/.test(c.title)) plan.push({ table: 'chapters', key: { id: c.id }, row: c, patch: { title: c.title.replace(/\.\s*$/, '') }, why: 'title' });
}

// 2. Em dashes in outcomes and cached cheat sheets.
const slos = [];
for (let from = 0; ; from += 1000) {
  const page = await must(db.from('curriculum_slos').select('code,title,text').order('code').range(from, from + 999), 'curriculum_slos');
  slos.push(...page);
  if (page.length < 1000) break;
}
for (const s of slos) {
  const patch = {};
  if (s.title?.includes(DASH)) patch.title = outcomeDashes(s.title);
  if (s.text?.includes(DASH)) patch.text = outcomeDashes(s.text);
  if (Object.keys(patch).length) plan.push({ table: 'curriculum_slos', key: { code: s.code }, row: s, patch, why: 'outcome dash' });
}
for (const sheet of await must(db.from('cheat_sheets').select('chapter_id,medium,body').order('chapter_id').range(0, 999), 'cheat_sheets')) {
  if (sheet.body?.includes(DASH)) {
    plan.push({ table: 'cheat_sheets', key: { chapter_id: sheet.chapter_id, medium: sheet.medium }, row: sheet, patch: { body: sheetDashes(sheet.body) }, why: 'cheat sheet dash' });
  }
}

// 3. Outcome codes for the blanks that lost them.
for (const b of await must(db.from('blanks').select('id,chapter_id,slo_code,answer,options').in('id', Object.keys(BLANK_CODES)), 'blanks')) {
  if (!b.slo_code) plan.push({ table: 'blanks', key: { id: b.id }, row: b, patch: { slo_code: BLANK_CODES[b.id] }, why: 'blank outcome' });
}

// 4. The ambiguous capitalisation chip.
for (const b of await must(db.from('blanks').select('id,answer,options').like('id', 'eng-pj-10-8-%-3-b'), 'blanks')) {
  if (!b.options.includes('Ravi river')) continue;
  const options = orderBlankOptions(b.id, b.options.map((o) => (o === 'Ravi river' ? 'ravi River' : o)), b.answer);
  plan.push({ table: 'blanks', key: { id: b.id }, row: b, patch: { options }, why: 'capitalisation chip' });
}

const counts = plan.reduce((m, p) => ((m[p.why] = (m[p.why] ?? 0) + 1), m), {});
console.log(`  ${plan.length} rows to change: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
for (const p of plan) {
  const [field, value] = Object.entries(p.patch)[0];
  const was = String(p.row[field] ?? '');
  const at = Math.max(0, was.indexOf(DASH) - 30);
  const show = (v) => JSON.stringify(typeof v === 'string' ? v.slice(field === 'text' || field === 'body' ? at : 0, (field === 'text' || field === 'body' ? at : 0) + 90) : v);
  console.log(C.dim(`    ${Object.values(p.key).join('/')}  ${field}: ${show(p.row[field])} -> ${show(value)}`));
}

/* ------------------------------------------------- the sources, on disk */

/**
 * The same fixes where the seeders and the generator read them from, so a
 * re-seed or a --from-disk rewrite does not undo them. Each file is written
 * back in exactly the layout it had, or not at all.
 */
const files = [];
const edit = async (rel, change) => {
  const path = resolve(ROOT, rel);
  const before = await readFile(path, 'utf8');
  const after = change(before);
  if (after !== before) files.push({ rel, path, before, after });
};
const asJson = (indent, change) => (text) => {
  const doc = JSON.parse(text);
  if (`${JSON.stringify(doc, null, indent)}\n` !== text) throw new Error('layout would not survive a rewrite');
  const next = change(doc);
  return `${JSON.stringify(next, null, indent)}\n`;
};
const deep = (fn) => (v) => (typeof v === 'string' ? fn(v) : Array.isArray(v) ? v.map(deep(fn)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(fn)(x)])) : v);

for (const rel of ['data/fbise/bio.json', 'data/fbise/chem.json', 'data/fbise/math.json', 'data/fbise/phy.json', 'data/fbise/ssc2/phy.json']) {
  await edit(rel, asJson(2, deep(outcomeDashes)));
}
// chapters-ssc2.json keeps a hand layout that JSON.stringify would not, so edit the lines.
await edit('data/fbise/chapters-ssc2.json', (t) => t.replace(/("titleEn": "[^"\n]*?)\.(",?)$/gm, '$1$2'));
// The generator's own copies of the blanks that lost their codes, matched by
// position and checked against the answer before anything is set.
const withCodes = (prefix) => (doc) => {
  (doc.blanks ?? []).forEach((b, i) => {
    const code = BLANK_CODES[`${prefix}-${i + 1}-b`];
    if (code && !b.slo_code) b.slo_code = code;
  });
  return doc;
};
await edit('content/generated/ssc2/cs-10-4-ur.json', asJson(1, withCodes('cs-10-4-ur')));
await edit('content/generated/punjab/grade-10/urd-pj-10-11-ur.json', asJson(1, withCodes('urd-pj-10-11-ur')));
await edit(
  'content/generated/punjab/grade-10/eng-pj-10-8-en.json',
  asJson(1, (doc) => {
    for (const b of doc.blanks ?? []) b.options = (b.options ?? []).map((o) => (o === 'Ravi river' ? 'ravi River' : o));
    return doc;
  }),
);
// The blanks matched by position must be the ones the database holds.
for (const [rel, prefix] of [
  ['content/generated/ssc2/cs-10-4-ur.json', 'cs-10-4-ur'],
  ['content/generated/punjab/grade-10/urd-pj-10-11-ur.json', 'urd-pj-10-11-ur'],
]) {
  const doc = JSON.parse((files.find((f) => f.rel === rel)?.after) ?? (await readFile(resolve(ROOT, rel), 'utf8')));
  const live = await must(db.from('blanks').select('id,answer').like('id', `${prefix}-%-b`), 'blanks');
  for (const row of live) {
    const i = Number(row.id.slice(prefix.length + 1).split('-')[0]) - 1;
    if (String(doc.blanks?.[i]?.answer ?? '').trim() !== String(row.answer).trim()) throw new Error(`${rel}: blank ${i + 1} is not ${row.id}`);
  }
}
console.log(`\n  ${files.length} source files to change: ${files.map((f) => f.rel).join(', ')}`);

if (DRY || (!plan.length && !files.length)) {
  console.log(C.dim(`\n  ${DRY ? 'dry run, nothing changed' : 'nothing to change'}\n`));
  process.exit(0);
}
await mkdir(BACKUP, { recursive: true });
await writeFile(resolve(BACKUP, 'rows.json'), `${JSON.stringify(plan.map(({ table, key, row }) => ({ table, key, row })), null, 1)}\n`);
for (const f of files) {
  const copy = resolve(BACKUP, 'files', f.rel);
  await mkdir(dirname(copy), { recursive: true });
  await writeFile(copy, f.before);
}
for (const p of plan) {
  let q = db.from(p.table).update(p.patch);
  for (const [k, v] of Object.entries(p.key)) q = q.eq(k, v);
  await must(q, `${p.table} ${Object.values(p.key).join('/')}`);
}
for (const f of files) await writeFile(f.path, f.after);
console.log(`${C.green('\n  ok')} ${plan.length} rows and ${files.length} files changed, originals in ${relative(ROOT, BACKUP)}/\n`);
