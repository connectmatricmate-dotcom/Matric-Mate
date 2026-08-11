#!/usr/bin/env node
/**
 * Apply the SQL migrations in supabase/migrations to the project.
 *
 *   node scripts/db-migrate.mjs --dry-run    list what would run
 *   node scripts/db-migrate.mjs              apply anything not yet applied
 *
 * There is no Supabase CLI on this machine and no psql, so this talks straight
 * to Postgres with `pg`. It records what it has run in `public.schema_migrations`
 * so a second run is a no-op, which is the only reason it is safe to point at a
 * project that already has student data in it.
 *
 * Each file runs inside a transaction. A migration that fails half way leaves
 * nothing behind, so the fix is to edit the file and run again rather than to
 * work out which half of it landed.
 *
 * Connection: Supabase gives every project a direct host that is IPv6-only on
 * newer projects, and an IPv4 pooler whose hostname carries the region. We try
 * the direct host first and fall back through the pooler regions, because the
 * region is not written down anywhere in the repo.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'supabase/migrations');
const DRY = process.argv.includes('--dry-run');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Pooler hosts to try, likeliest first. This project is Mumbai on the `aws-1`
 * fleet; the prefix is not derivable from anything in the repo and `aws-0` is
 * the older one, so both are tried. A wrong host answers "tenant/user not
 * found" rather than refusing the connection, which reads like a bad password
 * and is worth knowing before you go changing credentials.
 */
const POOLERS = [
  'aws-1-ap-south-1',
  'aws-0-ap-south-1',
  'aws-1-ap-southeast-1',
  'aws-0-ap-southeast-1',
  'aws-0-eu-west-2',
  'aws-0-us-east-1',
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

/** Try each candidate until one accepts a connection. */
async function connect(ref, password) {
  const candidates = [
    { label: 'direct', host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres' },
    ...POOLERS.map((h) => ({
      label: `pooler ${h}`,
      host: `${h}.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${ref}`,
    })),
  ];

  const failures = [];
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: c.port,
      user: c.user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      statement_timeout: 120000,
    });
    try {
      await client.connect();
      console.log(C.dim(`  connected via ${c.label}`));
      return client;
    } catch (e) {
      failures.push(`${c.label}: ${e.message}`);
      await client.end().catch(() => {});
    }
  }
  throw new Error(`could not connect.\n    ${failures.join('\n    ')}`);
}

async function main() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
  const env = await loadEnv();
  const ref = env.SUPABASE_PROJECT_REF;
  const password = env.SUPABASE_DB_PASSWORD;

  if (!ref || !password) {
    console.error(C.red('apps/web/.env.local needs SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD'));
    process.exit(1);
  }

  const db = await connect(ref, password);

  await db.query(`
    create table if not exists public.schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )`);

  const { rows } = await db.query('select name from public.schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  // 0001 to 0003 built the project before this runner existed. Adopt them as
  // applied rather than re-running them over live tables.
  const pending = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const legacy = /^000[123]_/.test(f);
    if (legacy) {
      const { rows: t } = await db.query("select to_regclass('public.profiles') as t");
      if (t[0].t) {
        if (!DRY) await db.query('insert into public.schema_migrations (name) values ($1)', [f]);
        console.log(`${C.dim('adopt')} ${f} ${C.dim('(already in the project)')}`);
        continue;
      }
    }
    pending.push(f);
  }

  if (!pending.length) {
    console.log(C.green('\n  nothing to apply, schema is current\n'));
    await db.end();
    return;
  }

  console.log(`\n  pending: ${pending.join(', ')}\n`);
  if (DRY) {
    console.log(C.dim('  dry run, nothing applied\n'));
    await db.end();
    return;
  }

  for (const f of pending) {
    const sql = await readFile(resolve(DIR, f), 'utf8');
    try {
      await db.query('begin');
      await db.query(sql);
      await db.query('insert into public.schema_migrations (name) values ($1)', [f]);
      await db.query('commit');
      console.log(`${C.green('  ok')} ${f}`);
    } catch (e) {
      await db.query('rollback').catch(() => {});
      console.error(`${C.red('fail')} ${f}: ${e.message}`);
      await db.end();
      process.exit(1);
    }
  }

  console.log(C.dim('\n  done\n'));
  await db.end();
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
