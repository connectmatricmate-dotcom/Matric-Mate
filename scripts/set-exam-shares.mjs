#!/usr/bin/env node
/**
 * Put every FBISE chapter's weight on the annual paper in the database.
 *
 *   node scripts/set-exam-shares.mjs --dry-run   list what would change
 *   node scripts/set-exam-shares.mjs             change it, keeping a backup
 *
 * exam_share drives the "% of the paper" badge and how the AI mock paper
 * spreads its questions, and it had drifted from the board's tables:
 * Pakistan Studies Class 9 carried one share against seven blanks, so the mock
 * paper drew nearly every MCQ from that chapter; the chapters the board does
 * not examine (Class 9 Maths 1, 10 and 13, English and Urdu oral skills)
 * were null, which now means "weight unknown" rather than "not on the paper".
 *
 * The seeders (ingest-content.mjs for Class 9, seed-ssc2-chapters.mjs for
 * Class 10) write the same numbers by the same rules, from exam-weights.mjs,
 * but running them also rewrites titles, blurbs and publish state. This
 * touches exam_marks and exam_share and nothing else. Punjab chapters are left
 * alone: the Punjab boards publish no table of specification.
 *
 * Every row changed is saved to content/.exam-share-backup/ first.
 */

import dns from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { weightsFor } from './exam-weights.mjs';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DRY = process.argv.includes('--dry-run');
const BACKUP = resolve(ROOT, 'content/.exam-share-backup', new Date().toISOString().replace(/[:.]/g, '-'));

const specs = {
  9: JSON.parse(await readFile(resolve(ROOT, 'data/fbise/chapters.json'), 'utf8')).subjects,
  10: JSON.parse(await readFile(resolve(ROOT, 'data/fbise/chapters-ssc2.json'), 'utf8')).subjects,
};
const weights = Object.fromEntries(
  Object.entries(specs).map(([grade, subjects]) => [grade, Object.fromEntries(Object.entries(subjects).map(([id, s]) => [id, weightsFor(s)]))]),
);

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: chapters, error } = await db
  .from('chapters')
  .select('id,subject_id,grade,number,title,exam_marks,exam_share')
  .eq('board', 'fbise')
  .order('id')
  .range(0, 999);
if (error) throw new Error(error.message);

const num = (v) => (v === null || v === undefined ? null : Number(v));
const changes = [];
for (const c of chapters) {
  const want = weights[c.grade]?.[c.subject_id]?.get(c.number) ?? { marks: null, share: null };
  if (num(c.exam_marks) !== num(want.marks) || num(c.exam_share) !== num(want.share)) changes.push({ row: c, patch: { exam_marks: want.marks, exam_share: want.share } });
}

const show = (v) => (v === null || v === undefined ? 'null' : String(Number(v)));
console.log(`  ${changes.length} of ${chapters.length} FBISE chapters change`);
for (const { row, patch } of changes) {
  console.log(`    ${row.id.padEnd(10)} share ${show(row.exam_share).padStart(5)} -> ${show(patch.exam_share).padEnd(5)} marks ${show(row.exam_marks).padStart(4)} -> ${show(patch.exam_marks).padEnd(4)} ${C.dim(row.title)}`);
}

// What the paper looks like afterwards, subject by subject.
const after = new Map(chapters.map((c) => [c.id, { ...c, ...(changes.find((x) => x.row.id === c.id)?.patch ?? {}) }]));
const bySubject = {};
for (const c of after.values()) (bySubject[`${c.grade} ${c.subject_id}`] ??= []).push(c);
console.log(C.dim('\n  after, per subject: weighed / not examined (0) / no weight published (null)'));
for (const [key, list] of Object.entries(bySubject).sort()) {
  const weighed = list.filter((c) => num(c.exam_share) > 0);
  const zero = list.filter((c) => num(c.exam_share) === 0).map((c) => c.id);
  const none = list.filter((c) => c.exam_share === null || c.exam_share === undefined).map((c) => c.id);
  const sum = weighed.reduce((t, c) => t + num(c.exam_share), 0);
  console.log(`    ${key.padEnd(8)} ${String(weighed.length).padStart(2)} weighed (sum ${sum.toFixed(1).padStart(5)})${zero.length ? `, 0: ${zero.join(' ')}` : ''}${none.length ? `, null: ${none.length === list.length ? 'all' : none.join(' ')}` : ''}`);
}

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
