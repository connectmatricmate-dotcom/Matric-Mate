#!/usr/bin/env node
/**
 * Rebuild active_days from the study that actually happened.
 *
 *   node scripts/backfill-active-days.mjs --dry-run
 *   node scripts/backfill-active-days.mjs
 *
 * WHY THIS EXISTS
 *
 * active_days is the sole source of every streak in the product, and it was
 * empty for every account while attempts, results and read_sections were
 * filling up normally. Two causes, both now fixed in the apps: the website
 * marked today active on sign-in without queueing the write, which consumed
 * the "is this a new day" flag before any real study action could claim it,
 * and the check itself trusted device state that an upgrading student carries
 * over already containing today.
 *
 * The fix stops it happening again. It does not recover the days already lost,
 * and those days are real: somebody answered questions on them. This walks the
 * append-only tables that did record correctly and writes the missing rows.
 *
 * Safe to run repeatedly. Every insert is an upsert on the table's own primary
 * key (user_id, day), so a second run inserts nothing.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, 'apps/web/.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/** The same day boundary the apps use. A day is a day in Karachi, not in UTC. */
const karachiDay = (at) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(at));

/** Paginated: select() silently caps at 1000 rows and would truncate quietly. */
async function all(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

const [attempts, results, sections, existing] = await Promise.all([
  all('attempts', 'user_id,at'),
  all('results', 'user_id,at'),
  all('read_sections', 'user_id,at'),
  all('active_days', 'user_id,day'),
]);

const have = new Set(existing.map((r) => `${r.user_id}|${r.day}`));
const want = new Map();
for (const r of [...attempts, ...results, ...sections]) {
  const key = `${r.user_id}|${karachiDay(r.at)}`;
  if (!have.has(key)) want.set(key, { user_id: r.user_id, day: karachiDay(r.at) });
}

const rows = [...want.values()];
const students = new Set(rows.map((r) => r.user_id)).size;

console.log(`  studied days found : ${attempts.length + results.length + sections.length} rows across attempts, results and read_sections`);
console.log(`  active_days already: ${existing.length}`);
console.log(`  missing            : ${rows.length}, across ${students} student${students === 1 ? '' : 's'}`);

if (!rows.length) { console.log('\n  nothing to do'); process.exit(0); }
for (const r of rows.slice(0, 12)) console.log(`     ${r.user_id.slice(0, 8)}  ${r.day}`);
if (rows.length > 12) console.log(`     ... and ${rows.length - 12} more`);

if (DRY) { console.log('\n  dry run, nothing written'); process.exit(0); }

for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const { error } = await admin.from('active_days').upsert(chunk, { onConflict: 'user_id,day', ignoreDuplicates: true });
  if (error) { console.error('  failed:', error.message); process.exit(1); }
}
console.log(`\n  wrote ${rows.length} rows`);
