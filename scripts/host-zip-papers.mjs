#!/usr/bin/env node
/**
 * Extract the papers FBISE only publishes inside a ZIP and host them ourselves.
 *
 *   node scripts/host-zip-papers.mjs
 *
 * Everything else in data/fbise/papers.json links straight to fbise.edu.pk,
 * because copying what the board already serves free would be storage spent for
 * nothing. This handles the one case where linking does not work.
 *
 * The 2025 first annual session is published as a single 16 MB ZIP holding four
 * papers, two per class. A browser cannot open one page of a ZIP, so linking
 * to it would hand a student a large download and ask them to find their own
 * paper inside it. All four are pulled out and put in the public `papers`
 * bucket instead.
 *
 * Safe to re-run: uploads are upsert, so this rebuilds the bucket from scratch
 * if it is ever lost.
 */

import { execFile } from 'node:child_process';
import dns from 'node:dns';
import net from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// IPv4 only: this network advertises IPv6 it cannot route.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const BUCKET = 'papers';

/** Which archives to open, and which files inside them we actually want. */
const SOURCES = [
  {
    zip: 'https://www.fbise.edu.pk/Old%20Question%20Paper/2025/SSC_1A25_QP.zip',
    // Two papers per class: Class 9 (SSC-I) and, since the app serves both
    // classes, Class 10 (SSC-II), each with its hearing-impaired variant.
    take: [
      { inZip: 'SSC-I Normal.pdf', to: '2025/ssc-i-first-annual-2025.pdf' },
      { inZip: 'SSC-I HIC.pdf', to: '2025/ssc-i-first-annual-2025-hic.pdf' },
      { inZip: 'SSC-II Normal.pdf', to: '2025/ssc-ii-first-annual-2025.pdf' },
      { inZip: 'SSC-II HIC.pdf', to: '2025/ssc-ii-first-annual-2025-hic.pdf' },
    ],
  },
];

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

  const { data: buckets } = await db.storage.listBuckets();
  if (!(buckets ?? []).some((b) => b.name === BUCKET)) {
    // Public on purpose: these are the board's own papers, already free on a
    // government site. Signed URLs would add expiry handling to protect
    // nothing.
    const { error } = await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '50MB' });
    if (error) throw new Error(`could not create bucket: ${error.message}`);
    console.log(`${C.green('  ok')} created public bucket ${BUCKET}`);
  }

  const work = await mkdtemp(join(tmpdir(), 'fbise-zip-'));
  try {
    for (const src of SOURCES) {
      const zipPath = join(work, 'papers.zip');
      const res = await fetch(src.zip);
      if (!res.ok) throw new Error(`ZIP fetch failed: HTTP ${res.status}`);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));

      for (const { inZip, to } of src.take) {
        await run('unzip', ['-o', '-q', zipPath, inZip, '-d', work]);
        const body = await readFile(join(work, inZip));
        const { error } = await db.storage.from(BUCKET).upload(to, body, { contentType: 'application/pdf', upsert: true });
        if (error) {
          console.error(`${C.red('fail')} ${to}: ${error.message}`);
          continue;
        }
        const { data } = db.storage.from(BUCKET).getPublicUrl(to);
        console.log(`${C.green('  ok')} ${to} ${C.dim(`${(body.length / 1048576).toFixed(1)} MB`)}`);
        console.log(C.dim(`      ${data.publicUrl}`));
      }
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }

  console.log(C.dim('\n  URLs are hardcoded in scripts/build-papers-catalogue.mjs under SELF_HOSTED\n'));
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
