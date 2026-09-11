#!/usr/bin/env node
/**
 * Put each language subject in its own language, for every student.
 *
 *   node scripts/one-language-subjects.mjs --dry-run   say what would change
 *   node scripts/one-language-subjects.mjs             change it, keeping a backup
 *
 * Urdu is taught in Urdu, English in English, and Punjab's Islamiyat in Urdu,
 * the only language its book exists in, whatever medium a student reads in.
 * Content was generated for both mediums anyway, so an English-medium student
 * opening an Urdu poem read English notes about it, and an Urdu-medium student
 * opening an English essay read Urdu ones. generate-content.mjs now writes a
 * one-language subject once and files it under both mediums; this does the
 * same for what is already in the database.
 *
 * For each chapter, the rows in the subject's own language are copied over the
 * other medium's, table by table, in the same id slots the generator uses, so
 * a student's saved answers and read sections still point at a row. A chapter
 * with nothing yet in its own language is left alone and reported: the wrong
 * language is still better than an empty chapter until the right one exists.
 * The other medium's audio track is removed where the right-language one
 * exists; the player falls back to whatever track a chapter has. Everything
 * replaced is saved to content/.one-language-backup/ first.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

const DRY = process.argv.includes('--dry-run');
const RULES = [
  { subject: 'urd', language: 'ur', boards: ['fbise', 'punjab'] },
  { subject: 'eng', language: 'en', boards: ['fbise', 'punjab'] },
  { subject: 'isl', language: 'ur', boards: ['punjab'] },
];
const TABLES = ['chapter_sections', 'mcqs', 'flashcards', 'short_questions', 'blanks'];
const other = (m) => (m === 'en' ? 'ur' : 'en');
/** The generator's id slot for the same row in the other medium. */
const slot = (id, from, to) => (id.includes(`-${from}-`) ? id.replace(`-${from}-`, `-${to}-`) : `${id}-${to}`);

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const backupDir = resolve(ROOT, 'content/.one-language-backup');
if (!DRY) await mkdir(backupDir, { recursive: true });
const backup = [];

const read = async (table, chapterId, medium) => {
  const { data, error } = await db.from(table).select('*').eq('chapter_id', chapterId).eq('medium', medium).range(0, 999);
  if (error) throw new Error(`${table} ${chapterId}: ${error.message}`);
  return data;
};

let mirrored = 0;
let waiting = 0;
let tracksRemoved = 0;
for (const { subject, language, boards } of RULES) {
  const target = other(language);
  const { data: chapters, error } = await db
    .from('chapters')
    .select('id,board')
    .eq('subject_id', subject)
    .in('board', boards)
    .order('id');
  if (error) throw new Error(error.message);

  for (const ch of chapters) {
    const own = await read('chapter_sections', ch.id, language);
    if (!own.length) {
      waiting++;
      console.log(C.yellow(`  wait  ${ch.id}: nothing in ${language} yet, left as it is`));
      continue;
    }
    if (DRY) {
      mirrored++;
      continue;
    }
    for (const table of TABLES) {
      const source = table === 'chapter_sections' ? own : await read(table, ch.id, language);
      const replaced = await read(table, ch.id, target);
      backup.push({ table, chapter: ch.id, medium: target, rows: replaced });
      const { error: de } = await db.from(table).delete().eq('chapter_id', ch.id).eq('medium', target);
      if (de) throw new Error(`${table} ${ch.id} clear: ${de.message}`);
      if (!source.length) continue;
      const copies = source.map(({ created_at: _c, updated_at: _u, ...row }) => ({ ...row, id: slot(row.id, language, target), medium: target }));
      const { error: ie } = await db.from(table).insert(copies);
      if (ie) throw new Error(`${table} ${ch.id} insert: ${ie.message}`);
    }
    // One recording is enough: the player falls back to whatever track exists.
    const { data: tracks } = await db.from('audio_tracks').select('*').eq('chapter_id', ch.id);
    if ((tracks ?? []).some((t) => t.medium === language)) {
      const extra = (tracks ?? []).filter((t) => t.medium === target);
      if (extra.length) {
        backup.push({ table: 'audio_tracks', chapter: ch.id, medium: target, rows: extra });
        const { error: te } = await db.from('audio_tracks').delete().eq('chapter_id', ch.id).eq('medium', target);
        if (te) throw new Error(`audio ${ch.id}: ${te.message}`);
        tracksRemoved += extra.length;
      }
    }
    mirrored++;
  }
}

if (!DRY && backup.length) {
  await writeFile(resolve(backupDir, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), `${JSON.stringify(backup, null, 1)}\n`);
}
console.log(
  `\n${DRY ? C.dim('  dry run: ') : C.green('  ok ')}${mirrored} chapters in their own language for both mediums` +
    `${waiting ? `, ${waiting} waiting for their own-language content` : ''}${tracksRemoved ? `, ${tracksRemoved} duplicate audio tracks removed` : ''}\n`,
);
