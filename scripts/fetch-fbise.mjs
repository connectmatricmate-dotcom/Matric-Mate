#!/usr/bin/env node
/**
 * Pull the FBISE Class 9 source documents and extract their text.
 *
 *   node scripts/fetch-fbise.mjs            fetch what is missing, then extract
 *   node scripts/fetch-fbise.mjs --force    re-download everything
 *
 * Writes to content/fbise/, which is gitignored: these are large third-party
 * PDFs, they are not ours to redistribute, and they are re-fetchable in a
 * minute. What we keep in git is the structured JSON that build-curriculum.mjs
 * derives from them.
 *
 * Every file records its byte count and SHA-256 in content/fbise/manifest.json,
 * so a later run can tell "FBISE republished this document" apart from "the
 * download was truncated". That matters: the board reissues these silently and
 * a changed SLO list changes what we generate.
 *
 * Text extraction is `pdftotext -layout`, which keeps the column geometry the
 * SLO tables rely on. Without -layout the two-column benchmark tables interleave
 * and become unparseable.
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'content/fbise');
const PDF_DIR = resolve(OUT, 'pdf');
const TXT_DIR = resolve(OUT, 'text');

const FORCE = process.argv.includes('--force');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/** Run a binary and resolve with its exit code, streaming nothing to us. */
const run = (cmd, args) =>
  new Promise((done) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => done({ code, err }));
    p.on('error', () => done({ code: 127, err: `${cmd} not found` }));
  });

/**
 * Encode a path segment by segment. encodeURI would be close, but these
 * filenames contain '+' and '#' characters that a bare encodeURI leaves alone
 * and the server then reads as query syntax.
 */
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

async function exists(p) {
  try {
    return (await stat(p)).size;
  } catch {
    return 0;
  }
}

async function main() {
  const started = Date.now();
  const sources = JSON.parse(await readFile(resolve(ROOT, 'scripts/fbise-sources.json'), 'utf8'));

  if ((await run('pdftotext', ['-v'])).code === 127) {
    console.error(C.red('pdftotext is not installed. On Debian/Ubuntu: sudo apt install poppler-utils'));
    process.exit(1);
  }

  await mkdir(PDF_DIR, { recursive: true });
  await mkdir(TXT_DIR, { recursive: true });

  const manifest = [];
  let failed = 0;

  for (const f of sources.files) {
    const pdf = resolve(PDF_DIR, `${f.id}.pdf`);
    const txt = resolve(TXT_DIR, `${f.id}.txt`);
    const url = sources.base + encodePath(f.path);

    const already = FORCE ? 0 : await exists(pdf);
    if (!already) {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        console.error(`${C.red('fail')} ${f.id} ${C.dim(`HTTP ${res.status}`)}`);
        failed++;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // A WAF block page is a 200 with HTML in it. Anything that is not a PDF
      // is a failure, however cheerful its status code.
      if (buf.subarray(0, 4).toString() !== '%PDF') {
        console.error(`${C.red('fail')} ${f.id} ${C.dim('response was not a PDF')}`);
        failed++;
        continue;
      }
      await writeFile(pdf, buf);
    }

    const bytes = await exists(pdf);
    const sha = createHash('sha256').update(await readFile(pdf)).digest('hex');

    const { code, err } = await run('pdftotext', ['-layout', pdf, txt]);
    if (code !== 0) {
      console.error(`${C.red('fail')} ${f.id} ${C.dim(`pdftotext: ${err.trim()}`)}`);
      failed++;
      continue;
    }
    const chars = (await readFile(txt, 'utf8')).length;

    // A curriculum PDF that extracts to almost nothing is a scan, not text, and
    // no parser will save it. Say so now rather than in build-curriculum.
    const thin = chars < 4000;
    manifest.push({ id: f.id, subject: f.subject, kind: f.kind, path: f.path, bytes, sha256: sha, chars });
    console.log(
      `${thin ? C.yellow('thin') : C.green('  ok')} ${f.id.padEnd(22)} ${C.dim(
        `${(bytes / 1048576).toFixed(1)} MB · ${chars.toLocaleString()} chars${already ? ' · cached' : ''}`,
      )}`,
    );
  }

  await writeFile(
    resolve(OUT, 'manifest.json'),
    `${JSON.stringify({ base: sources.base, fetchedFiles: manifest.length, files: manifest }, null, 2)}\n`,
  );

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(C.dim(`\n${manifest.length}/${sources.files.length} files in ${secs}s → content/fbise/`));
  if (failed) {
    console.error(C.red(`${failed} failed`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
