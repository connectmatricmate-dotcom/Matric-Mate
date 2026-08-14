#!/usr/bin/env node
/**
 * Seed the Grade 10 (SSC-II) chapter catalog and learning outcomes.
 *
 *   node scripts/seed-ssc2-chapters.mjs            write chapters + SLOs
 *   node scripts/seed-ssc2-chapters.mjs --dry-run  print what would be written
 *
 * Grade 9's catalog lives in packages/core (the bundle doubles as the offline
 * fallback); grade 10 is database-first by design, so its single source of
 * truth is data/fbise/chapters-ssc2.json, authored from the board's SSC-II
 * Tables of Specification. Chapter ids are <subject>-10-<number>, keeping the
 * subject prefix every parser in the app relies on.
 *
 * Chapters are seeded as PUBLISHED: a chapter row is the shelf, not the
 * goods. Row level security keeps it invisible to every grade-9 account
 * (chapters.grade vs profiles.grade), and it holds no content until the
 * generator writes some. Idempotent: upserts on id, safe to rerun.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const envText = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const spec = JSON.parse(await readFile(resolve(ROOT, 'data/fbise/chapters-ssc2.json'), 'utf8'));

const chapters = [];
for (const [subjectId, s] of Object.entries(spec.subjects)) {
  for (const ch of s.chapters) {
    chapters.push({
      id: `${subjectId}-10-${ch.number}`,
      subject_id: subjectId,
      number: ch.number,
      grade: 10,
      board_unit: null,
      exam_marks: ch.marks ?? null,
      exam_share: ch.share ?? null,
      title: ch.titleEn ?? ch.title,
      urdu_title: ch.urduTitle ?? null,
      blurb: ch.blurb,
      premium: true,
      audio_minutes: 0,
      review_status: 'published',
    });
  }
}

// Learning outcomes, from the grade-10 curriculum docs beside the spec.
const slos = [];
const dataDir = resolve(ROOT, 'data/fbise/ssc2');
for (const f of (await readdir(dataDir)).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
  const doc = JSON.parse(await readFile(resolve(dataDir, f), 'utf8'));
  for (const d of doc.domains ?? []) {
    for (const s of d.slos) {
      slos.push({
        code: s.code,
        subject_id: doc.subject,
        domain: d.code,
        sub_domain: null,
        title: d.title ?? null,
        text: s.text,
        cognitive: s.cognitive ?? null,
        assessment: s.assessment ?? null,
        chapter_id: null,
      });
    }
  }
}

console.log(C.bold(`\n  ${chapters.length} chapters, ${slos.length} outcomes${DRY ? ' (dry run)' : ''}\n`));
if (DRY) {
  for (const c of chapters.slice(0, 8)) console.log(C.dim(`  ${c.id}  ${c.title}  share=${c.exam_share}`));
  process.exit(0);
}

for (let i = 0; i < chapters.length; i += 50) {
  const { error } = await db.from('chapters').upsert(chapters.slice(i, i + 50), { onConflict: 'id' });
  if (error) {
    console.error(C.red(`chapters: ${error.message}`));
    process.exit(1);
  }
}
console.log(`${C.green('  ok')} chapters seeded`);

for (let i = 0; i < slos.length; i += 100) {
  const { error } = await db.from('curriculum_slos').upsert(slos.slice(i, i + 100), { onConflict: 'code' });
  if (error) {
    console.error(C.red(`curriculum_slos: ${error.message}`));
    process.exit(1);
  }
}
console.log(`${C.green('  ok')} outcomes seeded\n`);
