#!/usr/bin/env node
/**
 * Turn written tutor scripts into audio lessons and publish them.
 *
 *   node scripts/generate-audio.mjs --chapter phy-1            one chapter, both mediums
 *   node scripts/generate-audio.mjs --subject phy              a subject
 *   node scripts/generate-audio.mjs                            everything with a script on disk
 *   node scripts/generate-audio.mjs --dry-run                  say what it would do
 *
 * WHERE THE SCRIPTS COME FROM
 *
 * Not from this file. A tutor script is written per chapter into
 * `content/generated/audio/<chapterId>-<medium>.txt` (gitignored, regenerable),
 * the same seam the study content uses: agents write, a script validates and
 * publishes. Narrating the notes verbatim does not work, because notes are
 * written to be read and audio has to be written to be heard.
 *
 * WHY edge-tts
 *
 * `ur-PK-UzmaNeural` is a genuine Pakistani Urdu neural voice. Every free
 * downloadable Urdu model is a hobby fine-tune that sounds robotic, and the
 * good voices are cloud-only. edge-tts reaches the same voices Microsoft Edge's
 * read-aloud uses, with no key and no character cap.
 *
 * It is unofficial and could be blocked without notice. That risk is bounded on
 * purpose: we generate once, store the MP3s, and never call it at runtime. If
 * it stops working tomorrow every student keeps their audio.
 *
 * The MP3s go to the public `audio` bucket and a row lands in `audio_tracks`,
 * which the player already reads. Until a row exists the app shows no audio at
 * all, which is the honest state.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = resolve(ROOT, 'content/generated/audio');
const WORK = resolve(ROOT, 'content/.audio-build');

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? null : args[i + 1];
};
const DRY = args.includes('--dry-run');
/** Skip lessons that already have a published audio_tracks row. */
const MISSING_ONLY = args.includes('--missing');
const ONLY_CHAPTER = flag('chapter');
const ONLY_SUBJECT = flag('subject');
/** Parallel narrations. edge-tts tolerates a few at once; keep it modest. */
const CONCURRENCY = Number(flag('concurrency')) || 1;

const BUCKET = 'audio';

/**
 * One voice per medium, chosen and not to be changed casually.
 *
 * A student who has listened to twenty chapters in one voice should not meet a
 * different one in chapter twenty-one. Changing these means regenerating
 * everything, not just new chapters.
 */
const VOICE = {
  ur: 'ur-PK-UzmaNeural',
  en: 'en-US-AriaNeural',
};

/** Slightly slower than default. This is teaching, not a news bulletin. */
const RATE = '-8%';

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

async function loadEnv() {
  const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

/**
 * Things a script must not contain, because TTS reads them wrong and a student
 * hears nonsense. The script writer is told to avoid these; this is the net.
 */
const UNSPEAKABLE = [
  { re: /[=<>±×÷]/, why: 'bare maths symbol, write it in words' },
  { re: /\b\d+\s*\/\s*\d+\b/, why: 'bare fraction, write it in words' },
  { re: /\^|\bm\/s\b|\bkg\b(?!\s*\()/, why: 'bare unit or exponent, write it in words' },
  { re: /[*_#`]|\[[^\]]*\]\(/, why: 'markdown, speak plain prose' },
  { re: /—/, why: 'em dash, repo rule' },
];

function unspeakable(text) {
  return UNSPEAKABLE.filter(({ re }) => re.test(text)).map(({ why }) => why);
}

/** Rough spoken length. Urdu runs slower per character than English. */
const estimateSeconds = (text, medium) => Math.round(text.length / (medium === 'ur' ? 11 : 14));

async function main() {
  const env = await loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

  let files;
  try {
    files = (await readdir(SCRIPTS)).filter((f) => f.endsWith('.txt'));
  } catch {
    console.error(C.red(`no scripts in ${SCRIPTS}. Write them there first, one per chapter and medium.`));
    process.exit(1);
  }

  let jobs = files
    .map((f) => {
      const m = f.match(/^(.+)-(en|ur)\.txt$/);
      return m ? { file: f, chapterId: m[1], medium: m[2] } : null;
    })
    .filter(Boolean)
    .filter((j) => (ONLY_CHAPTER ? j.chapterId === ONLY_CHAPTER : true))
    .filter((j) => (ONLY_SUBJECT ? j.chapterId.startsWith(`${ONLY_SUBJECT}-`) : true))
    .sort((a, b) => a.file.localeCompare(b.file));

  if (MISSING_ONLY) {
    // Regenerating an already-published lesson wastes an hour and re-uploads
    // audio the client may have already approved; --missing narrates only
    // what the app does not have yet.
    const { data: rows } = await db.from('audio_tracks').select('chapter_id,medium');
    const have = new Set((rows ?? []).map((r) => `${r.chapter_id}-${r.medium}`));
    jobs = jobs.filter((j) => !have.has(`${j.chapterId}-${j.medium}`));
  }

  if (!jobs.length) {
    console.error(C.red('nothing matched'));
    process.exit(1);
  }

  if (!DRY) {
    await mkdir(WORK, { recursive: true });
    const { data: buckets } = await db.storage.listBuckets();
    if (!(buckets ?? []).some((b) => b.name === BUCKET)) {
      // Public: these are our own lessons and signing every URL would add
      // expiry handling to an audio player for no benefit. The paywall is on
      // the chapter, not on the file.
      const { error } = await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '50MB' });
      if (error) throw new Error(`could not create bucket: ${error.message}`);
      console.log(`${C.green('  ok')} created public bucket ${BUCKET}`);
    }
  }

  console.log(C.bold(`\n  ${jobs.length} lessons${DRY ? ' (dry run)' : ''}\n`));

  const started = Date.now();
  let done = 0;
  let skipped = 0;

  const processOne = async ({ file, chapterId, medium }) => {
    const text = (await readFile(resolve(SCRIPTS, file), 'utf8')).trim();
    const label = `${chapterId}/${medium}`;

    /**
     * The voice must match the language ON THE PAGE, not the app medium.
     * The Urdu subject is written in Urdu for English-medium students too,
     * exactly like real schools, and an American voice reading Urdu script
     * is noise. Any script that is mostly Arabic-script gets the Urdu voice.
     */
    const urduChars = (text.match(/[؀-ۿ]/g) ?? []).length;
    const voiceLang = urduChars > text.length * 0.2 ? 'ur' : 'en';

    if (text.length < 400) {
      console.log(`${C.red('  bad')} ${label.padEnd(14)} ${C.dim('script too short to be a lesson')}`);
      skipped++;
      return;
    }
    const problems = unspeakable(text);
    if (problems.length) {
      console.log(`${C.red('  bad')} ${label.padEnd(14)} ${C.dim(problems.join('; '))}`);
      skipped++;
      return;
    }

    if (DRY) {
      console.log(`${C.dim('  --  ')} ${label.padEnd(14)} ${C.dim(`${text.length} chars, about ${estimateSeconds(text, voiceLang)}s`)}`);
      return;
    }

    const mp3 = resolve(WORK, `${chapterId}-${medium}.mp3`);
    try {
      await run('python3', [
        '-c',
        [
          'import asyncio,sys,edge_tts',
          'txt=open(sys.argv[1],encoding="utf-8").read()',
          'asyncio.run(edge_tts.Communicate(txt, sys.argv[2], rate=sys.argv[3]).save(sys.argv[4]))',
        ].join('\n'),
        resolve(SCRIPTS, file),
        VOICE[voiceLang],
        RATE,
        mp3,
      ]);
    } catch (e) {
      console.log(`${C.red(' fail')} ${label.padEnd(14)} ${C.dim(`tts: ${String(e.message).slice(0, 80)}`)}`);
      skipped++;
      return;
    }

    const bytes = (await stat(mp3)).size;
    // edge-tts writes an empty file rather than erroring when the service
    // refuses, so an implausibly small MP3 means failure, not a short lesson.
    if (bytes < 20000) {
      console.log(`${C.red(' fail')} ${label.padEnd(14)} ${C.dim(`only ${bytes} bytes, the service likely refused`)}`);
      await unlink(mp3).catch(() => {});
      skipped++;
      return;
    }

    const path = `${chapterId}/${medium}.mp3`;
    const body = await readFile(mp3);
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, body, { contentType: 'audio/mpeg', upsert: true });
    if (upErr) {
      console.log(`${C.red(' fail')} ${label.padEnd(14)} ${C.dim(`upload: ${upErr.message}`)}`);
      skipped++;
      return;
    }

    // Read the real duration out of the file rather than inferring it.
    //
    // This was `bytes / 3000`, assuming 24kbps. edge-tts actually returns
    // 48kbps, so every duration was double the truth and a nine minute lesson
    // was advertised as eighteen. Guessing a number and showing it to a student
    // is how the fake "11 min Urdu narration" got there in the first place.
    let seconds = 0;
    try {
      const { stdout } = await run('python3', [
        '-c',
        'import sys;from mutagen.mp3 import MP3;print(int(MP3(sys.argv[1]).info.length))',
        mp3,
      ]);
      seconds = Number(stdout.trim()) || 0;
    } catch {
      seconds = 0;
    }
    if (!seconds) {
      console.log(`${C.red(' fail')} ${label.padEnd(14)} ${C.dim('could not read duration, refusing to guess')}`);
      await unlink(mp3).catch(() => {});
      skipped++;
      return;
    }

    const { error: rowErr } = await db.from('audio_tracks').upsert(
      {
        id: `${chapterId}-${medium}`,
        chapter_id: chapterId,
        medium,
        title: `${chapterId} audio lesson`,
        storage_path: path,
        duration_secs: seconds,
        bytes,
        review_status: 'published',
      },
      { onConflict: 'id' },
    );
    if (rowErr) {
      console.log(`${C.red(' fail')} ${label.padEnd(14)} ${C.dim(`row: ${rowErr.message}`)}`);
      skipped++;
      return;
    }

    await unlink(mp3).catch(() => {});
    done++;
    const mins = Math.floor(seconds / 60);
    console.log(
      `${C.green('   ok')} ${label.padEnd(14)} ${C.dim(`${mins}m ${seconds % 60}s · ${(bytes / 1024).toFixed(0)} KB`)}`,
    );
  };

  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const job = jobs[cursor++];
      if (!job) return;
      try {
        await processOne(job);
      } catch (e) {
        skipped++;
        console.log(`${C.red(' fail')} ${job.chapterId}/${job.medium} ${C.dim(String(e.message).slice(0, 80))}`);
      }
    }
  };
  await Promise.all(Array.from({ length: DRY ? 1 : CONCURRENCY }, worker));

  const elapsed = (Date.now() - started) / 1000;
  console.log(
    C.dim(
      `\n  ${done} published, ${skipped} skipped, ${elapsed.toFixed(0)}s` +
        `${done ? ` · about ${(elapsed / done).toFixed(0)}s each` : ''}\n`,
    ),
  );
  if (skipped) process.exit(1);
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
