#!/usr/bin/env node
/**
 * Which lessons get the premium voice, and their narration on the server.
 *
 *   node scripts/voice-scope.mjs              list the scope, change nothing
 *   node scripts/voice-scope.mjs --upload     store each in-scope lesson's text (voice_scripts)
 *   node scripts/voice-scope.mjs --enable     also mark their tracks voice_pending, so the apps
 *                                             stream the premium voice until each is generated
 *   node scripts/voice-scope.mjs --disable    clear voice_pending everywhere: nothing more is made,
 *                                             lessons already finished keep their new voice
 *   node scripts/voice-scope.mjs --tidy       for lessons already finished in the new voice: delete the
 *                                             recordings they replaced and the parts they were joined
 *                                             from (the website does this itself as each one finishes)
 *
 * The client's rule (15 Sep 2026): pronunciation has to be exactly right for
 * Islamic content, so the premium voice reads
 *
 *   every Islamiyat lesson, in both mediums and both boards,
 *   every lesson of the Urdu subject,
 *   and any other lesson whose narration has real Islamic content: the
 *   Prophet ﷺ and his companions with their honorifics, the Quran, Hadith, a
 *   Surah, Allah (Pakistan Studies' Two-Nation Theory and Objectives
 *   Resolution, Punjab English on the Holy Prophet, a Biology chapter quoting
 *   the Quran).
 *
 * Greetings, blessings and sign-offs do not count: nearly every Urdu lesson
 * ends with "اللہ حافظ" or "اللہ آپ کی محنت میں برکت دے", or opens with
 * "ماشاءاللہ" or "بسم اللہ کرتے ہیں", and the current voice says those well.
 * Everything else keeps the voice it has.
 *
 * Reads the narration from content/generated/audio, the same files the
 * current recordings were made from.
 */
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dns from 'node:dns';
import net from 'node:net';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = resolve(ROOT, 'content/generated/audio');
const require = createRequire(resolve(ROOT, 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const UPLOAD = process.argv.includes('--upload') || process.argv.includes('--enable');
const ENABLE = process.argv.includes('--enable');
const DISABLE = process.argv.includes('--disable');
const TIDY = process.argv.includes('--tidy');

/** Whole subjects in scope, by subject id (the chapter id's first part). */
const WHOLE = new Set(['isl', 'urd']);

const SIGNOFF = [
  /اللہ حافظ/g,
  /ماشاء ?اللہ/g,
  /ان ?شاء ?اللہ/g,
  /انشاءاللہ/g,
  /السلام علیکم/g,
  /اللہ (آپ کی|تمہاری) محنت میں برکت (دے|ڈالے)/g,
  /اللہ آپ کو کامیاب کرے/g,
  /بسم اللہ کرتے ہیں/g,
  /Assalam o Alaikum/gi,
  /Allah Hafiz/gi,
  /In ?sha ?Allah/gi,
  /Masha ?Allah/gi,
];
const ISLAMIC_EN = [
  /peace be upon him/gi,
  /pleased with (him|her|them)/gi,
  /mercy on him/gi,
  /\bQuran/g,
  /\bHadith/g,
  /\bHazrat\b/g,
  /\bSurah\b/g,
  /\bHoly Prophet\b/g,
  /\bProphet Muhammad\b/g,
  /\bAllah\b/g,
  /\bSahaba\b/g,
  /\bKhalifa\b/g,
];
const ISLAMIC_UR = [
  /صلی اللہ/g,
  /رضی اللہ/g,
  /علیہ السلام/g,
  /رحمۃ اللہ/g,
  /رحمت اللہ علیہ/g,
  /قرآن/g,
  /حدیث/g,
  /احادیث/g,
  /حضرت/g,
  /سورۃ/g,
  /سورہ/g,
  /نبی کریم/g,
  /رسول اللہ/g,
  /اللہ/g,
  /صحابہ/g,
  /خلیفہ/g,
];

/** How many Islamic terms a lesson's narration carries, after greetings are set aside. */
function islamicTerms(text, medium) {
  let t = text;
  for (const p of SIGNOFF) t = t.replace(p, ' ');
  return (medium === 'ur' ? ISLAMIC_UR : ISLAMIC_EN).reduce((n, p) => n + (t.match(p)?.length ?? 0), 0);
}

/** isl-pj-10-1-ur.txt -> { chapter: 'isl-pj-10-1', medium: 'ur' } */
function parse(file) {
  const m = file.match(/^(.+)-(en|ur)\.txt$/);
  return m ? { chapter: m[1], medium: m[2], subject: m[1].split('-')[0] } : null;
}

const files = (await readdir(AUDIO)).filter((f) => f.endsWith('.txt')).sort();
const scope = [];
for (const file of files) {
  const p = parse(file);
  if (!p) continue;
  const body = (await readFile(resolve(AUDIO, file), 'utf8')).trim();
  const terms = islamicTerms(body, p.medium);
  const reason = WHOLE.has(p.subject) ? p.subject : terms > 0 ? `islamic (${terms})` : null;
  if (reason) scope.push({ ...p, body, reason });
}

const bySubject = {};
for (const s of scope) {
  const k = `${s.subject} ${s.medium}`;
  bySubject[k] ??= { lessons: 0, chars: 0 };
  bySubject[k].lessons += 1;
  bySubject[k].chars += s.body.length;
}
console.log('In scope:');
for (const [k, v] of Object.entries(bySubject).sort()) console.log(`  ${k.padEnd(8)} ${String(v.lessons).padStart(3)} lessons  ${v.chars.toLocaleString('en-US').padStart(9)} chars`);
console.log(`  total    ${scope.length} lessons  ${scope.reduce((n, s) => n + s.body.length, 0).toLocaleString('en-US')} chars`);

if (!UPLOAD && !DISABLE && !TIDY) process.exit(0);

const env = {};
for (const line of (await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8')).split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

if (TIDY) {
  // Nothing plays a finished lesson's old recording or its parts again. Only
  // files in the lesson's own folder named for its medium, and only those no
  // track row points at, so nothing a student can hear is touched.
  const { data: all, error } = await admin.from('audio_tracks').select('id, chapter_id, medium, storage_path, voice').range(0, 4999);
  if (error) throw error;
  const playing = new Set(all.map((t) => t.storage_path));
  let files = 0;
  for (const t of all.filter((x) => x.voice)) {
    const { data: inFolder, error: le } = await admin.storage.from('audio').list(t.chapter_id, { limit: 100 });
    if (le) throw le;
    const gone = inFolder
      .map((f) => `${t.chapter_id}/${f.name}`)
      .filter((p) => !playing.has(p) && new RegExp(`^${t.chapter_id}/${t.medium}(-[0-9a-f]{10})?\\.mp3$`).test(p));
    const { data: parts, error: pe } = await admin.storage.from('audio').list(`voice-parts/${t.voice}/${t.chapter_id}/${t.medium}`, { limit: 100 });
    if (pe) throw pe;
    gone.push(...parts.map((f) => `voice-parts/${t.voice}/${t.chapter_id}/${t.medium}/${f.name}`));
    if (gone.length) {
      const { error: re } = await admin.storage.from('audio').remove(gone);
      if (re) throw re;
      files += gone.length;
      console.log(`  ${t.id}: deleted ${gone.join(', ')}`);
    }
    const { error: de } = await admin.from('voice_parts').delete().eq('chapter_id', t.chapter_id).eq('medium', t.medium).eq('voice', t.voice);
    if (de) throw de;
  }
  console.log(`Tidied ${all.filter((x) => x.voice).length} finished lesson(s), ${files} file(s) deleted.`);
  process.exit(0);
}

if (DISABLE) {
  const { error } = await admin.from('audio_tracks').update({ voice_pending: false }).eq('voice_pending', true);
  if (error) throw error;
  console.log('voice_pending cleared on every track.');
  process.exit(0);
}

// Only chapters and recordings that exist in the database: a script for a
// chapter that was never published has nothing to replace.
const { data: tracks, error: te } = await admin.from('audio_tracks').select('id, chapter_id, medium, voice').range(0, 4999);
if (te) throw te;
const track = new Map(tracks.map((t) => [`${t.chapter_id}|${t.medium}`, t]));
const rows = scope.filter((s) => track.has(`${s.chapter}|${s.medium}`)).map((s) => ({ chapter_id: s.chapter, medium: s.medium, body: s.body }));
const missing = scope.filter((s) => !track.has(`${s.chapter}|${s.medium}`));
if (missing.length) console.log(`No recording in the database for ${missing.length}: ${missing.map((s) => `${s.chapter}-${s.medium}`).join(', ')}`);

for (let i = 0; i < rows.length; i += 50) {
  const { error } = await admin.from('voice_scripts').upsert(rows.slice(i, i + 50), { onConflict: 'chapter_id,medium' });
  if (error) throw error;
}
console.log(`Stored ${rows.length} lesson texts in voice_scripts.`);

// A lesson that has left the scope (the rule changed) goes back to its file.
const keep = new Set(rows.map((r) => `${r.chapter_id}|${r.medium}`));
const { data: stored, error: se } = await admin.from('voice_scripts').select('chapter_id, medium').range(0, 4999);
if (se) throw se;
const gone = stored.filter((r) => !keep.has(`${r.chapter_id}|${r.medium}`));
for (const r of gone) {
  const { error } = await admin.from('voice_scripts').delete().eq('chapter_id', r.chapter_id).eq('medium', r.medium);
  if (error) throw error;
  await admin.from('audio_tracks').update({ voice_pending: false }).eq('id', `${r.chapter_id}-${r.medium}`);
}
if (gone.length) console.log(`Took ${gone.length} out of scope: ${gone.map((r) => `${r.chapter_id}-${r.medium}`).join(', ')}`);

if (ENABLE) {
  // Only those not already finished in the voice now chosen: a finished
  // lesson is a file again. The key is the one the website files it under
  // (lib/voice/lesson.ts), so choosing another voice marks them all again.
  const { data: settings, error: ve } = await admin.from('voice_settings').select('voice_ur, voice_en, model').maybeSingle();
  if (ve || !settings?.voice_ur) throw new Error('voice_settings has no Urdu voice chosen yet');
  const keyFor = (medium) =>
    createHash('sha256').update(`${settings.model}:${medium === 'ur' ? settings.voice_ur : (settings.voice_en ?? settings.voice_ur)}`).digest('hex').slice(0, 10);
  const ids = rows
    .filter((r) => tracks.find((t) => t.id === `${r.chapter_id}-${r.medium}`)?.voice !== keyFor(r.medium))
    .map((r) => `${r.chapter_id}-${r.medium}`);
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await admin.from('audio_tracks').update({ voice_pending: true }).in('id', ids.slice(i, i + 100));
    if (error) throw error;
  }
  console.log(`Marked ${ids.length} tracks voice_pending.`);
}
