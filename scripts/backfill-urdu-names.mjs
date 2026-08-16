/**
 * Writes the Urdu subject and chapter names into the database.
 *
 * The names live in packages/core/src/i18n/names-ur.ts, which is also what the
 * offline catalogue reads, so running this keeps the server and the bundled
 * copy saying the same thing. Safe to run repeatedly: it only writes rows whose
 * stored name differs from the map, and it never clears a name it has no
 * translation for.
 *
 *   node scripts/backfill-urdu-names.mjs           # report what would change
 *   node scripts/backfill-urdu-names.mjs --write   # apply it
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, 'apps/web/.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* Read the names straight out of the TypeScript source rather than the build,
   so this works without compiling core first. Both maps are plain string
   literals, which is why a regex is enough and safe here. */
function readMap(source, name) {
  const body = source.slice(source.indexOf(`export const ${name}`));
  const block = body.slice(body.indexOf('{'), body.indexOf('\n};'));
  const out = {};
  for (const m of block.matchAll(/'?([\w-]+)'?:\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
}

const src = fs.readFileSync(path.join(root, 'packages/core/src/i18n/names-ur.ts'), 'utf8');
const subjects = readMap(src, 'SUBJECT_NAMES_UR');
const chapters = readMap(src, 'CHAPTER_TITLES_UR');
console.log(`map: ${Object.keys(subjects).length} subjects, ${Object.keys(chapters).length} chapters`);

let changed = 0;
let already = 0;

const { data: subRows, error: subErr } = await db.from('subjects').select('id,name,urdu_name');
if (subErr) throw subErr;
for (const row of subRows ?? []) {
  const want = subjects[row.id];
  if (!want || row.urdu_name === want) {
    if (want) already++;
    continue;
  }
  changed++;
  console.log(`  subject ${row.id.padEnd(6)} ${row.urdu_name ?? '(none)'} -> ${want}`);
  if (write) {
    const { error } = await db.from('subjects').update({ urdu_name: want }).eq('id', row.id);
    if (error) throw error;
  }
}

const { data: chRows, error: chErr } = await db.from('chapters').select('id,title,urdu_title');
if (chErr) throw chErr;
const unmapped = [];
for (const row of chRows ?? []) {
  const want = chapters[row.id];
  if (!want) {
    // Urdu and Islamiat already carry their own Urdu titles, so a miss there is
    // expected. A miss anywhere else is a gap worth printing.
    if (!row.urdu_title) unmapped.push(row.id);
    continue;
  }
  if (row.urdu_title === want) {
    already++;
    continue;
  }
  changed++;
  if (write) {
    const { error } = await db.from('chapters').update({ urdu_title: want }).eq('id', row.id);
    if (error) throw error;
  }
}

console.log(`\n${changed} rows ${write ? 'updated' : 'would change'}, ${already} already correct`);
if (unmapped.length) console.log(`still without an Urdu title: ${unmapped.join(', ')}`);
if (!write) console.log('\nnothing written. re-run with --write to apply.');
