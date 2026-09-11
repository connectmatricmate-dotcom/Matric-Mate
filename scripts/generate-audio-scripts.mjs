#!/usr/bin/env node
/**
 * Write the tutor scripts that generate-audio.mjs turns into audio lessons.
 *
 *   node scripts/generate-audio-scripts.mjs                 every chapter still missing a script
 *   node scripts/generate-audio-scripts.mjs --subject phy   one subject
 *   node scripts/generate-audio-scripts.mjs --chapter phy-1 one chapter
 *   node scripts/generate-audio-scripts.mjs --force         rewrite even if a file exists
 *   node scripts/generate-audio-scripts.mjs --board punjab  one board's chapters only
 *
 * One file per chapter and medium lands in content/generated/audio/
 * (<chapterId>-<en|ur>.txt, gitignored). generate-audio.mjs then validates,
 * narrates and publishes them; this script never touches the bucket.
 *
 * The writing runs on the client's Anthropic key from apps/web/.env.local,
 * same model as the in-app tutor. Every lesson is GROUNDED: the model gets
 * the chapter's own published sections and the board's exam share, so the
 * lesson teaches exactly what the student's notes and paper cover, in the
 * same voice and length as the three lessons the client already approved.
 */
import dns from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// This network advertises IPv6 it cannot route; a connection that tries it
// first fails as a bare "fetch failed". IPv4 only.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'content/generated/audio');

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? null : args[i + 1];
};
const FORCE = args.includes('--force');
const ONLY_SUBJECT = flag('subject');
const ONLY_CHAPTER = flag('chapter');
const ONLY_BOARD = flag('board');
const CONCURRENCY = Number(flag('concurrency')) || 4;

/** Same model as the tutor route: good in both languages, fast, affordable. */
const MODEL = 'claude-sonnet-5';

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of text.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
if (!env.ANTHROPIC_API_KEY) {
  console.error(C.red('ANTHROPIC_API_KEY missing from apps/web/.env.local'));
  process.exit(1);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * The same red flags generate-audio.mjs enforces, checked here first so a
 * bad draft is retried immediately instead of failing an hour later in TTS.
 */
const UNSPEAKABLE = [
  { re: /[=<>±×÷]/, why: 'bare maths symbol, write it in words' },
  { re: /\b\d+\s*\/\s*\d+\b/, why: 'bare fraction, write it in words' },
  { re: /\^|\bm\/s\b|\bkg\b(?!\s*\()/, why: 'bare unit or exponent, write it in words' },
  { re: /[*_#`]|\[[^\]]*\]\(/, why: 'markdown, speak plain prose' },
  { re: /—/, why: 'em dash, repo rule' },
];
const unspeakable = (t) => UNSPEAKABLE.filter(({ re }) => re.test(t)).map(({ why }) => why);

/** Flatten a chapter's published sections into plain grounding text. */
function flatten(sections, cap = 24000) {
  const parts = [];
  for (const s of sections) {
    parts.push(`## ${s.title}`);
    for (const b of s.blocks ?? []) {
      if (b.kind === 'def' && b.term) parts.push(`${b.term}: ${b.text ?? ''}`);
      else if (b.kind === 'list' && b.items) parts.push(b.items.map((i) => `- ${i}`).join('\n'));
      else if (b.kind === 'formula') parts.push(`Formula: ${b.text ?? ''}${b.caption ? ` (${b.caption})` : ''}`);
      else if (b.text) parts.push(b.text);
    }
  }
  return parts.join('\n').slice(0, cap);
}

/**
 * The lesson rules, said about the student's own board. FBISE's wording is
 * exactly what it was; a Punjab lesson names the Punjab boards' paper, which
 * all nine set from the same textbook.
 */
const rulesFor = (board) => RULES.replace('the annual FBISE paper', board === 'punjab' ? 'the annual Punjab board paper' : 'the annual FBISE paper');

const RULES = `The text you write is fed DIRECTLY to a text-to-speech voice, so it must be pure speakable prose:
- Plain paragraphs separated by blank lines. No headings, bullets, numbered lists, markdown, quotes of symbols, or stage directions.
- Never use any of these characters: = < > x-sign, division sign, plus-minus, caret, asterisk, underscore, hash, backtick, square brackets, or an em dash.
- No digits-as-symbols shortcuts: write every number, fraction, unit, formula and calculation in words. Say "twenty two percent", "three quarters", "meters per second", "force is mass multiplied by acceleration", "twenty multiplied by ten, which is two hundred newtons".
- Warm, direct teacher voice, like the best tutor at a good academy: everyday Pakistani examples (bus on GT Road, cricket, a sack of flour at the shop), short sentences, speak TO the student.

The lesson itself:
- Open by naming the chapter and, in words, its share of the annual FBISE paper, and what that means ("one mark in five"). Make the student feel why this chapter matters.
- Teach ONLY from the chapter notes provided: the concepts, definitions and formulas examiners actually test. Walk through one or two worked examples fully in words.
- Call out the mistakes markers see every year and how to avoid losing those marks.
- End with a short revision recap: exactly what to memorise and drill for the paper.`;

const EN_RULES = `Write in clear, simple English for a fourteen-year-old Pakistani student. Length: between one thousand and one thousand three hundred words.`;

const UR_RULES = `Write in Urdu, in Urdu script, never Roman Urdu. Introduce each technical term the textbook way: the Urdu term first, then its English name once in Latin script, like "کمیت، یعنی Mass"; apart from those single technical terms, no Latin script anywhere. Write all numbers out in Urdu words. Length: between one thousand two hundred and one thousand six hundred words.`;

async function writeLesson(chapter, medium, subjectName) {
  const file = resolve(OUT, `${chapter.id}-${medium}.txt`);
  const label = `${chapter.id}/${medium}`;
  if (!FORCE && existsSync(file)) return { label, status: 'exists' };

  let { data: sections } = await db
    .from('chapter_sections')
    .select('title,blocks')
    .eq('chapter_id', chapter.id)
    .eq('medium', medium)
    .eq('review_status', 'published')
    .order('position');
  if (!sections?.length && medium === 'ur') {
    ({ data: sections } = await db
      .from('chapter_sections')
      .select('title,blocks')
      .eq('chapter_id', chapter.id)
      .eq('medium', 'en')
      .eq('review_status', 'published')
      .order('position'));
  }
  if (!sections?.length) return { label, status: 'no-content' };

  const grounding = flatten(sections);
  const title = medium === 'ur' && chapter.urdu_title ? `${chapter.title} (${chapter.urdu_title})` : chapter.title;
  const shareLine = chapter.exam_share
    ? `This chapter is about ${chapter.exam_share} percent of the annual ${subjectName} paper${chapter.exam_marks ? `, roughly ${chapter.exam_marks} marks` : ''}.`
    : 'The board has not published a weightage for this chapter; open with why it matters instead of a percentage.';

  // The Urdu subject is taught in Urdu whichever medium the student reads,
  // exactly like real schools; an English lecture about an Urdu comprehension
  // chapter helps nobody, and the narrator voice follows the script language.
  const writeUrdu = medium === 'ur' || chapter.id.startsWith('urd-');

  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: `You write spoken audio lesson scripts for MatricMate, ${chapter.board === 'punjab' ? 'a Punjab Board' : 'an FBISE'} Class ${chapter.grade ?? 9} (SSC-${chapter.grade === 10 ? 'II' : 'I'}, Pakistan) exam-prep app.\n\n${rulesFor(chapter.board)}\n\n${writeUrdu ? UR_RULES : EN_RULES}`,
      messages: [
        {
          role: 'user',
          content: `Subject: ${subjectName}\nChapter ${chapter.number}: ${title}\n${shareLine}\n\nChapter notes:\n${grounding}\n\n---\nWrite the complete audio lesson script now. Output ONLY the script text, nothing else.${feedback}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return { label, status: 'refused' };
    const script = (response.content.find((b) => b.type === 'text')?.text ?? '').trim();

    const problems = unspeakable(script);
    const tooShort = script.length < (writeUrdu ? 5200 : 4800);
    if (!problems.length && !tooShort) {
      await writeFile(file, `${script}\n`, 'utf8');
      return { label, status: 'ok', chars: script.length };
    }
    feedback = `\n\nYour previous draft was rejected: ${[...problems, tooShort ? 'too short for a full lesson' : null]
      .filter(Boolean)
      .join('; ')}. Rewrite the full script fixing this.`;
  }
  return { label, status: 'failed-validation' };
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const { data: subjects } = await db.from('subjects').select('id,name');
  const names = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  let q = db
    .from('chapters')
    .select('id,subject_id,number,title,urdu_title,exam_share,exam_marks,grade,board')
    .eq('review_status', 'published')
    .order('subject_id')
    .order('number');
  if (ONLY_SUBJECT) q = q.eq('subject_id', ONLY_SUBJECT);
  if (ONLY_CHAPTER) q = q.eq('id', ONLY_CHAPTER);
  if (ONLY_BOARD) q = q.eq('board', ONLY_BOARD);
  const { data: chapters, error } = await q;
  if (error || !chapters?.length) {
    console.error(C.red(`no chapters matched${error ? `: ${error.message}` : ''}`));
    process.exit(1);
  }

  const jobs = chapters.flatMap((ch) => ['en', 'ur'].map((medium) => ({ ch, medium })));
  console.log(C.bold(`\n  ${jobs.length} lessons to write (${chapters.length} chapters)\n`));

  const started = Date.now();
  let done = 0;
  let skipped = 0;
  let failed = 0;
  let i = 0;

  const worker = async () => {
    for (;;) {
      const job = jobs[i++];
      if (!job) return;
      try {
        const r = await writeLesson(job.ch, job.medium, names.get(job.ch.subject_id) ?? job.ch.subject_id);
        if (r.status === 'ok') {
          done++;
          console.log(`${C.green('  ok ')} ${r.label.padEnd(12)} ${C.dim(`${r.chars} chars`)}`);
        } else if (r.status === 'exists') {
          skipped++;
        } else {
          failed++;
          console.log(`${C.red(' fail')} ${r.label.padEnd(12)} ${C.dim(r.status)}`);
        }
      } catch (e) {
        failed++;
        console.log(`${C.red(' fail')} ${job.ch.id}/${job.medium} ${C.dim(String(e.message).slice(0, 90))}`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(C.bold(`\n  written ${done} · already there ${skipped} · failed ${failed} · ${mins} min\n`));
  if (failed) process.exit(1);
}

await main();
