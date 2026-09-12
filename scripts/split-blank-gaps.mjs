#!/usr/bin/env node
/**
 * One gap per fill-in-the-blank sentence.
 *
 *   node scripts/split-blank-gaps.mjs --dry-run   say what would change
 *   node scripts/split-blank-gaps.mjs             change it, keeping a backup
 *
 * A blank is stored as the sentence before the gap and the sentence after it,
 * and the apps draw the gap between the two. The model often wrote the whole
 * sentence into the first half with its own "____" where the answer goes, and
 * left the second half empty, so 262 blanks showed two gaps: the model's, and
 * the app's after the full stop ("...is called its ____. _______").
 *
 * Each one is rebuilt around the model's gap, with the rule generate-content
 * now applies as it writes (splitAtGap in content-rules.mjs): the halves are
 * joined back into one sentence and cut where the underscores were. Code that
 * happens to contain underscores (`__init__`) is not a gap, and a sentence
 * with two gaps is left for a person. Row ids do not change.
 *
 * FBISE Islamiyat in English medium is left alone: it is being replaced by a
 * real English translation. Every row changed is saved to
 * content/.blank-gap-backup/ first.
 */

import dns from 'node:dns';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { splitAtGap } from './content-rules.mjs';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DRY = process.argv.includes('--dry-run');
const BACKUP = resolve(ROOT, 'content/.blank-gap-backup', new Date().toISOString().replace(/[:.]/g, '-'));
const replacedSoon = (row) => row.medium === 'en' && /^isl-(10-)?[1-7]$/.test(row.chapter_id);

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Every row, a page at a time: select() stops at 1000 without saying so.
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('blanks').select('id,chapter_id,medium,before_text,after_text,answer').order('id').range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...data);
  if (data.length < 1000) break;
}

const underscored = rows.filter((r) => /_{2,}/.test(`${r.before_text} ${r.after_text}`));
const changes = [];
const leftAlone = [];
for (const row of underscored) {
  if (replacedSoon(row)) continue;
  const r = splitAtGap(row.before_text, row.after_text);
  if (r.changed) changes.push({ row, patch: { before_text: r.before, after_text: r.after } });
  else leftAlone.push(row);
}

console.log(`  ${underscored.length} of ${rows.length} blanks carry underscores; ${changes.length} to split${underscored.length - changes.length - leftAlone.length ? C.dim(`, ${underscored.length - changes.length - leftAlone.length} left for the Islamiyat rewrite`) : ''}`);
for (const { row, patch } of changes.filter((_, i) => i % Math.max(1, Math.floor(changes.length / 8)) === 0).slice(0, 8)) {
  console.log(C.dim(`    ${row.id}\n      was  ${JSON.stringify(row.before_text)} | ${JSON.stringify(row.after_text)}\n      now  ${JSON.stringify(patch.before_text)} [${row.answer}] ${JSON.stringify(patch.after_text)}`));
}
if (leftAlone.length) {
  console.log(C.yellow(`  ${leftAlone.length} left as they are (code, or more than one gap):`));
  for (const r of leftAlone) console.log(C.yellow(`    ${r.id}: ${JSON.stringify(`${r.before_text} | ${r.after_text}`).slice(0, 110)}`));
}

if (!DRY && changes.length) {
  await mkdir(BACKUP, { recursive: true });
  await writeFile(resolve(BACKUP, 'blanks.json'), `${JSON.stringify(changes.map((c) => c.row), null, 1)}\n`);
  for (const { row, patch } of changes) {
    const { error } = await db.from('blanks').update(patch).eq('id', row.id);
    if (error) throw new Error(`${row.id}: ${error.message}`);
  }
}
console.log(DRY ? C.dim('\n  dry run, nothing changed\n') : `${C.green('\n  ok')} ${changes.length} blanks split, originals in ${relative(ROOT, BACKUP)}/\n`);
