#!/usr/bin/env node
/**
 * Makes premium-voice lessons ahead of any student, so the first listener
 * gets a finished file (skipping works from the first second) instead of the
 * stream. Optional: every lesson is made on its first play anyway. Useful
 * before a class is told to listen to a particular chapter.
 *
 *   node scripts/warm-voices.mjs <site> isl-1-ur urd-9-1-ur      these lessons
 *   node scripts/warm-voices.mjs <site> --subject isl --medium ur  a subject's lessons
 *     [--max-chars 50000]                                          stop before this many characters
 *
 * <site> is the website that does the work, e.g. https://matric-mate-web.vercel.app
 * (or http://localhost:3100 for a local run). The website makes each lesson
 * with its own key and settings (voice_settings), under the same monthly
 * allowance as the students' plays; this only asks it to, one lesson at a
 * time, with the cron secret.
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dns from 'node:dns';
import net from 'node:net';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(ROOT, 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const site = (args.shift() ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(site)) {
  console.error('Usage: node scripts/warm-voices.mjs <site> (<lesson id>... | --subject isl [--medium ur]) [--max-chars N]');
  process.exit(1);
}
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const subject = flag('--subject');
const medium = flag('--medium');
const maxChars = Number(flag('--max-chars')) || Infinity;
const named = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));

const env = {};
for (const line of (await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8')).split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const secret = process.env.CRON_SECRET || env.CRON_SECRET;
if (!secret) throw new Error('CRON_SECRET is not set (environment or apps/web/.env.local)');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data: scripts, error } = await admin.from('voice_scripts').select('chapter_id, medium, body').order('chapter_id').range(0, 4999);
if (error) throw error;
const lessons = scripts.filter((s) =>
  named.length ? named.includes(`${s.chapter_id}-${s.medium}`) : (!subject || s.chapter_id.split('-')[0] === subject) && (!medium || s.medium === medium),
);
if (!lessons.length) {
  console.log('No lessons in scope match.');
  process.exit(0);
}

let spent = 0;
for (const l of lessons) {
  const id = `${l.chapter_id}-${l.medium}`;
  if (spent + l.body.length > maxChars) {
    console.log(`Stopping before ${id}: --max-chars ${maxChars} reached.`);
    break;
  }
  // A long lesson can take more than one call: each makes what it can in the
  // time a call has, and the next carries on.
  for (let round = 1; round <= 6; round++) {
    const t0 = Date.now();
    const res = await fetch(`${site}/api/audio/voice/warm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ chapter: l.chapter_id, medium: l.medium }),
    });
    const body = await res.json().catch(() => ({}));
    const secs = Math.round((Date.now() - t0) / 1000);
    if (!res.ok) {
      console.log(`  ${id}: ${res.status} ${body.error ?? ''} ${body.message ?? ''} (${secs}s)`);
      if (body.error === 'budget' || body.error === 'voice_off' || res.status === 401) process.exit(1);
      break;
    }
    console.log(`  ${id}: ${body.made} part(s) made, ${body.done ? 'finished' : `${body.remainingChars} characters to go`} (${secs}s)`);
    if (body.done) break;
  }
  spent += l.body.length;
}
