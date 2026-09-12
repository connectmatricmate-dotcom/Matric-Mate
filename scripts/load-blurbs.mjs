#!/usr/bin/env node
/**
 * Put the chapter blurbs written by hand into the database.
 *
 *   node scripts/load-blurbs.mjs --dry-run   list what would change
 *   node scripts/load-blurbs.mjs             change it, keeping a backup
 *
 * Two files, both read in full every run so the database always matches them:
 *
 *   data/urdu-blurbs.json     chapters.urdu_blurb for every chapter, the line
 *                             the Urdu interface shows under a chapter's name.
 *                             The column was added empty, so an Urdu reader saw
 *                             an English line under every Urdu title.
 *   data/punjab/blurbs.json   chapters.blurb for the Punjab chapters whose line
 *                             from the book's contents page was empty, a bare
 *                             author's name, a theme label or garbled: 23 empty
 *                             and 32 under forty characters when this was
 *                             written, all twenty Urdu Class 10 lessons among
 *                             them.
 *
 * FBISE English blurbs are not touched here; they come from packages/core
 * (Class 9) and data/fbise/chapters-ssc2.json (Class 10) through their
 * seeders. Nothing is ever blanked: a chapter missing from a file keeps what
 * it has. Every row changed is saved to content/.blurb-backup/ first.
 */

import dns from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DRY = process.argv.includes('--dry-run');
const BACKUP = resolve(ROOT, 'content/.blurb-backup', new Date().toISOString().replace(/[:.]/g, '-'));

const urdu = JSON.parse(await readFile(resolve(ROOT, 'data/urdu-blurbs.json'), 'utf8')).blurbs;
const punjab = JSON.parse(await readFile(resolve(ROOT, 'data/punjab/blurbs.json'), 'utf8')).blurbs;

// The house rules, checked before anything is written.
const problems = [];
for (const [id, text] of Object.entries(urdu)) {
  if (!text?.trim()) problems.push(`${id}: empty Urdu blurb`);
  if (text.includes('\u2014')) problems.push(`${id}: em dash`);
  if (/[A-Za-z]/.test(text)) problems.push(`${id}: Latin letters in the Urdu blurb`);
}
for (const [id, text] of Object.entries(punjab)) {
  if (!id.includes('-pj-')) problems.push(`${id}: not a Punjab chapter`);
  if (!text?.trim()) problems.push(`${id}: empty blurb`);
  if (text.includes('\u2014')) problems.push(`${id}: em dash`);
}
if (problems.length) {
  console.error(C.red(`  refusing to load:\n    ${problems.join('\n    ')}`));
  process.exit(1);
}

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: chapters, error } = await db.from('chapters').select('id,board,blurb,urdu_blurb').order('id').range(0, 999);
if (error) throw new Error(error.message);

const known = new Set(chapters.map((c) => c.id));
const strays = [...Object.keys(urdu), ...Object.keys(punjab)].filter((id) => !known.has(id));
if (strays.length) console.log(C.yellow(`  ${strays.length} ids in the files are not chapters: ${strays.join(', ')}`));

const changes = [];
for (const c of chapters) {
  const patch = {};
  if (urdu[c.id] && urdu[c.id] !== c.urdu_blurb) patch.urdu_blurb = urdu[c.id];
  if (c.board === 'punjab' && punjab[c.id] && punjab[c.id] !== c.blurb) patch.blurb = punjab[c.id];
  if (Object.keys(patch).length) changes.push({ row: c, patch });
}
const missing = chapters.filter((c) => !urdu[c.id] && !c.urdu_blurb).map((c) => c.id);

console.log(`  ${changes.filter((x) => x.patch.urdu_blurb).length} Urdu blurbs and ${changes.filter((x) => x.patch.blurb).length} Punjab English blurbs to write, ${chapters.length} chapters`);
for (const { row, patch } of changes.filter((x) => x.patch.blurb).slice(0, 6)) {
  console.log(C.dim(`    ${row.id}: ${JSON.stringify(row.blurb)} -> ${JSON.stringify(patch.blurb).slice(0, 90)}`));
}
if (missing.length) console.log(C.yellow(`  ${missing.length} chapters still have no Urdu blurb: ${missing.join(', ')}`));

if (DRY || !changes.length) {
  console.log(C.dim(`\n  ${DRY ? 'dry run, nothing changed' : 'nothing to change'}\n`));
  process.exit(0);
}
await mkdir(BACKUP, { recursive: true });
await writeFile(resolve(BACKUP, 'chapters.json'), `${JSON.stringify(changes.map((c) => c.row), null, 1)}\n`);
for (const { row, patch } of changes) {
  const { error: e } = await db.from('chapters').update(patch).eq('id', row.id);
  if (e) throw new Error(`${row.id}: ${e.message}`);
}
console.log(`${C.green('\n  ok')} ${changes.length} chapters updated, originals in ${relative(ROOT, BACKUP)}/\n`);
