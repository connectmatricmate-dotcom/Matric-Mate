#!/usr/bin/env node
/**
 * Pull FBISE's published topper answer scripts.
 *
 *   node scripts/fetch-toppers.mjs            fetch what is missing
 *   node scripts/fetch-toppers.mjs --force    re-download everything
 *
 * WHAT THESE ARE, AND WHY THEY MATTER MORE THAN A PAST PAPER
 *
 * FBISE does not publish past papers. It publishes model papers, which we
 * already have, and it publishes scans of the actual marked answer scripts of
 * the students who topped each subject.
 *
 * A past paper tells a student what was asked. A topper's marked script shows
 * what a full-mark answer looks like: how much to write for three marks against
 * six, how working is laid out, where the examiner put a tick. That is the part
 * students guess hardest at, and it is the gap between knowing the content and
 * scoring on it.
 *
 * They are scans of handwriting, so they are images, not text. Useful to show a
 * student, not to generate questions from. Do not try to parse them.
 *
 * The board publishes up to three students per subject and adds a new set each
 * year, so this scrapes the index rather than hardcoding a list.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'content/fbise/toppers');
const INDEX = 'https://fbise.edu.pk/topper_copies.php';
const BASE = 'https://fbise.edu.pk/';

const FORCE = process.argv.includes('--force');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Filenames encode the subject in their first letters, inconsistently and in
 * mixed case: `bio1025 (1).pdf`, `BIO1225-5260970.PDF`, `che10 (3).pdf`,
 * `mat-5308459.pdf`. Map them to the subject ids the app already uses so the
 * scripts can be grouped without anyone reading a directory listing.
 */
const SUBJECT_OF = (file) => {
  const n = file.toLowerCase();
  if (n.startsWith('bio')) return 'bio';
  if (n.startsWith('che')) return 'chem';
  if (n.startsWith('csc')) return 'cs';
  if (n.startsWith('eng')) return 'eng';
  if (n.startsWith('ist')) return 'isl';
  if (n.startsWith('mat')) return 'math';
  if (n.startsWith('phy')) return 'phy';
  if (n.startsWith('pst')) return 'pst';
  if (n.startsWith('urd')) return 'urd';
  return 'unknown';
};

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

async function sizeOf(p) {
  try {
    return (await stat(p)).size;
  } catch {
    return 0;
  }
}

async function main() {
  const started = Date.now();
  const page = await fetch(INDEX).then((r) => r.text());

  const hrefs = [...page.matchAll(/href="(Topper_Copies\/[^"]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(hrefs)];
  if (!unique.length) {
    console.error(C.red('no topper links found. The page layout may have changed.'));
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });

  const manifest = [];
  let failed = 0;

  for (const href of unique) {
    const file = href.split('/').pop();
    // Topper_Copies/SSC_2025/phy (1).pdf -> SSC, 2025
    const folder = href.split('/')[1] ?? '';
    const [level, year] = folder.split('_');
    const subject = SUBJECT_OF(file);
    const safe = `${level}-${year}-${subject}-${file.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const dest = resolve(OUT, safe);

    const already = FORCE ? 0 : await sizeOf(dest);
    if (!already) {
      let res;
      try {
        res = await fetch(BASE + encodePath(href), { redirect: 'follow' });
      } catch (e) {
        console.error(`${C.red('fail')} ${file} ${C.dim(e.message)}`);
        failed++;
        continue;
      }
      if (!res.ok) {
        console.error(`${C.red('fail')} ${file} ${C.dim(`HTTP ${res.status}`)}`);
        failed++;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // A WAF block page is a cheerful 200 with HTML inside.
      if (buf.subarray(0, 4).toString() !== '%PDF') {
        console.error(`${C.red('fail')} ${file} ${C.dim('not a PDF')}`);
        failed++;
        continue;
      }
      await writeFile(dest, buf);
    }

    const bytes = await sizeOf(dest);
    manifest.push({
      file: safe,
      source: href,
      level,
      year: Number(year) || null,
      subject,
      bytes,
      sha256: createHash('sha256').update(await readFile(dest)).digest('hex'),
    });
    console.log(
      `${C.green('  ok')} ${level} ${year} ${subject.padEnd(5)} ${C.dim(`${(bytes / 1048576).toFixed(1)} MB${already ? ' cached' : ''}`)}`,
    );
  }

  await writeFile(
    resolve(OUT, 'manifest.json'),
    `${JSON.stringify(
      {
        source: INDEX,
        note: 'Scanned marked answer scripts of subject toppers. Images of handwriting, not text.',
        retrieved: new Date().toISOString().slice(0, 10),
        files: manifest,
      },
      null,
      2,
    )}\n`,
  );

  const bySubject = {};
  for (const m of manifest.filter((x) => x.level === 'SSC')) bySubject[m.subject] = (bySubject[m.subject] ?? 0) + 1;

  console.log(C.dim(`\n  ${manifest.length} scripts in ${((Date.now() - started) / 1000).toFixed(1)}s -> content/fbise/toppers/`));
  console.log(C.dim(`  SSC by subject: ${Object.entries(bySubject).map(([s, n]) => `${s} ${n}`).join(', ')}`));
  if (failed) {
    console.error(C.red(`  ${failed} failed`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
