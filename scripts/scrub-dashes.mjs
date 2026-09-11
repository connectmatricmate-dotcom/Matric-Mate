#!/usr/bin/env node
/**
 * Take the em dashes out of study content already in the database.
 *
 *   node scripts/scrub-dashes.mjs --dry-run   count what would change
 *   node scripts/scrub-dashes.mjs             change it, keeping a backup
 *
 * The repo's rule is no em dash anywhere a student reads, and the generator
 * now strips them from everything it writes. This is for the rows written
 * before it did: 720 across notes, MCQs, flashcards, short questions and
 * blanks when this was written, all FBISE.
 *
 * Same replacement as generate-content.mjs: the comma the sentence almost
 * always wanted, the Urdu comma in Urdu rows, and nothing at all at the start
 * or end of a string. Every row is saved to content/.dash-backup/ before it
 * is touched, so a change that reads badly can be put back from there.
 */

import dns from 'node:dns';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DRY = process.argv.includes('--dry-run');
const DASH = '\u2014';

/** Each table's text fields, and which of them are JSON. */
const TABLES = {
  chapter_sections: { text: ['title'], json: ['blocks'] },
  mcqs: { text: ['q', 'explanation', 'topic'], json: ['options'] },
  flashcards: { text: ['front', 'back'], json: [] },
  short_questions: { text: ['q', 'answer'], json: ['points'] },
  blanks: { text: ['before_text', 'after_text', 'answer'], json: ['options'] },
};

function dashless(value, comma) {
  if (typeof value === 'string') {
    return value
      .replace(new RegExp(`^\\s*${DASH}\\s*`), '')
      .replace(new RegExp(`\\s*${DASH}\\s*$`), '')
      .replace(new RegExp(`\\s*${DASH}\\s*`, 'g'), comma);
  }
  if (Array.isArray(value)) return value.map((v) => dashless(v, comma));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dashless(v, comma)]));
  }
  return value;
}

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const backupDir = resolve(ROOT, 'content/.dash-backup');
if (!DRY) await mkdir(backupDir, { recursive: true });

let changed = 0;
for (const [table, { text, json }] of Object.entries(TABLES)) {
  const fields = [...text, ...json];
  // PostgREST pages at 1000 rows and filters JSON as text poorly, so read
  // every row a page at a time and test here.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(`id,medium,${fields.join(',')}`).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const dirty = rows.filter((r) => fields.some((f) => JSON.stringify(r[f] ?? '').includes(DASH)));
  console.log(`  ${table.padEnd(17)} ${dirty.length} of ${rows.length} rows carry an em dash`);
  if (DRY || !dirty.length) continue;

  await writeFile(resolve(backupDir, `${table}.json`), `${JSON.stringify(dirty, null, 1)}\n`);
  const queue = [...dirty];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const row = queue.shift();
        const comma = row.medium === 'ur' ? '، ' : ', ';
        const patch = Object.fromEntries(fields.filter((f) => row[f] != null).map((f) => [f, dashless(row[f], comma)]));
        const { error } = await db.from(table).update(patch).eq('id', row.id);
        if (error) throw new Error(`${table} ${row.id}: ${error.message}`);
        changed++;
      }
    }),
  );
}

console.log(DRY ? C.dim('\n  dry run, nothing changed\n') : `${C.green('\n  ok')} ${changed} rows cleaned, originals in content/.dash-backup/\n`);
