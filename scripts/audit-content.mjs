#!/usr/bin/env node
/**
 * Catch the class of bug that kept shipping: a screen that looks fine and
 * serves placeholder text.
 *
 *   node scripts/audit-content.mjs
 *
 * This exists because the same mistake was found four separate times, always by
 * a person opening the app, never by a test. The content was correct in
 * Postgres every single time. What was wrong was the path between the database
 * and the screen, and nothing in lint, typecheck or the build can see that: a
 * page that reads the bundled sample instead of the database compiles cleanly,
 * runs without error, and renders confident nonsense.
 *
 * Four checks, each one a bug that actually shipped:
 *
 *   1. A server component calling `api.*` directly. With no client the fetch
 *      layer silently falls through to the bundle. This is what made the
 *      flashcards say "the full definition comes with the client's notes" under
 *      a correct chapter title.
 *   2. App code importing the bundled content directly, bypassing the fetch
 *      layer entirely.
 *   3. Placeholder prose that reached published rows in the database.
 *   4. A published chapter missing a content type, which renders as an empty
 *      practice screen.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Phrases the bundled sample uses. If any of these reach a published row, a
 * student is reading filler that claims real content is coming later.
 */
const PLACEHOLDER = [
  "client's notes",
  'client’s notes',
  'comes with the client',
  'supplied with the client',
  'client hasn',
  'once the client supplies',
  'sample FBISE',
  'Preview build',
  'loads here once',
];

/** Files allowed to read bundled content directly, with the reason. */
const STATIC_ALLOWED = new Set([
  // The marketing landing page: public, no session, static is correct.
  'apps/web/app/page.tsx',
  // The browser and mobile bootstraps, which connect the live client.
  'apps/web/lib/content.ts',
  // Past papers have no database table yet: the client has not supplied real
  // ones, so fetchPastPapers always returns the bundled list whether or not a
  // client is passed. Remove this line the day a papers table exists.
  'apps/web/app/(app)/session/papers/page.tsx',
]);

/**
 * Gaps the board itself requires, so they are correct rather than missing.
 * Anything not listed here is a real hole.
 */
const INTENTIONAL = {
  // FBISE forbids MCQs on Islamiyat strand 6 outright. Its short and extended
  // answers carry the chapter.
  'isl-6': ['mcqs'],
};

/**
 * Chapters that correctly hold nothing at all, with the reason. Listed so the
 * audit stays quiet about them and loud about anything new.
 */
const INTENTIONALLY_EMPTY = {
  'math-1': 'Matrices and Determinants: dropped from Class 9 assessment by NCP 2022-23',
  'math-10': 'Congruent Triangles: its only outcomes are formative, never examined',
  'math-13': 'Sides and Angles of a Triangle: no examinable outcomes in the framework',
  'urd-4': 'سننا (listening): the board assesses it in class, never on the paper',
  'urd-5': 'بولنا (speaking): the board assesses it in class, never on the paper',
};

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      await walk(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

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
  const problems = [];

  /* 1 + 2: static analysis of how the apps reach content ----------------- */

  const files = [
    ...(await walk(resolve(ROOT, 'apps/web/app'))),
    ...(await walk(resolve(ROOT, 'apps/web/components'))),
    ...(await walk(resolve(ROOT, 'apps/web/lib'))),
  ];

  for (const file of files) {
    const rel = relative(ROOT, file);
    const src = await readFile(file, 'utf8');
    const isClient = /^\s*['"]use client['"]/m.test(src);

    // A client component has the browser's long-lived client, so `api.*` there
    // is fine. A server component does not, and must go through the readers.
    if (
      !isClient &&
      /\bapi\.(get|generate)[A-Za-z]*\(/.test(src) &&
      !rel.endsWith('lib/content-readers.ts') &&
      !STATIC_ALLOWED.has(rel)
    ) {
      const call = src.match(/\bapi\.((?:get|generate)[A-Za-z]*)\(/)?.[1];
      problems.push(
        `${rel}: server component calls api.${call}() with no client. It will silently serve bundled content. Use lib/content-readers.ts.`,
      );
    }

    if (STATIC_ALLOWED.has(rel)) continue;
    const staticRead = src.match(/\b(CHAPTERS\[|ALL_CHAPTERS|contentFor\()/);
    if (staticRead) problems.push(`${rel}: reads bundled content directly (${staticRead[1]}). Use the api or chaptersFor.`);
  }

  console.log(C.bold('\n  how the apps reach content\n'));
  if (problems.length) problems.forEach((p) => console.log(`${C.red('  fail')} ${p}`));
  else console.log(`${C.green('    ok')} every server read goes through the readers, no direct bundle reads`);

  /* 3 + 4: what is actually published ------------------------------------ */

  const env = await loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

  console.log(C.bold('\n  placeholder prose in published content\n'));
  const textCols = {
    chapter_sections: 'title,blocks',
    mcqs: 'q,explanation',
    flashcards: 'front,back',
    short_questions: 'q,answer',
    blanks: 'before_text,after_text',
  };
  let leaked = 0;
  for (const [t, cols] of Object.entries(textCols)) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from(t)
        .select(`chapter_id,medium,${cols}`)
        .eq('review_status', 'published')
        .range(from, from + 999);
      if (error || !data?.length) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const hits = rows.filter((r) => {
      const blob = JSON.stringify(r).toLowerCase();
      return PLACEHOLDER.some((p) => blob.includes(p.toLowerCase()));
    });
    if (hits.length) {
      leaked += hits.length;
      const where = [...new Set(hits.map((h) => `${h.chapter_id}/${h.medium}`))].slice(0, 6).join(', ');
      console.log(`${C.red('  fail')} ${t.padEnd(18)} ${hits.length} rows contain placeholder text ${C.dim(where)}`);
    } else {
      console.log(`${C.green('    ok')} ${t.padEnd(18)} clean`);
    }
  }
  if (leaked) problems.push(`${leaked} published rows contain placeholder prose`);

  console.log(C.bold('\n  every published chapter has every content type\n'));
  const { data: chapters } = await db.from('chapters').select('id,subject_id').eq('review_status', 'published');
  const tables = ['chapter_sections', 'mcqs', 'flashcards', 'short_questions', 'blanks'];

  /*
   * Paginated, because PostgREST caps a select at 1000 rows by default and
   * mcqs alone holds well over two thousand. Reading only the first page made
   * this check report a different, random-looking set of "missing" content on
   * every run, which is worse than no check: it hides the real gaps in noise
   * and trains you to ignore it.
   */
  const allRows = async (t) => {
    const rows = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await db
        .from(t)
        .select('chapter_id,medium')
        .eq('review_status', 'published')
        .range(from, from + page - 1);
      if (error || !data?.length) break;
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  };

  const have = {};
  for (const t of tables) {
    have[t] = new Set((await allRows(t)).map((r) => `${r.chapter_id}:${r.medium}`));
  }
  const gaps = [];
  for (const ch of chapters ?? []) {
    for (const medium of ['en', 'ur']) {
      const allowed = INTENTIONAL[ch.id] ?? [];
      const missing = tables.filter((t) => !have[t].has(`${ch.id}:${medium}`) && !allowed.includes(t));
      // A chapter with nothing at all is a known empty one (the board dropped
      // it, or the skill is never examined) and is reported separately.
      if (missing.length && missing.length < tables.length) gaps.push(`${ch.id}/${medium} missing ${missing.join(', ')}`);
    }
  }
  const empty = (chapters ?? []).filter((ch) => tables.every((t) => !have[t].has(`${ch.id}:en`))).map((c) => c.id);
  const unexpectedlyEmpty = empty.filter((id) => !(id in INTENTIONALLY_EMPTY));
  if (unexpectedlyEmpty.length) problems.push(`${unexpectedlyEmpty.length} chapters unexpectedly hold no content: ${unexpectedlyEmpty.join(', ')}`);

  if (gaps.length) {
    gaps.slice(0, 12).forEach((g) => console.log(`${C.red('  fail')} ${g}`));
    problems.push(`${gaps.length} chapter-media are missing a content type`);
  } else {
    console.log(`${C.green('    ok')} no chapter is missing only some of its content`);
  }
  for (const id of empty) {
    const why = INTENTIONALLY_EMPTY[id];
    if (why) console.log(`${C.dim('    --')} ${id.padEnd(8)} ${C.dim(`empty on purpose: ${why}`)}`);
    else console.log(`${C.red('  fail')} ${id.padEnd(8)} holds no content and no reason is recorded`);
  }

  console.log('');
  if (problems.length) {
    console.error(C.red(`  ${problems.length} problems\n`));
    process.exit(1);
  }
  console.log(C.green('  content reaches the screen everywhere it should\n'));
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
