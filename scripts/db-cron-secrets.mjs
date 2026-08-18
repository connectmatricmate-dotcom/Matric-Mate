#!/usr/bin/env node
/**
 * Put the two values the scheduled jobs need into Supabase Vault.
 *
 *   node scripts/db-cron-secrets.mjs                  use the production URL
 *   node scripts/db-cron-secrets.mjs <site-url>       point the jobs elsewhere
 *
 * WHY VAULT AND NOT THE MIGRATION
 *
 * The jobs call the web app's cron routes, which are behind CRON_SECRET. That
 * secret cannot go in a migration, because migrations are in git. Vault keeps
 * it encrypted in the database, and jobs.call_endpoint reads it at call time.
 *
 * Safe to re-run: an existing secret is updated rather than duplicated.
 * Re-run it whenever CRON_SECRET is rotated, or the site moves to its real
 * domain, or nothing will fire and the only sign will be silence.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POOLERS = [
  'aws-0-ap-south-1', 'aws-0-ap-southeast-1', 'aws-0-us-east-1',
  'aws-0-us-west-1', 'aws-0-eu-central-1', 'aws-1-ap-south-1', 'aws-1-ap-southeast-1',
];

const SITE = process.argv[2] ?? 'https://matric-mate-web.vercel.app';

const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of text.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
if (!env.CRON_SECRET) {
  console.error('  CRON_SECRET is not in apps/web/.env.local');
  process.exit(1);
}

const candidates = [
  { label: 'direct', host: `db.${env.SUPABASE_PROJECT_REF}.supabase.co`, user: 'postgres' },
  ...POOLERS.map((h) => ({ label: h, host: `${h}.pooler.supabase.com`, user: `postgres.${env.SUPABASE_PROJECT_REF}` })),
];

let db;
for (const c of candidates) {
  const client = new pg.Client({
    host: c.host, port: 5432, user: c.user, password: env.SUPABASE_DB_PASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
  });
  try { await client.connect(); console.log(`  connected via ${c.label}`); db = client; break; }
  catch { await client.end().catch(() => {}); }
}
if (!db) { console.error('  could not connect'); process.exit(1); }

for (const [name, value] of [['cron_secret', env.CRON_SECRET], ['site_url', SITE]]) {
  const { rows } = await db.query('select id from vault.secrets where name = $1', [name]);
  if (rows.length) {
    await db.query('select vault.update_secret($1, $2, $3)', [rows[0].id, value, name]);
    console.log(`  updated ${name}`);
  } else {
    await db.query('select vault.create_secret($1, $2)', [value, name]);
    console.log(`  created ${name}`);
  }
}

// Prove the jobs can read what was just written, without printing either.
const { rows: check } = await db.query(
  `select name, length(decrypted_secret) as len from vault.decrypted_secrets where name in ('cron_secret','site_url') order by name`,
);
check.forEach((r) => console.log(`  readable: ${r.name} (${r.len} chars)`));
console.log(`\n  site_url points at ${SITE}`);

await db.end();
