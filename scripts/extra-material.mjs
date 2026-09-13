#!/usr/bin/env node
/**
 * More study material for every chapter, added beside what is already there.
 *
 *   node scripts/extra-material.mjs plan  [--board fbise|punjab] [--grade 9|10] [--chapter a,b]
 *   node scripts/extra-material.mjs check <chapter> [<chapter> ...]
 *   node scripts/extra-material.mjs load  [--dry-run] [--force] [--chapter a,b | a b]
 *
 * The first pass wrote a small bank per chapter: seven to twenty-five MCQs,
 * six flashcards, six short questions and six blanks, so a student who
 * practised a chapter twice met the same questions again, and a twenty
 * question test on a thin chapter came back short. This grows every chapter
 * to TARGET, in every language it is taught in, without touching a row that
 * is already there.
 *
 * `plan` writes one brief per chapter to content/generated/extra/briefs/: the
 * chapter's own notes to write from, what it already asks (so nothing is
 * asked twice), its learning outcomes, and how many of each kind it needs.
 * The writing is done by agents on a subscription, one JSON file per chapter
 * and language, content/generated/extra/<chapter>-<lang>.json. `check` runs
 * the loader's rules over those files so a writer can fix one before handing
 * it in, and `load` appends them.
 *
 * New rows take ids from 101 up (phy-3-en-101-q), past anything the
 * generator numbers, so the rows already there are never overwritten, and
 * loading the same file again overwrites its own rows instead of adding a
 * second copy. The same rules as generate-content.mjs apply on the way in
 * (content-rules.mjs): answers placed across A to D, blank chips shuffled, no
 * em dash, nothing with a broken character. The language subjects are taught
 * in one language (Urdu, English, and Punjab's Islamiyat), so they are written
 * once and filed under both mediums, as everywhere else.
 */

import dns from 'node:dns';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { dashless, findReferences, hasBrokenChar, orderBlankOptions, placeAnswer, splitAtGap } from './content-rules.mjs';
import { C, ROOT, loadEnv } from './pdf-vision.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const DIR = resolve(ROOT, 'content/generated/extra');
const BRIEFS = resolve(DIR, 'briefs');
const PLAN = resolve(DIR, 'plan.json');

/** What every chapter grows to, per language. */
const TARGET = { mcqs: 30, flashcards: 20, shortQs: 12, blanks: 15 };
/** New rows are numbered from here, clear of the generator's 1 to 99. */
const FIRST = 101;

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? null : rest[i + 1];
};
const DRY = rest.includes('--dry-run');
const FORCE = rest.includes('--force');
/*
 * `--chapter a,b`, or the chapter ids given bare. A bare id used to be
 * ignored by load, which then loaded every chapter there is.
 */
const VALUED = new Set(['--chapter', '--board', '--grade']);
const bare = rest.filter((a, i) => !a.startsWith('--') && !VALUED.has(rest[i - 1]));
const ONLY = flag('chapter')?.split(',').map((s) => s.trim()) ?? (bare.length ? bare : null);

/** The language a subject is written in, or null when it follows the medium. See subjectMedium in core. */
const oneLanguage = (subject, board) =>
  subject === 'urd' ? 'ur' : subject === 'eng' ? 'en' : subject === 'isl' && board === 'punjab' ? 'ur' : null;
const other = (lang) => (lang === 'en' ? 'ur' : 'en');
const languagesOf = (ch) => (oneLanguage(ch.subject_id, ch.board) ? [oneLanguage(ch.subject_id, ch.board)] : ['en', 'ur']);

const env = await loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/**
 * Every row of a query, a thousand at a time: select() stops at 1000. Each page
 * is retried like any other read, since a dropped connection here failed a
 * writer's check on a file that was fine.
 */
async function all(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const data = await retrying('page', async () => {
      const { data: rows, error } = await build().range(from, from + 999);
      if (error) throw new Error(error.message);
      return rows;
    });
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

/** Retried on the network or the database gateway giving up, never on a real refusal. */
async function retrying(label, work) {
  const flaky = (m) => /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|terminated|gateway|timeout|50[234]/i.test(m);
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (attempt >= 5 || !flaky(m)) throw new Error(`${label}: ${m}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function chaptersWanted() {
  const q = () => db.from('chapters').select('id,title,urdu_title,subject_id,grade,board,blurb').eq('review_status', 'published').order('id');
  const board = flag('board');
  const grade = flag('grade');
  const rows = await all(() => {
    let b = q();
    if (board) b = b.eq('board', board);
    if (grade) b = b.eq('grade', Number(grade));
    return b;
  });
  return ONLY ? rows.filter((r) => ONLY.includes(r.id)) : rows;
}

/** A chapter's notes as plain text, in reading order. */
function notesText(sections) {
  const lines = [];
  for (const s of sections.sort((a, b) => a.position - b.position)) {
    lines.push(`\n### ${s.title}`);
    for (const b of s.blocks ?? []) {
      if (b.kind === 'h') lines.push(`#### ${b.text}`);
      else if (b.kind === 'p') lines.push(b.text);
      else if (b.kind === 'def') lines.push(`- ${b.term}: ${b.text}`);
      else if (b.kind === 'list') lines.push(...(b.items ?? []).map((i) => `- ${typeof i === 'string' ? i : JSON.stringify(i)}`));
      else if (b.kind === 'formula') lines.push(`Formula: ${b.text}${b.caption ? ` (${b.caption})` : ''}`);
      else if (b.kind === 'example') lines.push(`Example: ${b.text ?? ''}${b.steps ? ` ${[].concat(b.steps).join(' ')}` : ''}${b.answer ? ` Answer: ${b.answer}` : ''}`);
      else lines.push(Object.values(b).filter((v) => typeof v === 'string' && v !== b.kind).join(' '));
    }
  }
  return lines.join('\n');
}

const blankSentence = (b) => `${b.before_text ?? ''} ____ ${b.after_text ?? ''}`.replace(/\s+/g, ' ').trim();

/** What a chapter already has in one medium. */
async function existing(chapterId, medium) {
  const pick = (table, cols) =>
    retrying(`${table} ${chapterId}`, async () => {
      const { data, error } = await db.from(table).select(cols).eq('chapter_id', chapterId).eq('medium', medium).range(0, 999);
      if (error) throw new Error(error.message);
      return data;
    });
  const [sections, mcqs, flashcards, shortQs, blanks] = await Promise.all([
    pick('chapter_sections', 'title,position,blocks,slo_codes'),
    pick('mcqs', 'id,q,slo_code,topic'),
    pick('flashcards', 'id,front,slo_code'),
    pick('short_questions', 'id,q,slo_code'),
    pick('blanks', 'id,before_text,after_text,slo_code'),
  ]);
  return { sections, mcqs, flashcards, shortQs, blanks };
}

const ownRows = (rows) => rows.filter((r) => !/-(\d+)-[a-z]+$/.test(r.id) || Number(/-(\d+)-[a-z]+$/.exec(r.id)[1]) < FIRST);

function briefText(ch, lang, have, slos, need, urduNotes) {
  const english = lang === 'en';
  const board = ch.board === 'punjab' ? 'Punjab Board (PCTB textbooks)' : 'FBISE (Federal Board)';
  const one = oneLanguage(ch.subject_id, ch.board);
  return `# ${ch.id} · ${ch.title}${ch.urdu_title ? ` · ${ch.urdu_title}` : ''}

Board: ${board} · Class ${ch.grade} · Subject: ${ch.subject_id}
Write this file: content/generated/extra/${ch.id}-${lang}.json (in ${english ? 'English' : 'Urdu'})
${one ? `This subject is taught in ${one === 'ur' ? 'Urdu' : 'English'} only: write it once, in that language. The app shows the same items to both mediums.` : english ? 'Write this English file first. Then write the Urdu file for this chapter as a faithful translation of these same new items (same order, same count, same answer index, same slo codes), following the Urdu notes further down for terminology.' : 'This is the Urdu file: translate the new English items for this chapter faithfully, same order, same count, same answer index, same slo codes.'}

## How many to write (new items only)
- mcqs: ${need.mcqs}
- flashcards: ${need.flashcards}
- shortQs: ${need.shortQs}
- blanks: ${need.blanks}

## Learning outcomes (use these codes for slo_code, or null)
${slos.length ? slos.map((s) => `- ${s.code}: ${String(s.text ?? s.title ?? '').replace(/\s+/g, ' ').slice(0, 220)}`).join('\n') : '- (none recorded; use null)'}

## Already in the app: do not ask these again, in any wording
MCQs:
${have.mcqs.map((m) => `- ${m.q.replace(/\s+/g, ' ').slice(0, 160)}`).join('\n') || '- (none)'}
Flashcards:
${have.flashcards.map((f) => `- ${f.front.replace(/\s+/g, ' ').slice(0, 120)}`).join('\n') || '- (none)'}
Short questions:
${have.shortQs.map((s) => `- ${s.q.replace(/\s+/g, ' ').slice(0, 160)}`).join('\n') || '- (none)'}
Blanks:
${have.blanks.map((b) => `- ${blankSentence(b).slice(0, 160)}`).join('\n') || '- (none)'}

## The chapter's notes (${english ? 'English' : 'Urdu'} medium). Write from these; stay inside this chapter.
${notesText(have.sections)}
${urduNotes ? `\n## Urdu-medium notes for this chapter (terminology to follow in the Urdu file)\n${urduNotes.slice(0, 20000)}\n` : ''}`;
}

/* ------------------------------------------------------------------ plan */

async function plan() {
  await mkdir(BRIEFS, { recursive: true });
  const chapters = await chaptersWanted();
  const codes = new Map((await all(() => db.from('curriculum_slos').select('code,title,text').order('code'))).map((s) => [s.code, s]));
  const entries = [];
  let i = 0;
  for (const ch of chapters) {
    i++;
    const langs = languagesOf(ch);
    const perLang = {};
    let urduNotes = null;
    for (const lang of langs) {
      const have = await existing(ch.id, lang);
      const base = { mcqs: ownRows(have.mcqs), flashcards: ownRows(have.flashcards), shortQs: ownRows(have.shortQs), blanks: ownRows(have.blanks) };
      const need = Object.fromEntries(Object.entries(TARGET).map(([k, t]) => [k, Math.max(0, t - base[k].length)]));
      const used = new Set(
        [...have.mcqs, ...have.flashcards, ...have.shortQs, ...have.blanks].map((r) => r.slo_code).filter(Boolean).concat(have.sections.flatMap((s) => s.slo_codes ?? [])),
      );
      const slos = [...used].filter((c) => codes.has(c)).map((c) => codes.get(c));
      if (lang === 'ur' && langs.length === 2) urduNotes = notesText(have.sections);
      perLang[lang] = { need, slos: slos.map((s) => s.code), have: { ...have, ...base } };
    }
    // One brief per chapter, written around the first language; the Urdu
    // file of a two-medium chapter is a translation of the English one, so
    // its brief section is short.
    const first = langs[0];
    let text = briefText(ch, first, perLang[first].have, perLang[first].slos.map((c) => codes.get(c)), perLang[first].need, langs.length === 2 ? urduNotes : null);
    if (langs.length === 2) {
      const ur = perLang.ur;
      text += `\n## The Urdu file\nWrite content/generated/extra/${ch.id}-ur.json with exactly the same new items as the English file, translated. The Urdu medium already has ${ur.have.mcqs.length} MCQs, ${ur.have.flashcards.length} flashcards, ${ur.have.shortQs.length} short questions and ${ur.have.blanks.length} blanks; the counts to write are the English ones above.\n`;
    }
    await writeFile(resolve(BRIEFS, `${ch.id}.md`), text);
    entries.push({
      id: ch.id,
      board: ch.board,
      grade: ch.grade,
      subject: ch.subject_id,
      languages: langs,
      need: perLang[first].need,
      slos: [...new Set(langs.flatMap((l) => perLang[l].slos))],
    });
    if (i % 25 === 0) console.log(C.dim(`  ${i} of ${chapters.length} briefs`));
  }
  let merged = entries;
  try {
    const old = JSON.parse(await readFile(PLAN, 'utf8')).chapters ?? [];
    const fresh = new Set(entries.map((e) => e.id));
    merged = [...old.filter((e) => !fresh.has(e.id)), ...entries].sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    /* first run */
  }
  await writeFile(PLAN, `${JSON.stringify({ target: TARGET, first: FIRST, chapters: merged }, null, 1)}\n`);
  const sum = (k) => entries.reduce((n, e) => n + e.need[k] * e.languages.length, 0);
  console.log(`${C.green('  ok')} ${entries.length} briefs; to write: ${sum('mcqs')} MCQs, ${sum('flashcards')} flashcards, ${sum('shortQs')} short questions, ${sum('blanks')} blanks (counting each language)`);
}

/* ----------------------------------------------------------------- check */

/**
 * For spotting a repeated question: case, spacing and sentence punctuation do
 * not make it new. Symbols do: "A + A'.B" and "A.(A+B)" are different
 * expressions, and stripping them made the two the same question.
 */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKC').replace(/[\s,;:!?"“”‘’«»،؛؟۔]+/g, '');
/**
 * For options: only spacing. Signs and decimal points are the whole
 * difference between "-3.6" and "-36", and capitals the whole point of an
 * English question on capitalisation ("lahore" against "Lahore").
 */
const sameOption = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const urduLeaning = (s) => (String(s).match(/[؀-ۿ]/g)?.length ?? 0) > (String(s).match(/[A-Za-z]/g)?.length ?? 0);
const hasLetters = (s) => /[A-Za-z؀-ۿ]/.test(String(s));
/** Options that point at other options, which cannot be shuffled. Same idea as content-rules' POSITIONAL_OPTION. */
const POSITIONAL = /\b(all|none|both|neither|either)\s+of\s+(the\s+)?(above|below|these)\b|\bboth\s+\(?\s*[a-d]\s*\)?\s+and\s+\(?\s*[a-d]\s*\)?(?=\s|$)|مذکورہ\s*بالا|درج\s*بالا|مندرجہ\s*بالا|اوپر\s+والے\s+(سب|تمام)|ان\s+میں\s+سے\s+کوئی\s+نہیں/i;

/**
 * Every rule the loader applies, as a list of problems. Empty means the file
 * loads as it is.
 */
function problemsIn(entry, lang, out, have, codes) {
  const p = [];
  const want = lang === 'ur' ? 'Urdu' : 'English';
  const lean = (s, where) => {
    if (!hasLetters(s)) return;
    // Islamiyat quotes Arabic in English files; formulas and code are Latin in Urdu ones.
    if (lang === 'ur' && !urduLeaning(s) && !/[=+×÷^<>(){}]|\d/.test(s)) p.push(`${where}: not in Urdu`);
    if (lang === 'en' && urduLeaning(s) && entry.subject !== 'isl') p.push(`${where}: not in English`);
  };
  const seen = new Set([...have.mcqs.map((m) => norm(m.q)), ...have.flashcards.map((f) => norm(f.front)), ...have.shortQs.map((s) => norm(s.q)), ...have.blanks.map((b) => norm(blankSentence(b)))]);
  const dup = (text, where) => {
    const k = norm(text);
    if (!k) return;
    if (seen.has(k)) p.push(`${where}: repeats an existing item`);
    seen.add(k);
  };
  const slo = (code, where) => {
    if (code != null && !codes.has(code)) p.push(`${where}: unknown slo_code ${code}`);
  };
  if (hasBrokenChar(out)) p.push('file contains U+FFFD broken characters');
  (out.mcqs ?? []).forEach((m, i) => {
    const w = `mcq ${i + 1}`;
    if (!m?.q?.trim()) return p.push(`${w}: empty question`);
    if (!Array.isArray(m.options) || m.options.length !== 4 || m.options.some((o) => !String(o ?? '').trim())) p.push(`${w}: needs exactly 4 options`);
    else if (new Set(m.options.map(sameOption)).size !== 4) p.push(`${w}: options repeat`);
    if (!Number.isInteger(m.answer) || m.answer < 0 || m.answer > 3) p.push(`${w}: answer must be 0 to 3`);
    if (!m.explanation?.trim()) p.push(`${w}: no explanation`);
    if (!['easy', 'medium', 'hard'].includes(m.difficulty)) p.push(`${w}: difficulty must be easy, medium or hard`);
    if ((m.options ?? []).some((o) => POSITIONAL.test(String(o)))) p.push(`${w}: an option like "all of the above" or "both a and b"`);
    // Only the certain ones: "(a)" beside acceleration may be a quantity, and
    // placement leaves a question it cannot be sure about as it was written.
    if (findReferences(String(m.explanation ?? ''), m.options ?? [], m.q).some((r) => !r.unsure)) p.push(`${w}: explanation names an option by letter or position`);
    if (!String(m.topic ?? '').trim()) p.push(`${w}: no topic`);
    lean(m.q, w);
    dup(m.q, w);
    slo(m.slo_code, w);
  });
  (out.flashcards ?? []).forEach((f, i) => {
    const w = `flashcard ${i + 1}`;
    if (!f?.front?.trim() || !f?.back?.trim()) return p.push(`${w}: empty side`);
    lean(f.front + ' ' + f.back, w);
    dup(f.front, w);
    slo(f.slo_code, w);
  });
  (out.shortQs ?? []).forEach((s, i) => {
    const w = `shortQ ${i + 1}`;
    if (!s?.q?.trim() || !s?.answer?.trim()) return p.push(`${w}: empty question or answer`);
    if (!Number.isInteger(s.marks) || s.marks < 2 || s.marks > 5) p.push(`${w}: marks must be 2 to 5`);
    if (!Array.isArray(s.points) || s.points.length < 2 || s.points.length > 6 || s.points.some((x) => !String(x ?? '').trim())) p.push(`${w}: 2 to 6 marking points`);
    lean(s.q, w);
    dup(s.q, w);
    slo(s.slo_code, w);
  });
  (out.blanks ?? []).forEach((b, i) => {
    const w = `blank ${i + 1}`;
    const opts = b?.options ?? [];
    if (!b?.answer?.trim()) return p.push(`${w}: no answer`);
    if (!Array.isArray(opts) || opts.length !== 4 || new Set(opts.map(sameOption)).size !== 4) p.push(`${w}: needs 4 different options`);
    if (!opts.includes(b.answer)) p.push(`${w}: answer is not one of the options`);
    if (/_{2,}/.test(`${b.before ?? ''}${b.after ?? ''}`)) p.push(`${w}: underscores in the sentence (the app draws the gap)`);
    if (!`${b.before ?? ''}${b.after ?? ''}`.trim()) p.push(`${w}: no sentence around the gap`);
    lean(`${b.before ?? ''} ${b.after ?? ''}`, w);
    dup(`${b.before ?? ''} ____ ${b.after ?? ''}`, w);
    slo(b.slo_code, w);
  });
  for (const k of Object.keys(TARGET)) {
    const n = (out[k] ?? []).length;
    if (n < Math.ceil(entry.need[k] * 0.8)) p.push(`${k}: ${n} written, ${entry.need[k]} asked for`);
  }
  if (!p.length && lang === 'ur' && !oneLanguage(entry.subject, entry.board)) {
    /* parity with the English file is checked by the caller */
  }
  return p.length ? p : [];
}

async function loadPlan() {
  return JSON.parse(await readFile(PLAN, 'utf8'));
}

async function readOut(id, lang) {
  try {
    return dashless(JSON.parse(await readFile(resolve(DIR, `${id}-${lang}.json`), 'utf8')));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    return { __error: `not valid JSON: ${e.message}` };
  }
}

async function codesSet() {
  return new Set((await all(() => db.from('curriculum_slos').select('code').order('code'))).map((s) => s.code));
}

async function checkChapters(ids, { quiet = false } = {}) {
  const planned = await loadPlan();
  const codes = await codesSet();
  const results = [];
  for (const id of ids) {
    const entry = planned.chapters.find((c) => c.id === id);
    if (!entry) {
      results.push({ id, ok: false, problems: ['not in the plan'] });
      continue;
    }
    const files = {};
    const problems = [];
    for (const lang of entry.languages) {
      const out = await readOut(id, lang);
      if (!out) {
        problems.push(`${lang}: file missing`);
        continue;
      }
      if (out.__error) {
        problems.push(`${lang}: ${out.__error}`);
        continue;
      }
      const have = await existing(id, lang);
      const own = { mcqs: ownRows(have.mcqs), flashcards: ownRows(have.flashcards), shortQs: ownRows(have.shortQs), blanks: ownRows(have.blanks) };
      problems.push(...problemsIn(entry, lang, out, own, codes).map((m) => `${lang}: ${m}`));
      files[lang] = out;
    }
    if (files.en && files.ur) {
      for (const k of Object.keys(TARGET)) {
        if ((files.en[k] ?? []).length !== (files.ur[k] ?? []).length) problems.push(`${k}: ${files.en[k]?.length ?? 0} in English, ${files.ur[k]?.length ?? 0} in Urdu`);
      }
      (files.en.mcqs ?? []).forEach((m, i) => {
        if (files.ur.mcqs?.[i] && files.ur.mcqs[i].answer !== m.answer) problems.push(`mcq ${i + 1}: answer differs between English and Urdu`);
      });
    }
    results.push({ id, ok: problems.length === 0, problems, files, entry });
    if (!quiet) {
      if (problems.length) console.log(`${C.red('  fix')} ${id}\n${problems.map((m) => `       ${m}`).join('\n')}`);
      else console.log(`${C.green('  ok ')} ${id}`);
    }
  }
  return results;
}

/* ------------------------------------------------------------------ load */

function rowsFor(ch, lang, out) {
  const base = { chapter_id: ch.id, medium: lang, review_status: 'published', source: 'ai' };
  const n = (i) => `${ch.id}-${lang}-${FIRST + i}`;
  const clean = (s) => (s == null ? null : String(s).trim());
  return {
    mcqs: (out.mcqs ?? []).map((m, i) => {
      const id = `${n(i)}-q`;
      const placed = placeAnswer({ q: m.q, options: m.options.map(clean), answer: m.answer, explanation: m.explanation }, id);
      return {
        ...base,
        id,
        subject_id: ch.subject,
        topic: clean(m.topic),
        q: clean(m.q),
        options: placed.options,
        answer: placed.answer,
        explanation: clean(placed.explanation),
        difficulty: m.difficulty,
        slo_code: m.slo_code ?? null,
      };
    }),
    flashcards: (out.flashcards ?? []).map((f, i) => ({ ...base, id: `${n(i)}-f`, front: clean(f.front), back: clean(f.back), slo_code: f.slo_code ?? null })),
    short_questions: (out.shortQs ?? []).map((s, i) => ({
      ...base,
      id: `${n(i)}-sq`,
      marks: s.marks,
      q: clean(s.q),
      answer: clean(s.answer),
      points: s.points.map(clean),
      slo_code: s.slo_code ?? null,
    })),
    blanks: (out.blanks ?? []).map((b, i) => {
      const id = `${n(i)}-b`;
      const halves = splitAtGap(b.before ?? '', b.after ?? '');
      return {
        ...base,
        id,
        before_text: clean(halves.before),
        after_text: clean(halves.after),
        answer: clean(b.answer),
        options: orderBlankOptions(id, b.options.map(clean), clean(b.answer)),
        slo_code: b.slo_code ?? null,
      };
    }),
  };
}

/** The same rows under the other medium, for the one-language subjects. */
const mirrored = (tables, from) =>
  Object.fromEntries(
    Object.entries(tables).map(([t, rows]) => [t, rows.map((r) => ({ ...r, medium: other(from), id: r.id.replace(`-${from}-`, `-${other(from)}-`) }))]),
  );

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    await retrying(`${table} upsert`, async () => {
      const { error } = await db.from(table).upsert(batch, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    });
  }
}

/**
 * Rows to leave out, by id: near-repeats of a question the chapter already
 * asks in that medium, found after they were written. Kept as a list rather
 * than edited out of the files, because a row's id comes from its position in
 * its file and removing one would renumber every row after it.
 */
async function skipped() {
  try {
    return new Set(JSON.parse(await readFile(resolve(DIR, 'skip.json'), 'utf8')).ids ?? []);
  } catch {
    return new Set();
  }
}

/**
 * Chapters whose new rows were corrected in the database after they were
 * loaded (a term put right across a whole chapter, say). Their files are now
 * behind the database, so loading one again would put the old wording back.
 */
async function editedInDb() {
  try {
    return new Set(JSON.parse(await readFile(resolve(DIR, 'edited.json'), 'utf8')).chapters ?? []);
  } catch {
    return new Set();
  }
}

async function load() {
  const planned = await loadPlan();
  const skip = await skipped();
  const edited = await editedInDb();
  const files = new Set((await readdir(DIR)).filter((f) => f.endsWith('.json') && f !== 'plan.json'));
  const wanted = planned.chapters.filter((c) => (!ONLY || ONLY.includes(c.id)) && c.languages.every((l) => files.has(`${c.id}-${l}.json`)));
  const refused = FORCE ? [] : wanted.filter((c) => edited.has(c.id));
  for (const c of refused) console.log(`${C.yellow('  refused')} ${c.id}: corrected in the database since it was loaded (edited.json); --force to overwrite`);
  const ready = wanted.filter((c) => !refused.includes(c));
  const results = await checkChapters(ready.map((c) => c.id), { quiet: true });
  const totals = { mcqs: 0, flashcards: 0, short_questions: 0, blanks: 0 };
  let loaded = 0;
  const held = [];
  for (const r of results) {
    if (!r.ok) {
      held.push(r);
      continue;
    }
    for (const lang of r.entry.languages) {
      const tables = rowsFor(r.entry, lang, r.files[lang]);
      const all = oneLanguage(r.entry.subject, r.entry.board) ? [tables, mirrored(tables, lang)] : [tables];
      for (const t of all) {
        for (const [table, list] of Object.entries(t)) {
          const rows = list.filter((r) => !skip.has(r.id));
          const gone = list.filter((r) => skip.has(r.id)).map((r) => r.id);
          if (!DRY) {
            await upsert(table, rows);
            if (gone.length) {
              await retrying(`${table} skip`, async () => {
                const { error } = await db.from(table).delete().in('id', gone);
                if (error) throw new Error(error.message);
              });
            }
          }
          totals[table] += rows.length;
        }
      }
    }
    loaded++;
  }
  for (const r of held) console.log(`${C.yellow('  held')} ${r.id}: ${r.problems.slice(0, 4).join('; ')}${r.problems.length > 4 ? ` (+${r.problems.length - 4} more)` : ''}`);
  console.log(
    `${DRY ? C.dim('  dry run: ') : C.green('  ok ')}${loaded} chapters loaded, ${held.length} held back; ` +
      `${totals.mcqs} MCQs, ${totals.flashcards} flashcards, ${totals.short_questions} short questions, ${totals.blanks} blanks (rows, both mediums)`,
  );
}

if (cmd === 'plan') await plan();
else if (cmd === 'check') {
  const r = await checkChapters(rest.filter((a) => !a.startsWith('--')));
  process.exit(r.every((x) => x.ok) ? 0 : 1);
} else if (cmd === 'load') await load();
else {
  console.log('usage: node scripts/extra-material.mjs plan|check <chapter...>|load [--dry-run] [--force] [--chapter a,b | a b] [--board b] [--grade g]');
  process.exit(1);
}
