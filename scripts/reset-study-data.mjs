#!/usr/bin/env node
/**
 * Wipe every student's study history, keeping their account and subscription.
 *
 *   node scripts/reset-study-data.mjs --dry-run    count what would go
 *   node scripts/reset-study-data.mjs --yes        actually delete
 *
 * WHY THIS EXISTS
 *
 * Every attempt, score, streak and read marker in the database was earned
 * against placeholder content: mock MCQs whose answers were arbitrary and mock
 * chapters that have since been renamed or removed. Keeping it would tell a
 * student they are 9% through Physics and weak at a topic that no longer
 * exists. Worse, it would poison the weak-topic analytics, which are computed
 * from attempt rows and are the whole point of recording confidence.
 *
 * WHAT IS KEPT, AND WHY THAT LINE
 *
 * Accounts, entitlements and payments survive. Somebody paid real money through
 * a real gateway, and a content reset is not a refund. Everything downstream of
 * "what did this student do in the app" goes, because all of it described a
 * different app.
 *
 * Deletes, not truncates, so RLS and foreign keys still apply and nothing
 * cascades further than intended. Requires --yes: a script that empties tables
 * should never do it because someone hit up-arrow.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/** Everything that describes what a student did. All of it predates real content. */
const STUDY_TABLES = [
  'attempts',
  'results',
  'read_sections',
  'cards_known',
  'downloads',
  'plan_done',
  'active_days',
  'threads',
  'ai_usage',
  'notifications',
];

/** Kept, deliberately. Money and identity are not study history. */
const KEPT = ['profiles', 'entitlements', 'payments'];

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
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

  console.log(C.bold('\n  study history to clear\n'));
  let total = 0;
  const counts = {};
  for (const t of STUDY_TABLES) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${C.dim('  skip')} ${t.padEnd(16)} ${C.dim(error.message)}`);
      continue;
    }
    counts[t] = count ?? 0;
    total += counts[t];
    console.log(`  ${String(counts[t]).padStart(6)}  ${t}`);
  }

  console.log(C.bold('\n  kept\n'));
  for (const t of KEPT) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${String(count ?? 0).padStart(6)}  ${t}`);
  }

  // XP is study history that happens to live on the profile row, so it resets
  // with the rest. The account, the phone number and the chosen subjects stay.
  const { count: withXp } = await db.from('profiles').select('*', { count: 'exact', head: true }).gt('xp', 0);
  console.log(`  ${String(withXp ?? 0).padStart(6)}  profiles with XP to reset to zero`);

  if (!CONFIRMED) {
    console.log(C.yellow(`\n  dry run. ${total} rows would be deleted. Re-run with --yes to do it.\n`));
    return;
  }

  console.log('');
  for (const t of STUDY_TABLES) {
    if (!(t in counts)) continue;
    // A filter is required, so match every row by its always-present key.
    const { error } = await db.from(t).delete().gte('created_at', '1970-01-01');
    const fallback = error ? await db.from(t).delete().not('user_id', 'is', null) : { error: null };
    if (error && fallback.error) {
      console.log(`${C.red('  fail')} ${t.padEnd(16)} ${fallback.error.message}`);
      continue;
    }
    const { count } = await db.from(t).select('*', { count: 'exact', head: true });
    console.log(`${C.green('    ok')} ${t.padEnd(16)} ${C.dim(`${counts[t]} deleted, ${count ?? 0} remain`)}`);
  }

  const { error: xpErr } = await db.from('profiles').update({ xp: 0 }).gt('xp', 0);
  console.log(xpErr ? `${C.red('  fail')} profiles.xp: ${xpErr.message}` : `${C.green('    ok')} profiles.xp     ${C.dim('reset to zero')}`);

  console.log(C.dim('\n  accounts, entitlements and payments untouched\n'));
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
