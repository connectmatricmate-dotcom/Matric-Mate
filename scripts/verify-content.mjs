#!/usr/bin/env node
/**
 * Prove the content in the database is the content the app will get.
 *
 *   node scripts/verify-content.mjs
 *
 * Three things are checked, and each one has been wrong at some point:
 *
 * 1. **The rows are there**, counted with the service role, which bypasses RLS.
 * 2. **The paywall on unreviewed content actually holds.** Queried with the
 *    publishable key and no session, so as the `anon` role. Anything it can see
 *    that is not published is a hole, and this is the only test that would
 *    catch a policy written `to public` by mistake.
 * 3. **Every column the fetch layer selects exists.** packages/core/src/db.ts
 *    names its columns in strings, so a rename in a migration is not a type
 *    error anywhere; it is an empty chapter list at runtime, silently swallowed
 *    by the fallback. This runs each select for real.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/** Exactly the selects in packages/core/src/db.ts. Keep them in step. */
const SELECTS = {
  subjects: 'id,name,urdu_name,icon,compulsory,study_group',
  chapters: 'id,subject_id,number,board_unit,title,urdu_title,blurb,premium,audio_minutes',
  curriculum_slos: 'code,text,cognitive,assessment,domain,title',
  chapter_sections: 'id,medium,position,title,blocks',
  mcqs: 'id,medium,topic,q,options,answer,explanation,difficulty,source',
  flashcards: 'id,medium,front,back',
  short_questions: 'id,medium,marks,q,answer,points',
  blanks: 'id,medium,before_text,after_text,answer,options',
};

async function loadEnv() {
  const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const admin = createClient(url, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

  let failed = 0;

  console.log('\n  rows, and what every column the app asks for does\n');
  for (const [tableName, cols] of Object.entries(SELECTS)) {
    const { data, error } = await admin.from(tableName).select(cols).limit(1);
    const { count } = await admin.from(tableName).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${C.red('  fail')} ${tableName.padEnd(18)} ${error.message}`);
      failed++;
      continue;
    }
    console.log(`${C.green('    ok')} ${tableName.padEnd(18)} ${C.dim(`${count} rows, ${data.length ? 'select works' : 'empty'}`)}`);
  }

  console.log('\n  what a signed-out visitor can reach\n');
  for (const tableName of Object.keys(SELECTS)) {
    const { data, error } = await anon.from(tableName).select('*').limit(50);
    const rows = data ?? [];
    const leaked = rows.filter((r) => 'review_status' in r && r.review_status !== 'published');
    if (error) {
      console.log(`${C.dim('    -- ')} ${tableName.padEnd(18)} ${C.dim('blocked')}`);
      continue;
    }
    if (leaked.length) {
      console.log(`${C.red('  LEAK')} ${tableName.padEnd(18)} ${leaked.length} unpublished rows readable without signing in`);
      failed++;
    } else {
      console.log(`${C.green('    ok')} ${tableName.padEnd(18)} ${C.dim(`${rows.length} rows, all published`)}`);
    }
  }

  // The number that says whether the app is on real content or still falling
  // back to the bundle. Draft study material is invisible to students, so a
  // chapter with zero published sections renders from packages/core.
  const { count: publishedSections } = await admin
    .from('chapter_sections')
    .select('*', { count: 'exact', head: true })
    .eq('review_status', 'published');
  const { count: publishedMcqs } = await admin
    .from('mcqs')
    .select('*', { count: 'exact', head: true })
    .eq('review_status', 'published');

  console.log(
    `\n  published study material: ${publishedSections} sections, ${publishedMcqs} questions` +
      `${publishedSections ? '' : C.yellow('  (apps still render bundled sample content)')}\n`,
  );

  if (failed) {
    console.error(C.red(`  ${failed} problems\n`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
