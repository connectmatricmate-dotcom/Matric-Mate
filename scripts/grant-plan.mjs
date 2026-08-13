#!/usr/bin/env node
/**
 * Grant or extend a plan by hand, from the operator's seat.
 *
 *   node scripts/grant-plan.mjs student@example.com            30 days
 *   node scripts/grant-plan.mjs student@example.com 365        a year
 *   node scripts/grant-plan.mjs student@example.com revoke     turn it off
 *
 * Under paid-only there is no free door left, so every non-Safepay grant
 * (the Play review account, the client's demo phone, a refund make-good)
 * goes through here. Writes source='manual' so revenue reports can tell
 * comps from paying customers.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const email = process.argv[2];
const arg = process.argv[3] ?? '30';
if (!email || !email.includes('@')) {
  console.error('usage: node scripts/grant-plan.mjs <email> [days|revoke]');
  process.exit(1);
}

const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of text.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Admin listing rather than a profiles query: profiles carry no email, and
// auth.users is not reachable through PostgREST. Paged, because listUsers
// caps each page and the project will outgrow one page.
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(`could not list users: ${error.message}`);
    process.exit(1);
  }
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`no account with email ${email}`);
  process.exit(1);
}

const revoke = arg === 'revoke';
const days = revoke ? 0 : Math.max(1, Number(arg) || 30);
const validTill = revoke ? new Date().toISOString() : new Date(Date.now() + days * 864e5).toISOString();

const { error } = await db.from('entitlements').upsert(
  {
    user_id: user.id,
    active: !revoke,
    plan: revoke ? null : 'premium',
    valid_till: validTill,
    source: 'manual',
  },
  { onConflict: 'user_id' },
);
if (error) {
  console.error(`grant failed: ${error.message}`);
  process.exit(1);
}
console.log(revoke ? `revoked: ${email}` : `granted: ${email} · premium until ${validTill.slice(0, 10)}`);
