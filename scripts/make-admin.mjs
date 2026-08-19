#!/usr/bin/env node
/**
 * Make somebody an administrator, creating their account if it does not exist.
 *
 *   node scripts/make-admin.mjs adnan@example.com                 promote an existing account
 *   node scripts/make-admin.mjs adnan@example.com 'a-password'    create it too
 *   node scripts/make-admin.mjs adnan@example.com --revoke        back to being a student
 *
 * There is no self-serve path to `role = 'admin'` and there should never be
 * one: the admin panel creates accounts, sets what teachers are paid, and
 * records money as handed over. It is reachable from a terminal with the
 * secret key, and from nowhere else.
 *
 * The role alone is not enough to get in. `ADMIN_EMAILS` in the web app's
 * environment is a second lock, so an administrator needs a database row and
 * a deploy. This script prints the reminder rather than pretending otherwise.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const email = process.argv[2];
const second = process.argv[3];
const revoke = second === '--revoke';
const password = revoke ? null : second;

if (!email || !email.includes('@')) {
  console.error('usage: node scripts/make-admin.mjs <email> [password | --revoke]');
  process.exit(1);
}

const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of text.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Paged, because listUsers caps a page and the project will outgrow one.
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
  if (!password) {
    console.error(`no account with email ${email}. Pass a password to create one:`);
    console.error(`  node scripts/make-admin.mjs ${email} 'some-password'`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('password must be at least 8 characters');
    process.exit(1);
  }
  // Confirmed on creation: there is no confirmation email to send while the
  // sending domain is unverified, and an unconfirmed account cannot sign in.
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Administrator' },
  });
  if (error) {
    console.error(`could not create the account: ${error.message}`);
    process.exit(1);
  }
  user = data.user;
  console.log(`created ${email}`);
}

const role = revoke ? 'student' : 'admin';
const { error } = await db.from('profiles').update({ role }).eq('id', user.id);
if (error) {
  console.error(`could not set the role: ${error.message}`);
  process.exit(1);
}

console.log(`${email} is now ${role === 'admin' ? 'an administrator' : 'a student again'}`);
if (!revoke) {
  console.log('\nOne more step, or the door stays shut:');
  console.log(`  add ADMIN_EMAILS=${email} to apps/web/.env.local and to the Vercel environment.`);
  console.log('  Several addresses are comma separated. Unset means the allowlist is not enforced,');
  console.log('  which is fine locally and wrong in production.');
  console.log('\nThen sign in on the website and you land on /admin.');
}
