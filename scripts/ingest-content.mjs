#!/usr/bin/env node
/**
 * Load curriculum content into Postgres.
 *
 *   node scripts/ingest-content.mjs --dry-run     print the plan, touch nothing
 *   node scripts/ingest-content.mjs               write to Supabase
 *   node scripts/ingest-content.mjs --publish     …and mark chapters published
 *
 * Two sources, joined here:
 *
 *   packages/core/src/content.ts   subjects, chapters, and the sample study
 *                                  material the app ships with today
 *   data/fbise/*.json              the board's learning outcomes, from the
 *                                  SSC-I Assessment Frameworks
 *
 * Running it on an empty database leaves the app showing exactly what it shows
 * now, plus 561 real outcomes to generate against. That ordering is deliberate:
 * the fetch layer can move to the database before a single word of content has
 * been written, and nothing regresses on the day it does.
 *
 * WHAT IT WILL AND WILL NOT PUBLISH
 *
 * Chapters and subjects are structure, and structure is the board's, so those
 * go in published. Everything with prose in it goes in as 'draft' and stays
 * invisible to students until a person moves it on, because the study material
 * in content.ts is our own placeholder text and the material that replaces it
 * will be model-written. --publish only ever touches the structure tables.
 *
 * Upserts throughout, keyed on the text ids the app already uses, so a second
 * run is a no-op and a third after an edit is a correction. It never deletes:
 * a chapter that disappears from content.ts stays in the database until someone
 * looks at it, because unpublishing is reversible and dropping rows that
 * student attempts point at is not.
 */

import { spawn } from 'node:child_process';
import { readFile, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = resolve(ROOT, 'content/.core-build');
const DATA = resolve(ROOT, 'data/fbise');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const PUBLISH = args.includes('--publish');
/**
 * The placeholder study material from packages/core, off by default.
 *
 * It was the point of this script when nothing real existed. Now that
 * generate-content writes genuine, outcome-grounded content, pushing the
 * placeholder in as well collides with it: both want position 0 of the same
 * chapter and medium, and the whole run fails on a unique constraint. Worse,
 * where it did not collide it would sit alongside real content as filler.
 * Kept behind a flag for bootstrapping an empty database, nothing else.
 */
const WITH_SAMPLE = args.includes('--with-sample-content');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * packages/core is TypeScript with extensionless imports, which Node cannot
 * load directly and its type stripping does not fix. Rather than add a runtime
 * TS loader for one script, compile the package to plain ESM in a scratch
 * directory and import that. tsc is already a dependency of the package.
 */
async function loadCore() {
  await rm(BUILD, { recursive: true, force: true });
  const code = await new Promise((done) => {
    const p = spawn(
      resolve(ROOT, 'node_modules/.bin/tsc'),
      [
        '--outDir', BUILD,
        '--module', 'nodenext',
        '--moduleResolution', 'nodenext',
        '--target', 'es2022',
        '--skipLibCheck',
        '--resolveJsonModule',
        '--noEmitOnError', 'false',
        resolve(ROOT, 'packages/core/src/index.ts'),
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    p.on('close', done);
    p.on('error', () => done(1));
  });
  // tsc reports type errors on a package it is not configured for; the emit is
  // what matters, so only a missing output is fatal.
  //
  // The output path is not fixed. tsc infers rootDir from the widest common
  // ancestor of everything it compiles, so the day core started importing
  // data/fbise/papers.json from outside the package, the emit moved from
  // <build>/content.js to <build>/packages/core/src/content.js and this script
  // broke with a module-not-found. Find the file instead of assuming where it
  // landed.
  const entry = await findEmitted(BUILD, 'content.js');
  if (!entry) throw new Error(`tsc emitted no content.js under ${BUILD} (exit ${code})`);
  try {
    return await import(pathToFileURL(entry).href);
  } catch (e) {
    throw new Error(`could not load compiled core from ${entry} (tsc exit ${code}): ${e.message}`);
  }
}

/** Depth-first search for a compiled file, wherever tsc decided to put it. */
async function findEmitted(dir, name) {
  const { readdir } = await import('node:fs/promises');
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isFile() && e.name === name) return full;
    if (e.isDirectory()) {
      const hit = await findEmitted(full, name);
      if (hit) return hit;
    }
  }
  return null;
}

/** Read apps/web/.env.local without adding a dotenv dependency. */
async function loadEnv() {
  const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8').catch(() => '');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const chunk = (rows, n = 500) => {
  const out = [];
  for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n));
  return out;
};

async function main() {
  const core = await loadCore();
  const { SUBJECTS, CHAPTERS, ALL_CHAPTERS, contentFor } = core;

  // ── subjects ────────────────────────────────────────────────────────────
  const subjects = SUBJECTS.map((s, i) => ({
    id: s.id,
    name: s.name,
    urdu_name: s.urduName ?? null,
    icon: s.icon,
    compulsory: s.compulsory,
    study_group: s.group ?? null,
    sort_order: i,
    review_status: 'published',
  }));

  // ── chapters, with the board's own unit number where we know it ─────────
  const files = (await readdir(DATA)).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const curriculum = {};
  for (const f of files) {
    const doc = JSON.parse(await readFile(resolve(DATA, f), 'utf8'));
    curriculum[doc.subject] = doc;
  }

  // Mark weights from the board's Table of Specification, where we have read it.
  const spec = JSON.parse(await readFile(resolve(DATA, 'chapters.json'), 'utf8')).subjects ?? {};

  const chapters = ALL_CHAPTERS.map((c) => {
    const units = curriculum[c.subjectId]?.examUnits?.units;
    const weight = spec[c.subjectId]?.chapters?.find((x) => x.number === c.number);
    return {
      id: c.id,
      subject_id: c.subjectId,
      number: c.number,
      board_unit: units?.[c.number - 1]?.number ?? null,
      exam_marks: weight?.marks ?? null,
      exam_share: weight?.share ?? null,
      title: c.title,
      urdu_title: c.urduTitle ?? null,
      blurb: c.blurb,
      premium: c.premium,
      audio_minutes: c.audioMinutes,
      review_status: PUBLISH ? 'published' : 'draft',
    };
  });

  // A chapter list that has drifted from the board's is worth saying out loud.
  //
  // Compared against the Table of Specification, not against `examUnits`. The
  // unit lists come off the 2006 curriculum cover pages and were deliberately
  // superseded, so checking against them now reports every corrected subject as
  // broken. A subject with no ToS block recorded yet is skipped rather than
  // guessed at.
  const drift = [];
  for (const id of Object.keys(curriculum)) {
    const ours = CHAPTERS[id]?.length ?? 0;
    const theirs = spec[id]?.chapters?.length;
    // Mathematics differs on purpose: its ToS has only three broad domains, and
    // "Geometry" as a single chapter of thirty-one outcomes is not something a
    // student can revise from, so the seventeen units stay and the marks roll
    // down from the domain.
    if (id === 'math') continue;
    if (theirs && ours !== theirs) drift.push(`${id}: app has ${ours} chapters, the ToS has ${theirs}`);
  }

  // ── learning outcomes ───────────────────────────────────────────────────
  const slos = [];
  for (const doc of Object.values(curriculum)) {
    for (const d of doc.domains ?? []) {
      for (const s of d.slos) {
        slos.push({
          code: s.code,
          subject_id: doc.subject,
          domain: d.code,
          sub_domain: null,
          title: d.title,
          text: s.text,
          cognitive: s.cognitive,
          assessment: s.assessment,
          chapter_id: null,
        });
      }
    }
  }

  // ── the study material the app ships today ──────────────────────────────
  const sections = [];
  const mcqs = [];
  const flashcards = [];
  const shortQs = [];
  const blanks = [];

  for (const c of ALL_CHAPTERS) {
    const content = contentFor(c.id);
    content.sections.forEach((s, i) =>
      sections.push({
        id: s.id,
        chapter_id: c.id,
        medium: 'en',
        position: i,
        title: s.title,
        blocks: s.blocks,
        review_status: 'draft',
        source: 'ai',
      }),
    );
    (content.sectionsUr ?? []).forEach((s, i) =>
      sections.push({
        id: `${s.id}-ur`,
        chapter_id: c.id,
        medium: 'ur',
        position: i,
        title: s.title,
        blocks: s.blocks,
        review_status: 'draft',
        source: 'ai',
      }),
    );
    content.mcqs.forEach((m) =>
      mcqs.push({
        id: m.id,
        chapter_id: c.id,
        subject_id: c.subjectId,
        medium: 'en',
        topic: m.topic,
        q: m.q,
        options: m.options,
        answer: m.answer,
        explanation: m.explanation,
        difficulty: m.difficulty,
        review_status: 'draft',
        source: m.source === 'human' ? 'human' : 'ai',
      }),
    );
    content.flashcards.forEach((f) =>
      flashcards.push({
        id: f.id,
        chapter_id: c.id,
        medium: 'en',
        front: f.front,
        back: f.back,
        review_status: 'draft',
        source: 'ai',
      }),
    );
    content.shortQs.forEach((s) =>
      shortQs.push({
        id: s.id,
        chapter_id: c.id,
        medium: 'en',
        marks: s.marks,
        q: s.q,
        answer: s.answer,
        points: s.points,
        review_status: 'draft',
        source: 'ai',
      }),
    );
    content.blanks.forEach((b) =>
      blanks.push({
        id: b.id,
        chapter_id: c.id,
        medium: 'en',
        before_text: b.sentence[0],
        after_text: b.sentence[1],
        answer: b.answer,
        options: b.options,
        review_status: 'draft',
        source: 'ai',
      }),
    );
  }

  // Order matters: chapters reference subjects, outcomes reference chapters,
  // and everything with prose references a chapter.
  // Third element is the conflict target: every table keys on `id` except the
  // outcomes, whose primary key is the board's own code.
  const plan = [
    ['subjects', subjects, 'id'],
    ['chapters', chapters, 'id'],
    ['curriculum_slos', slos, 'code'],
    ...(WITH_SAMPLE
      ? [
          ['chapter_sections', sections, 'id'],
          ['mcqs', mcqs, 'id'],
          ['flashcards', flashcards, 'id'],
          ['short_questions', shortQs, 'id'],
          ['blanks', blanks, 'id'],
        ]
      : []),
  ];

  console.log(C.bold(`\ningest ${DRY ? '(dry run)' : ''}\n`));
  for (const [table, rows] of plan) console.log(`  ${String(rows.length).padStart(5)}  ${table}`);

  if (drift.length) {
    console.log(C.yellow('\n  chapter list differs from the board:'));
    drift.forEach((d) => console.log(C.yellow(`    ${d}`)));
  }

  const missing = Object.values(curriculum).filter((d) => !d.domains?.length);
  const absent = ['urd', 'isl'].filter((id) => !curriculum[id]);
  if (absent.length || missing.length)
    console.log(
      C.yellow(`\n  no learning outcomes for: ${[...absent, ...missing.map((d) => d.subject)].join(', ')} (Urdu-script PDFs, need OCR)`),
    );

  console.log(
    C.dim(
      `\n  chapters and subjects go in as ${PUBLISH ? 'published' : 'draft'}; ` +
        'all study material goes in as draft and is invisible to students until reviewed.',
    ),
  );

  if (DRY) {
    console.log(C.dim('\n  dry run, nothing written\n'));
    return;
  }

  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(C.red('\n  apps/web/.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY\n'));
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log('');
  for (const [table, rows, key] of plan) {
    if (!rows.length) continue;
    let done = 0;
    for (const batch of chunk(rows)) {
      const { error } = await db.from(table).upsert(batch, { onConflict: key });
      if (error) {
        console.error(`${C.red('fail')} ${table}: ${error.message}`);
        process.exit(1);
      }
      done += batch.length;
    }
    console.log(`${C.green('  ok')} ${table.padEnd(18)} ${C.dim(`${done} rows`)}`);
  }

  // Retire chapters that no longer exist in the app.
  //
  // Subjects shrank when they moved to the board's structure: English 8 to 4,
  // Urdu 8 to 3. This script never deletes, on purpose, because student
  // attempts and reading progress point at those chapter ids. But leaving them
  // published means a student sees four English chapters that are not on the
  // syllabus. Unpublishing hides them from every RLS-gated read while keeping
  // the rows, and it is one UPDATE to undo.
  if (!DRY) {
    const live = new Set(chapters.map((c) => c.id));
    const { data: existing } = await db.from('chapters').select('id,subject_id').eq('review_status', 'published');
    const stale = (existing ?? []).filter((r) => !live.has(r.id));
    if (stale.length) {
      const { error } = await db.from('chapters').update({ review_status: 'draft' }).in('id', stale.map((r) => r.id));
      if (error) console.error(`${C.red('fail')} retiring stale chapters: ${error.message}`);
      else
        console.log(
          `${C.yellow('retire')} ${stale.length} chapters no longer on the syllabus ${C.dim(stale.map((r) => r.id).join(', '))}`,
        );
    }
  }

  console.log(C.dim('\n  done\n'));
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
