#!/usr/bin/env node
/**
 * Spread the right answers over every slot, so tapping A is not a strategy.
 *
 *   node scripts/place-answers.mjs --dry-run   show the spread before and after
 *   node scripts/place-answers.mjs             change it, keeping a backup
 *
 * WHY THIS EXISTS
 *
 * The model writes the right answer first. Of 9,940 MCQs, 6,634 had it in
 * slot A and 174 in slot D; FBISE Class 10 Urdu had it in A 98% of the time.
 * Neither app shuffles options, so a student who always tapped A passed. Fill
 * in the blanks were worse: the right chip came first in 4,113 of 4,297.
 *
 * Each MCQ's right option now trades places with whatever holds the slot its
 * id draws (answerSlot in content-rules.mjs, the rule generate-content applies
 * as it writes: every run of four questions in a chapter uses A to D once
 * each). Only two options move, and the explanation follows them: "option
 * c", "(ب)", "دوسرا آپشن", "Options (b), (c) and (d)" are rewritten to the
 * new letters. An explanation the rules cannot settle on
 * their own (a bracketed letter that may be a quantity, "the other three,
 * respectively") was read by hand, and the verdict is in
 * data/mcq-placement-review.json; one that is in neither stays exactly as it
 * is and is listed. Blanks have no explanation to keep in step, so the right
 * chip simply goes to its slot by the same rule and the others fill in around
 * it.
 *
 * Deterministic, so a second run changes nothing. Ids never change, and the
 * `attempts` table records whether an answer was right, not which option was
 * tapped, so no student's history is touched. FBISE Islamiyat in English
 * medium is left alone: it is being replaced by a real English translation,
 * which generate-content will place as it writes.
 *
 * Every row changed is saved to content/.answer-placement-backup/ first.
 */

import dns from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { orderBlankOptions, placeAnswer } from './content-rules.mjs';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DRY = process.argv.includes('--dry-run');
const BACKUP = resolve(ROOT, 'content/.answer-placement-backup', new Date().toISOString().replace(/[:.]/g, '-'));
const replacedSoon = (row) => row.medium === 'en' && /^isl-(10-)?[1-7]$/.test(row.chapter_id);

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/**
 * A call that is retried while the network is the problem. This connection
 * drops a request now and then as a bare "fetch failed"; a first run died
 * that way two thousand rows in. Every write here is an idempotent update by
 * id, so trying it again is always safe.
 */
async function patiently(call) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await call();
    if (!error) return data;
    if (attempt >= 6 || !/fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|terminated|gateway|timeout|50[234]/i.test(error.message)) throw new Error(error.message);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
  }
}

/** Every row of a table, a page at a time: select() stops at 1000 without saying so. */
async function all(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const data = await patiently(() => db.from(table).select(columns).order('id').range(from, from + 999)).catch((e) => {
      throw new Error(`${table}: ${e.message}`);
    });
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const chapters = new Map((await all('chapters', 'id,board,grade,subject_id')).map((c) => [c.id, c]));
const groupOf = (row) => {
  const c = chapters.get(row.chapter_id);
  return c ? `${c.board} ${c.grade} ${c.subject_id}` : 'unknown';
};

const review = JSON.parse(await readFile(resolve(ROOT, 'data/mcq-placement-review.json'), 'utf8')).settled;
/** A hand verdict counts only while the explanation still reads as it did when it was given. */
const settleFor = (row) => {
  const r = review[row.id];
  if (!r || r.was !== row.explanation) return null;
  return r.explanation ? { explanation: r.explanation, to: r.to } : r.labels;
};

/* -------------------------------------------------------------------- MCQs */

const mcqs = await all('mcqs', 'id,chapter_id,medium,q,options,answer,explanation');
const spread = { before: {}, after: {} };
const count = (side, group, slot) => {
  const g = (spread[side][group] ??= [0, 0, 0, 0]);
  g[slot] = (g[slot] ?? 0) + 1;
};
const mcqPatches = [];
const held = [];
let rewritten = 0;
for (const row of mcqs) {
  const group = groupOf(row);
  count('before', group, row.answer);
  if (replacedSoon(row)) {
    count('after', group, row.answer);
    continue;
  }
  const out = placeAnswer(row, row.id, settleFor(row));
  if (out.held) {
    held.push({ id: row.id, why: out.held, unsure: out.unsure });
    count('after', group, row.answer);
    continue;
  }
  count('after', group, out.answer);
  if (!out.moved) continue;
  // The same four options, and the same one right: anything else is a bug here.
  const same = [...out.options].sort().join('\u0001') === [...row.options].sort().join('\u0001');
  if (!same || out.options[out.answer] !== row.options[row.answer]) throw new Error(`${row.id}: placement changed the options themselves`);
  if (out.explanation !== row.explanation) rewritten++;
  mcqPatches.push({ row, patch: { options: out.options, answer: out.answer, explanation: out.explanation } });
}

/* ------------------------------------------------------------------ blanks */

const blanks = await all('blanks', 'id,chapter_id,medium,answer,options');
const blankPatches = [];
const blankSpread = { before: [0, 0, 0, 0, 0], after: [0, 0, 0, 0, 0] };
for (const row of blanks) {
  if (!Array.isArray(row.options) || row.options.length < 2) continue;
  const at = (opts) => Math.min(4, opts.findIndex((o) => String(o).trim() === String(row.answer).trim()));
  blankSpread.before[at(row.options)]++;
  if (replacedSoon(row)) {
    blankSpread.after[at(row.options)]++;
    continue;
  }
  const options = orderBlankOptions(row.id, row.options, row.answer);
  blankSpread.after[at(options)]++;
  if (options.join('\u0001') !== row.options.join('\u0001')) blankPatches.push({ row, patch: { options } });
}

/* ------------------------------------------------------------------ report */

const pct = (g) => {
  const n = g.reduce((a, b) => a + b, 0) || 1;
  return g.map((x) => `${String(Math.round((100 * x) / n)).padStart(3)}%`).join(' ');
};
console.log(C.dim('\n  right answer in A / B / C / D, by board, class and subject\n'));
for (const group of Object.keys(spread.before).sort()) {
  const n = spread.before[group].reduce((a, b) => a + b, 0);
  console.log(`  ${group.padEnd(16)} ${String(n).padStart(4)}   ${pct(spread.before[group])}   ->  ${pct(spread.after[group])}`);
}
const total = (side) => Object.values(spread[side]).reduce((t, g) => t.map((x, i) => x + (g[i] ?? 0)), [0, 0, 0, 0]);
console.log(`  ${'all'.padEnd(16)} ${String(mcqs.length).padStart(4)}   ${pct(total('before'))}   ->  ${pct(total('after'))}`);
console.log(`\n  ${mcqPatches.length} MCQs move, ${rewritten} of them with their explanation rewritten to match`);
console.log(`  ${blankPatches.length} blanks reordered; right chip first before ${pct(blankSpread.before.slice(0, 4))}, after ${pct(blankSpread.after.slice(0, 4))}`);
if (held.length) {
  console.log(C.yellow(`\n  ${held.length} MCQs left where they are:`));
  for (const h of held) console.log(C.yellow(`    ${h.id}: ${h.why}${h.unsure ? ` · ${h.unsure.map((u) => JSON.stringify(u.snippet)).join(' · ')}` : ''}`));
}

// Attempts point at MCQ ids and record right or wrong, not the option tapped.
const moved = new Set(mcqPatches.map((p) => p.row.id));
let attempts = 0;
let onMoved = 0;
for (let from = 0; ; from += 1000) {
  const data = await patiently(() => db.from('attempts').select('mcq_id').order('id').range(from, from + 999));
  attempts += data.length;
  onMoved += data.filter((a) => moved.has(a.mcq_id)).length;
  if (data.length < 1000) break;
}
console.log(C.dim(`\n  ${onMoved} of ${attempts} attempts are on questions that move; they store right or wrong, not the option, so they stand as they are`));

if (DRY) {
  console.log(C.dim('\n  dry run, nothing changed\n'));
  process.exit(0);
}

await mkdir(BACKUP, { recursive: true });
await writeFile(resolve(BACKUP, 'mcqs.json'), `${JSON.stringify(mcqPatches.map((p) => p.row), null, 1)}\n`);
await writeFile(resolve(BACKUP, 'blanks.json'), `${JSON.stringify(blankPatches.map((p) => p.row), null, 1)}\n`);

async function apply(table, patches) {
  const queue = [...patches];
  let done = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const { row, patch } = queue.shift();
        await patiently(() => db.from(table).update(patch).eq('id', row.id)).catch((e) => {
          throw new Error(`${table} ${row.id}: ${e.message}`);
        });
        done++;
      }
    }),
  );
  return done;
}
const m = await apply('mcqs', mcqPatches);
const b = await apply('blanks', blankPatches);
console.log(`${C.green('\n  ok')} ${m} MCQs and ${b} blanks placed, originals in ${relative(ROOT, BACKUP)}/\n`);
