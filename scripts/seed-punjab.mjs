#!/usr/bin/env node
/**
 * Put the Punjab catalogue into the database: chapters and their outcomes.
 *
 *   node scripts/seed-punjab.mjs             write
 *   node scripts/seed-punjab.mjs --dry-run   print what would be written
 *   node scripts/seed-punjab.mjs --prune     also delete Punjab outcomes the catalogue no longer has
 *
 * Source: data/punjab/catalogue.json, from scripts/build-punjab-catalogue.mjs.
 * Idempotent: upserts on id and code, safe to rerun whenever a book is re-read
 * or a missing one arrives.
 *
 * CHAPTERS ARRIVE AS DRAFT, AND A RE-RUN NEVER CHANGES THAT
 *
 * The upsert names only the columns the catalogue owns: identity, title, Urdu
 * title, blurb. A new row takes every other column's default, which for
 * review_status is draft; an existing row keeps what it has, so re-seeding can
 * never unpublish a live chapter or zero an audio duration or exam weight set
 * later by another script.
 *
 * Draft matters beyond row level security. The service-key reads behind the
 * AI mock paper, the tutor's syllabus context and the content audits all
 * filter on published, so until Punjab is switched on properly its chapters
 * stay out of every FBISE student's AI answers, not just their chapter lists.
 * Publishing a subject is a deliberate update once its content is in.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

const DRY = process.argv.includes('--dry-run');
const PRUNE = process.argv.includes('--prune');

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const catalogue = JSON.parse(await readFile(resolve(ROOT, 'data/punjab/catalogue.json'), 'utf8'));

const chapters = catalogue.chapters.map((c) => ({
  id: c.id,
  subject_id: c.subject,
  number: c.number,
  grade: c.grade,
  board: 'punjab',
  title: c.title,
  urdu_title: c.urduTitle ?? null,
  blurb: c.blurb ?? '',
}));

const titleOf = new Map(catalogue.chapters.map((c) => [c.id, c.title]));
const slos = catalogue.slos.map((s) => ({
  code: s.code,
  subject_id: s.subject,
  domain: `C${s.chapter}`,
  sub_domain: null,
  title: titleOf.get(s.chapterId) ?? null,
  text: s.text,
  // Neither is printed in the books. Null says "not stated", which the
  // generator reads as unspecified rather than as unexamined.
  cognitive: null,
  assessment: null,
  chapter_id: s.chapterId,
  board: 'punjab',
  origin: s.origin,
}));

/** Every row of a select, a page at a time: PostgREST stops at 1000 without saying so. */
async function all(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

console.log(C.dim(`\n  ${chapters.length} chapters, ${slos.length} outcomes in the catalogue${DRY ? ' (dry run)' : ''}\n`));

const existingChapters = await all(() => db.from('chapters').select('id,review_status').eq('board', 'punjab').order('id'));
const existingCodes = await all(() => db.from('curriculum_slos').select('code').eq('board', 'punjab').order('code'));
const have = new Set(existingChapters.map((r) => r.id));
const fresh = chapters.filter((c) => !have.has(c.id));
const catalogued = new Set(chapters.map((c) => c.id));
const orphanChapters = existingChapters.filter((r) => !catalogued.has(r.id));
const wanted = new Set(slos.map((s) => s.code));
const staleCodes = existingCodes.map((r) => r.code).filter((code) => !wanted.has(code));

console.log(`  chapters: ${fresh.length} new, ${chapters.length - fresh.length} already there`);
const haveCodes = new Set(existingCodes.map((r) => r.code));
console.log(`  outcomes: ${slos.filter((s) => !haveCodes.has(s.code)).length} new, ${staleCodes.length} no longer in the catalogue`);
if (orphanChapters.length) {
  // Never deleted here: attempts, progress and content point at chapter ids.
  console.log(C.yellow(`  ${orphanChapters.length} Punjab chapters in the database are not in the catalogue: ${orphanChapters.map((r) => r.id).join(', ')}`));
}

if (DRY) {
  for (const c of fresh.slice(0, 6)) console.log(C.dim(`    + ${c.id}  ${c.title}`));
  process.exit(0);
}

for (let i = 0; i < chapters.length; i += 100) {
  const { error } = await db.from('chapters').upsert(chapters.slice(i, i + 100), { onConflict: 'id' });
  if (error) {
    console.error(C.red(`  chapters: ${error.message}`));
    process.exit(1);
  }
}
for (let i = 0; i < slos.length; i += 200) {
  const { error } = await db.from('curriculum_slos').upsert(slos.slice(i, i + 200), { onConflict: 'code' });
  if (error) {
    console.error(C.red(`  curriculum_slos: ${error.message}`));
    process.exit(1);
  }
}

if (PRUNE && staleCodes.length) {
  // Questions keep their rows; their slo_code goes null (on delete set null).
  for (let i = 0; i < staleCodes.length; i += 200) {
    const { error } = await db.from('curriculum_slos').delete().in('code', staleCodes.slice(i, i + 200));
    if (error) {
      console.error(C.red(`  prune: ${error.message}`));
      process.exit(1);
    }
  }
  console.log(C.yellow(`  pruned ${staleCodes.length} outcomes`));
}

// Read it back rather than trust the calls: count what the database now holds.
const after = await all(() => db.from('chapters').select('id,review_status').eq('board', 'punjab').order('id'));
const afterCodes = await all(() => db.from('curriculum_slos').select('code').eq('board', 'punjab').order('code'));
const published = after.filter((r) => r.review_status === 'published').length;
console.log(`${C.green('  ok')} ${after.length} Punjab chapters (${published} published, ${after.length - published} draft), ${afterCodes.length} outcomes\n`);
