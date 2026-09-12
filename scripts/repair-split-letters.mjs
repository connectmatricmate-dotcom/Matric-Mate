#!/usr/bin/env node
/**
 * Put back the letters a broken stream decoder cut in half.
 *
 *   node scripts/repair-split-letters.mjs --dry-run   say what would change
 *   node scripts/repair-split-letters.mjs             change it, keeping a backup
 *
 * WHY THIS EXISTS
 *
 * generate-content.mjs and pdf-vision.mjs read the model's reply as a stream
 * and decoded each network chunk on its own. An Urdu letter is two bytes; when
 * a chunk ended between them, each half came out as U+FFFD, so a student read
 * "ذمہ دار" with its د replaced by two marks. 204 study rows and one Punjab
 * outcome were written that way between 14 August and 11 September. Both
 * readers now use one streaming decoder, which cannot do this.
 *
 * The bytes are gone, so the letters cannot be recovered mechanically. Each
 * one was read back from the words around it and recorded in
 * data/split-letter-repairs.json, keyed by the text either side of the break.
 * This applies them, to the database and to the generator's own JSON on disk,
 * and refuses any change that is not exactly "one pair of marks becomes one
 * letter": a repaired string must equal the original with each pair swapped
 * for a single character, in the Arabic-script block unless the map says
 * otherwise (a superscript two and a degree sign turned up in two English
 * rows). One entry in the map is a whole phrase instead, where the model
 * itself wrote a stray word inside a unit; it is listed on its own.
 *
 * FBISE Islamiyat in English medium is left alone: it is being replaced by a
 * real English translation, and this would only be overwritten.
 *
 * Every row changed is saved to content/.split-letter-backup/ first, and every
 * file on disk is copied there before it is rewritten.
 */

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import dns from 'node:dns';
import net from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DRY = process.argv.includes('--dry-run');
const PAIR = '\uFFFD\uFFFD';
const WINDOW = 12;
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP = resolve(ROOT, 'content/.split-letter-backup', STAMP);

/** Rows the English Islamiyat translation is about to replace. */
const replacedSoon = (row) => row.medium === 'en' && /^isl-(10-)?[1-7]$/.test(row.chapter_id ?? '');

/* ------------------------------------------------------------ the letters */

const map = JSON.parse(await readFile(resolve(ROOT, 'data/split-letter-repairs.json'), 'utf8'));
const entries = map.letters.map((e) => {
  const at = e.context.indexOf(PAIR);
  if (at === -1 || [...e.letter].length !== 1) throw new Error(`bad map entry: ${JSON.stringify(e)}`);
  return { ...e, left: e.context.slice(0, at), right: e.context.slice(at + 2) };
});
const byContext = new Map(entries.map((e) => [e.context, e.letter]));

/**
 * The letter for the pair at `at` in `s`: the recorded context first, then a
 * narrower window if the text has since changed a little nearby (a dash
 * scrubbed to a comma a few letters away), accepted only if every entry that
 * fits agrees.
 */
function letterFor(s, at) {
  const exact = byContext.get(s.slice(Math.max(0, at - WINDOW), at + 2 + WINDOW));
  if (exact) return exact;
  for (let w = WINDOW - 2; w >= 4; w--) {
    const left = s.slice(Math.max(0, at - w), at);
    const right = s.slice(at + 2, at + 2 + w);
    const fits = entries.filter((e) => e.left.endsWith(left) && e.right.startsWith(right));
    const letters = new Set(fits.map((e) => e.letter));
    if (letters.size === 1) return [...letters][0];
    if (letters.size > 1) return null; // the words either side do not settle it
  }
  return null;
}

const ARABIC = /^[\u0600-\u06FF]$/u;
const allowedOther = new Set(['\u00B2', '\u00B0']); // superscript two, degree sign

/** Repair one string, or say exactly why not. */
function repair(s) {
  let out = s;
  const notes = [];
  for (const w of map.whole) {
    if (out.includes(w.broken)) {
      out = out.split(w.broken).join(w.fixed);
      notes.push(`phrase: ${w.fixed}`);
    }
  }
  const placed = [];
  out = out.replace(/\uFFFD\uFFFD/g, (m, at, str) => {
    const letter = letterFor(str, at);
    if (!letter) return m;
    placed.push(letter);
    return letter;
  });
  // The proof: the original, with each pair swapped for the letter recorded
  // for it, and nothing else, is what we are about to write.
  let k = 0;
  let expected = s;
  for (const w of map.whole) expected = expected.split(w.broken).join(w.fixed);
  expected = expected.replace(/\uFFFD\uFFFD/g, (m) => (k < placed.length ? placed[k++] : m));
  if (expected !== out) throw new Error(`repair is not a pure substitution: ${s.slice(0, 80)}`);
  for (const letter of placed) {
    if (!ARABIC.test(letter) && !allowedOther.has(letter)) throw new Error(`"${letter}" is not a letter this map may place`);
    if (!ARABIC.test(letter)) notes.push(`non-Arabic letter U+${letter.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
  }
  return { out, placed: placed.length, left: (out.match(/\uFFFD/g) ?? []).length, notes };
}

/** Repair every string inside a value (text, array or JSON), counting as it goes. */
function repairValue(value, tally) {
  if (typeof value === 'string') {
    if (!value.includes('\uFFFD')) return value;
    const r = repair(value);
    tally.placed += r.placed;
    tally.left += r.left;
    tally.notes.push(...r.notes);
    if (r.left) tally.unresolved.push(value.slice(Math.max(0, value.indexOf('\uFFFD') - 30), value.indexOf('\uFFFD') + 30));
    return r.out;
  }
  if (Array.isArray(value)) return value.map((v) => repairValue(v, tally));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairValue(v, tally)]));
  return value;
}

/* ----------------------------------------------------------- the database */

const TABLES = {
  chapter_sections: { key: ['id'], fields: ['title', 'blocks'], scoped: true },
  mcqs: { key: ['id'], fields: ['q', 'options', 'explanation', 'topic'], scoped: true },
  flashcards: { key: ['id'], fields: ['front', 'back'], scoped: true },
  short_questions: { key: ['id'], fields: ['q', 'answer', 'points'], scoped: true },
  blanks: { key: ['id'], fields: ['before_text', 'after_text', 'answer', 'options'], scoped: true },
  audio_tracks: { key: ['id'], fields: ['title'], scoped: true },
  cheat_sheets: { key: ['chapter_id', 'medium'], fields: ['body'], scoped: true },
  curriculum_slos: { key: ['code'], fields: ['title', 'text'] },
  chapters: { key: ['id'], fields: ['title', 'urdu_title', 'blurb', 'urdu_blurb'] },
};

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/** Every row of a table, a page at a time: select() stops at 1000 without saying so. */
async function all(table, columns, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order(order).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const tally = { placed: 0, left: 0, notes: [], unresolved: [] };
const backup = {};
let rowsChanged = 0;
let rowsSkipped = 0;
for (const [table, { key, fields, scoped }] of Object.entries(TABLES)) {
  const columns = [...new Set([...key, ...(scoped ? ['chapter_id', 'medium'] : []), ...fields])].join(',');
  const rows = (await all(table, columns, key[0])).filter((r) => fields.some((f) => JSON.stringify(r[f] ?? '').includes('\uFFFD')));
  const todo = rows.filter((r) => !(scoped && replacedSoon(r)));
  rowsSkipped += rows.length - todo.length;
  const patches = [];
  for (const row of todo) {
    const patch = {};
    for (const f of fields) {
      if (row[f] == null) continue;
      const fixed = repairValue(row[f], tally);
      if (JSON.stringify(fixed) !== JSON.stringify(row[f])) patch[f] = fixed;
    }
    if (Object.keys(patch).length) patches.push({ row, patch });
  }
  console.log(`  ${table.padEnd(17)} ${String(rows.length).padStart(3)} rows carry a broken letter, ${patches.length} to repair${rows.length - todo.length ? C.dim(`, ${rows.length - todo.length} left for the English Islamiyat rewrite`) : ''}`);
  if (!patches.length) continue;
  backup[table] = patches.map((p) => p.row);
  if (DRY) continue;
  await mkdir(BACKUP, { recursive: true });
  await writeFile(resolve(BACKUP, `${table}.json`), `${JSON.stringify(backup[table], null, 1)}\n`);
  for (const { row, patch } of patches) {
    let q = db.from(table).update(patch);
    for (const k of key) q = q.eq(k, row[k]);
    const { error } = await q;
    if (error) throw new Error(`${table} ${key.map((k) => row[k]).join('/')}: ${error.message}`);
    rowsChanged++;
  }
}

/* ------------------------------------------------------------ files on disk */

/**
 * The generator's own copies, which a --from-disk run or a later review
 * reads, and the Punjab catalogue the outcomes were seeded from. Superseded
 * copies, audio scripts and briefs are not sources of anything and are left.
 */
async function sources() {
  const out = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!['superseded-wrong-language', 'audio', 'briefs'].includes(e.name)) await walk(full);
      } else if (e.name.endsWith('.json')) out.push(full);
    }
  };
  await walk(resolve(ROOT, 'content/generated'));
  await walk(resolve(ROOT, 'data/punjab/outcomes'));
  out.push(resolve(ROOT, 'data/punjab/catalogue.json'));
  // The English Islamiyat files are being rewritten by hand right now.
  return out.filter((f) => !/content\/generated\/(ssc2\/)?isl-(10-)?[1-7]-en\.json$/.test(f));
}

let filesChanged = 0;
const fileTally = { placed: 0, left: 0, notes: [], unresolved: [] };
for (const file of await sources()) {
  const text = await readFile(file, 'utf8');
  if (!text.includes('\uFFFD')) continue;
  const doc = JSON.parse(text);
  // Written back exactly as it was laid out, or not at all.
  const indent = /^[[{]\n( +)/.exec(text)?.[1]?.length ?? 1;
  const layout = (v) => `${JSON.stringify(v, null, indent)}${text.endsWith('\n') ? '\n' : ''}`;
  if (layout(doc) !== text) {
    console.log(C.yellow(`  skip ${relative(ROOT, file)}: its layout would not survive a rewrite`));
    continue;
  }
  const fixed = repairValue(doc, fileTally);
  const next = layout(fixed);
  if (next === text) continue;
  filesChanged++;
  if (DRY) continue;
  const copy = resolve(BACKUP, 'files', relative(ROOT, file));
  await mkdir(dirname(copy), { recursive: true });
  await copyFile(file, copy);
  await writeFile(file, next);
}

/* ------------------------------------------------------------------ report */

const all2 = [...tally.notes, ...fileTally.notes];
const counts = all2.reduce((m, n) => ((m[n] = (m[n] ?? 0) + 1), m), {});
console.log(`\n  database: ${tally.placed} letters placed in ${DRY ? Object.values(backup).flat().length : rowsChanged} rows${rowsSkipped ? `, ${rowsSkipped} rows left for the Islamiyat rewrite` : ''}`);
console.log(`  on disk:  ${fileTally.placed} letters placed in ${filesChanged} files`);
for (const [n, c] of Object.entries(counts)) console.log(C.dim(`    ${c} x ${n}`));
const unresolved = [...tally.unresolved, ...fileTally.unresolved];
if (unresolved.length) {
  console.log(C.yellow(`\n  ${unresolved.length} breaks with no recorded letter, left as they are:`));
  for (const u of unresolved.slice(0, 20)) console.log(C.yellow(`    ${u.replace(/\n/g, ' ')}`));
}
console.log(DRY ? C.dim('\n  dry run, nothing changed\n') : `${C.green('\n  ok')} originals in ${relative(ROOT, BACKUP)}/\n`);
