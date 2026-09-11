#!/usr/bin/env node
/**
 * Write the study material, grounded in the board's own learning outcomes.
 *
 *   node scripts/generate-content.mjs --subject phy --limit 1 --dry-run
 *   node scripts/generate-content.mjs --subject phy
 *   node scripts/generate-content.mjs                      every chapter
 *   node scripts/generate-content.mjs --medium ur          Urdu only
 *   node scripts/generate-content.mjs --chapter isl-6      one chapter only
 *   node scripts/generate-content.mjs --remap              redo SLO to chapter mapping
 *
 * TWO PHASES
 *
 * 1. MAP. The board organises outcomes into lettered domains; the app is
 *    organised into chapters. Nothing in either document connects the two, and a
 *    fuzzy string match would be confidently wrong, so one model call per
 *    subject assigns each outcome to a chapter. Cached in data/fbise/mapping/.
 *
 * 2. GENERATE. One call per chapter per medium, given only that chapter's
 *    outcomes. Small prompts beat big ones here: a model asked for nine
 *    chapters at once writes nine shallow ones.
 *
 * WHAT MAKES THIS EXAM PREP RATHER THAN A CHATBOT TRANSCRIPT
 *
 *   * Every question carries the `slo_code` it was written for. That is the
 *     audit trail, and it is what stops the model wandering off into whatever
 *     it finds interesting about a topic.
 *   * Formative outcomes are skipped. About a quarter of the curriculum is
 *     taught but never examined, and a question on it wastes a student's time.
 *   * Cognitive level drives question type. The board sets papers to roughly
 *     30% knowledge, 50% understanding, 20% application, and every outcome
 *     states its level, so the question mix follows the real paper.
 *   * Every wrong option has to be a mistake a real student makes. Three
 *     obviously silly options and one right one teaches nothing.
 *
 * VALIDATION IS NOT OPTIONAL
 *
 * Content is published without human review, by the client's explicit
 * instruction. So the checks in `validate()` are the only thing standing
 * between a model slip and a student learning the wrong answer before their
 * board exam. A chapter that fails is dropped whole and reported, never
 * partially written.
 */

import dns from 'node:dns';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This network advertises IPv6 it cannot route, and a connection that tries
// it first fails as a bare "fetch failed". IPv4 only.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Which class to generate for. Grade 10 reads its curriculum from
 * data/fbise/ssc2/, its chapter spec from chapters-ssc2.json, keeps its
 * mapping cache and generated copies in grade-suffixed folders, and asks the
 * model for Class 10 material. Every grade-9 path and prompt stays
 * byte-identical when the flag is absent. When more boards arrive, this
 * pair of knobs (board dir, grade) is the whole extension surface.
 */
const GRADE = (() => {
  const i = process.argv.indexOf('--grade');
  return i === -1 ? 9 : Number(process.argv[i + 1]) || 9;
})();
const GRADE_LABEL = `Class ${GRADE}`;

/**
 * Which board. `--board punjab` reads chapters and outcomes from
 * data/punjab/catalogue.json, built from the board's own 2023 textbooks.
 * Every Punjab outcome is printed inside the chapter it belongs to, so there
 * is no mapping phase: the catalogue already says which chapter each one is.
 * Generated copies go to content/generated/punjab/, and the prompts name the
 * Punjab boards and their paper instead of the Federal Board's. With the flag
 * absent, every FBISE path and prompt is exactly what it was.
 */
const BOARD = (() => {
  const i = process.argv.indexOf('--board');
  return i !== -1 && process.argv[i + 1] === 'punjab' ? 'punjab' : 'fbise';
})();
const PUNJAB = BOARD === 'punjab';
const BOARD_LABEL = PUNJAB ? 'Punjab board' : 'FBISE';

const DATA = resolve(ROOT, GRADE === 10 ? 'data/fbise/ssc2' : 'data/fbise');
const MAPDIR = resolve(DATA, 'mapping');
const GENDIR = PUNJAB
  ? resolve(ROOT, `content/generated/punjab/grade-${GRADE}`)
  : resolve(ROOT, GRADE === 10 ? 'content/generated/ssc2' : 'content/generated');
const SPEC_FILE = GRADE === 10 ? resolve(ROOT, 'data/fbise/chapters-ssc2.json') : null;

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? true);
};
const DRY = args.includes('--dry-run');
// Two modes that split generation away from the database, so the writing can be
// done by agents on a subscription instead of by metered API calls, while the
// validation and insert path below stays exactly the same for both routes.
const BRIEFS = args.includes('--briefs');
const FROM_DISK = args.includes('--from-disk');
const REMAP = args.includes('--remap');
/**
 * One subject, or several as a comma list in priority order: `--subject
 * phy,chem,bio`. With --max-spend the order is what gets done first.
 */
const ONLY_SUBJECTS = (() => {
  const v = flag('subject');
  return typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : null;
})();
/**
 * A ceiling in US dollars for this run, at Sonnet's list price. No new
 * chapter starts once it is reached; the ones in flight finish. The key that
 * pays for generation also pays for every student's AI tutor, so a run that
 * spends the balance to zero takes the live app's AI down with it.
 */
const MAX_SPEND = Number(flag('max-spend', 0)) || 0;
const PRICE = { input: 2 / 1e6, output: 10 / 1e6 };
/**
 * One chapter, by id. For filling a single hole without respending on the
 * whole subject: `--chapter isl-6`, optionally with `--medium ur`. Repeatable
 * as a comma separated list.
 */
const ONLY_CHAPTERS = (() => {
  const v = flag('chapter');
  return typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : null;
})();
const LIMIT = Number(flag('limit', 0)) || 0;
/** Parallel chapter-media generations. Serial (1) unless asked. */
const CONCURRENCY = Number(flag('concurrency', 1)) || 1;
/** Skip chapter-media that already have live sections: resume, don't redo. */
const MISSING_ONLY = args.includes('--missing');
const MEDIA = flag('medium') ? [flag('medium')] : ['en', 'ur'];

const MODEL = 'claude-sonnet-5';

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Outcomes the board itself got wrong, skipped by code rather than silently
 * cleaned, so the parse still matches the source document.
 */
const BAD_SLOS = new Set([
  // A Biology outcome about "civilizations studying living things", printed in
  // the Mathematics framework under the content area "Real Numbers".
  'M-09-A-01',
]);

async function loadEnv() {
  const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

/* ------------------------------------------------------------------ model */

/**
 * One model call returning JSON.
 *
 * Retries on the two failures that are worth retrying: a rate limit or an
 * overloaded upstream, and a reply that is not valid JSON. Everything else is a
 * real error and is thrown, because retrying a bad request just spends money.
 */
/** What this run has cost, in tokens, for the closing line. A run on someone's balance should say what it spent. */
const spent = { input: 0, output: 0 };

async function ask(env, { system, prompt, maxTokens = 8000, attempt = 1, netAttempt = 1 }) {
  // A dropped connection (wifi blip, DNS hiccup) surfaces as a thrown
  // "fetch failed", at the request or mid-stream. That is the network's
  // fault, not the prompt's, so it gets its own patient retry: up to eight
  // more tries with delays growing to a minute (about five minutes in all),
  // enough to ride out a real outage instead of burning the whole job.
  const retryNet = async (e) => {
    if (netAttempt > 8) throw e;
    await new Promise((r) => setTimeout(r, Math.min(60_000, 5000 * 2 ** (netAttempt - 1))));
    return ask(env, { system, prompt, maxTokens, attempt, netAttempt: netAttempt + 1 });
  };
  const isNetError = (e) => /fetch failed|terminated|network|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(String(e?.message ?? e));

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      // Streamed, and not for the progress bar. A chapter's worth of notes can
      // take longer than Node's five minute body timeout to produce, and a
      // non-streamed request simply dies as "fetch failed" with nothing to
      // diagnose. Streaming keeps bytes moving, so the clock never runs out.
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    if (isNetError(e)) return retryNet(e);
    throw e;
  }

  if (res.status === 429 || res.status >= 500) {
    if (attempt > 4) throw new Error(`API ${res.status} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    return ask(env, { system, prompt, maxTokens, attempt: attempt + 1 });
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  let text = '';
  let stopReason = null;
  let buffer = '';

  try {
    for await (const piece of res.body) {
      buffer += Buffer.from(piece).toString('utf8');
      // SSE frames are separated by a blank line. Keep the trailing partial
      // frame in the buffer: a multi-byte character can straddle two chunks.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (event.type === 'content_block_delta' && event.delta?.text) text += event.delta.text;
        if (event.type === 'message_delta' && event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        // Billed tokens, counted per call. Input arrives with message_start,
        // output with the closing message_delta. Retried calls count too,
        // because they are billed too.
        if (event.type === 'message_start') spent.input += event.message?.usage?.input_tokens ?? 0;
        if (event.type === 'message_delta') spent.output += event.usage?.output_tokens ?? 0;
        if (event.type === 'error') throw new Error(`stream error: ${event.error?.message ?? 'unknown'}`);
      }
    }
  } catch (e) {
    // A stream cut off halfway is the same network failure wearing a
    // different face; the partial text is useless, so start the call over.
    if (isNetError(e)) return retryNet(e);
    throw e;
  }

  // Truncation is the failure that reads as a parse error: the reply is
  // perfectly good JSON that simply stops mid-string. Retrying the same
  // oversized prompt burns the budget again, so name what happened.
  if (stopReason === 'max_tokens') throw new Error(`reply hit the ${maxTokens} token ceiling, ask for less in one go`);

  // Models fence JSON even when told not to; strip it rather than fail.
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    if (attempt > 2) throw new Error(`not JSON after ${attempt} attempts: ${cleaned.slice(0, 200)}`);
    return ask(env, {
      system,
      prompt: `${prompt}\n\nReturn ONLY valid JSON. No prose, no code fence.`,
      maxTokens,
      attempt: attempt + 1,
    });
  }
}

/* ------------------------------------------------------- phase 1: mapping */

/**
 * Map outcomes to chapters by their own codes, where the board has told us how.
 *
 * data/fbise/chapters.json records each chapter as a domain or a stated range
 * within one, straight from the Table of Specifications. That makes the mapping
 * arithmetic rather than judgement: same answer every run, no model call, and
 * no chapter left with nothing in it. Returns null for a subject not described
 * there yet, and the caller falls back to asking the model.
 */
function mapByCode(spec, slos) {
  const rules = [];
  for (const ch of spec.chapters) {
    for (const rule of ch.slos) {
      const [domain, range] = rule.split(':');
      // "A" claims the whole domain, "A:5-9" a run, "A:31" a single outcome
      // (so a missing hi means hi = lo, not an open end).
      const [lo, hi] = range ? range.split('-').map(Number) : [null, null];
      rules.push({ chapter: ch.number, domain, lo, hi: hi ?? lo });
    }
  }

  const mapping = {};
  const missed = [];
  for (const s of slos) {
    // Codes look like P-09-B-30, or PS-09-A1-03 where the domain carries a
    // sub-digit. Split from the right so a two-letter subject prefix is safe.
    // Pakistan Studies and English carry a sub-domain digit in the code
    // (PS-09-A1-03), and their ToS names chapters by that sub-domain, so match
    // the full "A1" first and fall back to the bare domain letter. Matching
    // only the letter files every Pakistan Studies outcome under one chapter.
    const parts = s.code.split('-');
    const full = parts[2] ?? '';
    const bare = full.replace(/\d+$/, '');
    const number = Number(parts[3]);
    const hit =
      rules.find((r) => r.domain === full && (r.lo === null || (number >= r.lo && number <= r.hi))) ??
      rules.find((r) => r.domain === bare && (r.lo === null || (number >= r.lo && number <= r.hi)));
    if (hit) mapping[s.code] = hit.chapter;
    else missed.push(s.code);
  }
  return { mapping, missed };
}



const MAP_SYSTEM = `You map FBISE ${GRADE_LABEL} learning outcomes onto textbook chapters.

You are given a subject's chapter list and its learning outcomes. Assign every
outcome to exactly one chapter: the chapter a Pakistani ${GRADE_LABEL} student would
turn to if they wanted to learn that outcome.

Rules:
- Every outcome gets exactly one chapter number. Never skip one.
- If an outcome spans chapters, pick where it is TAUGHT, not where it is used.
- Outcomes about scientific method, measurement or the nature of the subject
  belong to the introductory chapter, not scattered across the book.

Return only JSON: {"map":[{"code":"P-09-A-01","chapter":1}, ...]}`;

async function mapSlosToChapters(env, subject, chapters, slos) {
  const chapterList = chapters.map((c) => `${c.number}. ${c.title}`).join('\n');
  const sloList = slos.map((s) => `${s.code}: ${s.text.slice(0, 180)}`).join('\n');

  const out = await ask(env, {
    system: MAP_SYSTEM,
    prompt: `Subject: ${subject.name}, FBISE ${GRADE_LABEL}.\n\nCHAPTERS:\n${chapterList}\n\nOUTCOMES:\n${sloList}`,
    maxTokens: 16000,
  });

  const byCode = new Map((out.map ?? []).map((m) => [m.code, m.chapter]));
  const valid = new Set(chapters.map((c) => c.number));
  const mapping = {};
  let unmapped = 0;
  for (const s of slos) {
    const n = byCode.get(s.code);
    if (valid.has(n)) mapping[s.code] = n;
    else unmapped++;
  }
  return { mapping, unmapped };
}

/* ---------------------------------------------------- phase 2: generation */

const FBISE_SYSTEM = `You write exam-preparation material for FBISE ${GRADE_LABEL} students in Pakistan.

You are given one chapter and the exact learning outcomes the Federal Board
examines on it. Everything you write must serve those outcomes.

WHO YOU ARE WRITING FOR
A 14 or 15 year old sitting the SSC Part 1 annual exam. Many study in a second
language, many have no one at home who can explain a hard idea, and most are
revising in short sessions on a phone. Be clear before you are clever. Use
Pakistani examples where an example helps: a bus on GT Road, a cricket ball, a
load-shedding hour, a tandoor. Never talk down.

NOTES
Explain the idea, then show it working. Define every term the first time. Where
a formula appears, say what each symbol is and give one worked example with real
numbers and units. Do not pad. A student's time is the scarce resource.

MCQs
Every wrong option must be a mistake a real student makes: the formula
rearranged wrongly, the unit unconverted, the common misreading. Never use
filler options. The explanation must say why the right answer is right AND why
the most tempting wrong one is wrong, because that is where the learning is.
Exactly four options. Exactly one correct.

QUESTION MIX
Follow the cognitive level given for each outcome:
- knowledge: recall, definitions, naming
- understanding: explain, distinguish, interpret
- application: calculate, apply to a new situation, analyse

SHORT QUESTIONS
Write them the way the board writes them, and give the marking points a marker
would actually look for.

Return only JSON matching the schema you are given. No prose, no code fence.`;

/**
 * The same standard, said about the Punjab boards.
 *
 * Built by swapping the five sentences that name FBISE rather than by keeping
 * a second copy, so an edit to the standard reaches both boards. Each swap
 * must land: if one of those sentences is ever reworded, this throws instead
 * of quietly sending Punjab students a prompt that still says Federal Board.
 */
const punjabSystem = (text) => {
  const swaps = [
    [`material for FBISE ${GRADE_LABEL} students`, `material for Punjab board ${GRADE_LABEL} students`],
    [
      'the exact learning outcomes the Federal Board\nexamines on it.',
      'the learning outcomes the Punjab textbook (PCTB,\n2023 edition) prints for it, word for word.',
    ],
    [
      'A 14 or 15 year old sitting the SSC Part 1 annual exam.',
      GRADE === 10
        ? 'A 15 or 16 year old sitting the SSC Part 2 (Class 10) annual exam of a Punjab\nboard: Lahore, Rawalpindi, Multan, Faisalabad or any of the others, which all\nset papers from the same textbook.'
        : 'A 14 or 15 year old sitting the SSC Part 1 (Class 9) annual exam of a Punjab\nboard: Lahore, Rawalpindi, Multan, Faisalabad or any of the others, which all\nset papers from the same textbook.',
    ],
    ['Write them the way the board writes them', 'Write them the way the Punjab boards write them'],
    [
      'Return only JSON matching the schema you are given.',
      'Never use an em dash; use a comma, a colon, or a new sentence.\n\nReturn only JSON matching the schema you are given.',
    ],
  ];
  for (const [from, to] of swaps) {
    if (!text.includes(from)) throw new Error(`Punjab prompt: "${from.slice(0, 40)}" is no longer in the FBISE standard`);
    text = text.replace(from, to);
  }
  return text;
};

const GEN_SYSTEM = PUNJAB ? punjabSystem(FBISE_SYSTEM) : FBISE_SYSTEM;

/** The one instruction that changes between the two mediums. */
const mediumRule = (medium) =>
  medium === 'ur'
    ? `

WRITE IN URDU. Proper Urdu script, the register of a Pakistani textbook. Not
Roman Urdu, not transliteration. Keep scientific terms and symbols in their
standard form (F = ma stays F = ma), and give the English term in brackets the
first time a technical word appears, because that is what the exam paper does.`
    : '';

/**
 * Two calls per chapter, not one.
 *
 * Asked for notes and every question type at once, the model runs out of room
 * and the reply stops mid-sentence: valid JSON that simply ends. Splitting also
 * produces better work, because writing an explanation and writing a question
 * that catches a misconception are different jobs, and the second one goes
 * better when the notes already exist to write against.
 */
async function generateChapter(env, { subject, chapter, slos, medium }) {
  const sloText = slos.map((s) => `${s.code} [${s.cognitive ?? 'unspecified'}]: ${s.text}`).join('\n');
  /*
   * Some chapters carry no mapped outcomes at all. Seven of them do: the
   * board's 2022-23 framework reorganised Maths, and Urdu's Listening and
   * Speaking are oral skills a written paper never assesses. They were left
   * empty, which is defensible for a syllabus and useless for a student, who
   * still sees the chapter in the app and taps it.
   *
   * So they are written from the chapter title instead of from outcomes. The
   * model is told plainly which footing it is on, and told not to claim board
   * weighting it does not have. Their exam_share stays null either way, so the
   * app keeps labelling them "not on the annual paper", which is true.
   */
  const grounded = slos.length > 0;
  const head = `Subject: ${subject.name}, ${BOARD_LABEL} ${GRADE_LABEL}.
Chapter ${chapter.number}: ${chapter.title}
${chapter.blurb ? `Scope: ${chapter.blurb}` : ''}

${
  grounded
    ? `THE OUTCOMES THIS CHAPTER IS EXAMINED ON:\n${sloText}`
    : `THIS CHAPTER HAS NO MAPPED BOARD OUTCOMES. The board's framework does not list
assessable outcomes under this title, so work from what the ${BOARD_LABEL} ${GRADE_LABEL} syllabus
covers for a chapter of this name and from standard textbook treatment of it. Stay
inside this chapter's scope, do not stray into neighbouring chapters, and do not claim
any exam weighting or marks distribution for it.`
}`;

  // Scale the ask to the chapter. Three outcomes do not need twenty questions,
  // and padding to a quota is how filler gets written. Unmapped chapters get
  // the floor: enough to practise with, not a pretence of coverage.
  const mcqCount = grounded ? Math.min(20, Math.max(8, slos.length * 2)) : 10;
  const cardCount = grounded ? Math.min(16, Math.max(6, slos.length)) : 8;

  const notes = await ask(env, {
    system: GEN_SYSTEM,
    prompt: `${head}

Write 3 to 5 sections of notes that cover these outcomes between them. Every
section sets slo_codes to the codes it covers.

SCHEMA:
{ "sections": [ { "title": "...", "blocks": [
    {"kind":"h","text":"..."}, {"kind":"p","text":"..."},
    {"kind":"def","term":"...","text":"..."},
    {"kind":"formula","text":"...","caption":"..."},
    {"kind":"list","items":["..."]}, {"kind":"example","text":"..."}
], "slo_codes": ["..."] } ] }${mediumRule(medium)}`,
    maxTokens: 32000,
  });

  const questions = await ask(env, {
    system: GEN_SYSTEM,
    prompt: `${head}

The notes for this chapter cover: ${(notes.sections ?? []).map((x) => x.title).join(' · ')}

Write ${mcqCount} MCQs, ${cardCount} flashcards, 6 short questions with marking
points, and 6 fill in the blanks. Spread them across the outcomes and follow
each outcome's cognitive level. Every item sets slo_code.

SCHEMA:
{
  "mcqs": [ { "topic":"...", "q":"...", "options":["a","b","c","d"], "answer":0,
              "explanation":"...", "difficulty":"easy|medium|hard", "slo_code":"..." } ],
  "flashcards": [ { "front":"...", "back":"...", "slo_code":"..." } ],
  "shortQs": [ { "marks":3, "q":"...", "answer":"...", "points":["..."], "slo_code":"..." } ],
  "blanks": [ { "before":"...", "after":"...", "answer":"...", "options":["a","b","c","d"], "slo_code":"..." } ]
}${mediumRule(medium)}`,
    // Urdu runs longer per fact than English, and a 12-outcome chapter asks
    // for the full 20 MCQs; 32k proved too tight for that combination.
    maxTokens: 48000,
  });

  return { ...notes, ...questions };
}

/* ------------------------------------------------------------- validation */

/**
 * The only thing between a model slip and a student learning the wrong answer,
 * because content publishes without human review by the client's instruction.
 *
 * Bad items are dropped individually, not by the chapterful. Failing a whole
 * chapter over one malformed MCQ would leave the old placeholder content in
 * place, which is strictly worse for the student than nineteen good questions.
 * The chapter is only rejected outright when what survives is not worth
 * shipping: no notes, or most of the questions defective, which means the model
 * misunderstood the task rather than slipped once.
 */
function sift(out, slos) {
  const codes = new Set(slos.map((s) => s.code));
  /*
   * A chapter the board never mapped has no codes to match against, and the
   * model still labels its questions because the schema asks for a code. Every
   * item then failed the check below and the whole chapter was dropped: "0 of
   * 10 questions usable", which is what happened on the first run for all ten
   * math and urd chapter-media.
   *
   * So the codes are stripped instead. They have to be: slo_code is a foreign
   * key into curriculum_slos, and inventing one would fail the insert anyway.
   */
  const unmapped = codes.size === 0;
  if (unmapped) {
    for (const list of [out.mcqs, out.flashcards, out.shortQs, out.blanks, out.sections]) {
      for (const item of list ?? []) {
        delete item.slo_code;
        delete item.slo_codes;
      }
    }
  }
  const dropped = [];
  const keepIf = (ok, label) => {
    if (!ok) dropped.push(label);
    return ok;
  };

  const sections = (out.sections ?? []).filter(
    (s, i) => keepIf(s.title?.trim() && Array.isArray(s.blocks) && s.blocks.length, `section ${i}`),
  );

  const mcqs = (out.mcqs ?? []).filter((m, i) => {
    const opts = Array.isArray(m.options) ? m.options.map((o) => String(o).trim()) : [];
    return keepIf(
      Boolean(m.q?.trim()) &&
        opts.length === 4 &&
        opts.every(Boolean) &&
        // Duplicate options make two answers equally right, and an index past
        // the end makes a question nobody can ever get right. Both are fatal.
        new Set(opts.map((o) => o.toLowerCase())).size === 4 &&
        Number.isInteger(m.answer) &&
        m.answer >= 0 &&
        m.answer <= 3 &&
        Boolean(m.explanation?.trim()) &&
        (!m.slo_code || codes.has(m.slo_code)),
      `mcq ${i}`,
    );
  });

  const flashcards = (out.flashcards ?? []).filter((f, i) => keepIf(Boolean(f.front?.trim() && f.back?.trim()), `card ${i}`));

  const shortQs = (out.shortQs ?? []).filter((q, i) => keepIf(Boolean(q.q?.trim() && q.answer?.trim()), `shortQ ${i}`));

  const blanks = (out.blanks ?? []).filter((b, i) => {
    const opts = Array.isArray(b.options) ? b.options.map((o) => String(o).trim()) : [];
    return keepIf(
      Boolean(b.answer?.trim()) && (!opts.length || opts.includes(String(b.answer).trim())),
      `blank ${i}`,
    );
  });

  const asked = (out.mcqs ?? []).length;

  // A chapter with no MCQs is not automatically broken.
  //
  // The board forbids MCQs on Islamiyat strand 6 outright, so isl-6 ships with
  // an empty mcqs array on purpose and its short and extended answers carry the
  // chapter. Rejecting it for having none would drop a chapter for obeying a
  // rule. What actually makes a chapter unusable is having nothing to read, or
  // nothing to practise at all, or most of the questions it did write being
  // defective, which means the model misunderstood rather than slipped.
  const practice = mcqs.length + shortQs.length;
  const fatal =
    (!sections.length && 'no usable sections') ||
    (!practice && 'nothing to practise: no questions of any kind') ||
    (asked && mcqs.length / asked < 0.6 && `only ${mcqs.length} of ${asked} questions usable`) ||
    null;

  return { clean: { sections, mcqs, flashcards, shortQs, blanks }, dropped, fatal };
}

/**
 * No em dash reaches a student. The repo's rule for every line of copy, and
 * the one the model breaks most: 248 of FBISE's first 4,283 MCQs carry one.
 * Asking in the prompt lowers the count; this makes it zero. Replaced with the
 * comma the sentence almost always wanted, the Urdu comma in Urdu, and
 * dropped outright at the start or end of a string.
 */
function dashless(value, comma) {
  if (typeof value === 'string') {
    return value
      .replace(/^\s*\u2014\s*/, '')
      .replace(/\s*\u2014\s*$/, '')
      .replace(/\s*\u2014\s*/g, comma);
  }
  if (Array.isArray(value)) return value.map((v) => dashless(v, comma));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dashless(v, comma)]));
  }
  return value;
}
const commaFor = (medium) => (medium === 'ur' ? '، ' : ', ');

/* -------------------------------------------------------------- to tables */

const rows = (out, { chapter, subject, medium, status }) => {
  const base = { chapter_id: chapter.id, medium, review_status: status, source: 'ai' };
  const n = (i) => `${chapter.id}-${medium}-${i + 1}`;

  return {
    chapter_sections: (out.sections ?? []).map((s, i) => ({
      ...base,
      id: `${chapter.id}-${medium}-s${i + 1}`,
      position: i,
      title: s.title,
      blocks: s.blocks,
      slo_codes: s.slo_codes ?? [],
    })),
    mcqs: (out.mcqs ?? []).map((m, i) => ({
      ...base,
      id: `${n(i)}-q`,
      subject_id: subject.subject,
      topic: m.topic ?? chapter.title,
      q: m.q,
      options: m.options,
      answer: m.answer,
      explanation: m.explanation,
      difficulty: ['easy', 'medium', 'hard'].includes(m.difficulty) ? m.difficulty : 'medium',
      slo_code: m.slo_code ?? null,
    })),
    flashcards: (out.flashcards ?? []).map((f, i) => ({
      ...base,
      id: `${n(i)}-f`,
      front: f.front,
      back: f.back,
      slo_code: f.slo_code ?? null,
    })),
    short_questions: (out.shortQs ?? []).map((s, i) => ({
      ...base,
      id: `${n(i)}-sq`,
      marks: s.marks ?? 3,
      q: s.q,
      answer: s.answer,
      points: s.points ?? [],
      slo_code: s.slo_code ?? null,
    })),
    blanks: (out.blanks ?? []).map((b, i) => ({
      ...base,
      id: `${n(i)}-b`,
      before_text: b.before ?? '',
      after_text: b.after ?? '',
      answer: b.answer,
      options: b.options ?? [],
      slo_code: b.slo_code ?? null,
    })),
  };
};

/**
 * Replace one chapter-medium's rows: clear every table, then insert.
 *
 * Retried whole when the network drops, not statement by statement. A write
 * can reach the server and still lose its reply, so the retry starts again
 * from the clear and meets the same empty slate instead of rows the first
 * attempt left behind. A refusal from the database itself (a bad row, a
 * constraint) is a real error and is not retried. A dropped connection on 11
 * September lost seven Urdu chapters' writes in two minutes; their content
 * was safe on disk, but a run should not need rescuing from one.
 */
async function replaceRows(db, chapter, medium, tables) {
  // A dropped connection, or the database's gateway giving up under load:
  // both pass, and both are worth waiting out.
  const flaky = (message) => /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|terminated|gateway|timeout|50[234]/i.test(message);
  for (let attempt = 1; ; attempt++) {
    try {
      for (const table of Object.keys(tables)) {
        const { error } = await db.from(table).delete().eq('chapter_id', chapter.id).eq('medium', medium);
        if (error) throw new Error(`${table} clear: ${error.message}`);
      }
      for (const [table, batch] of Object.entries(tables)) {
        if (!batch.length) continue;
        const { error } = await db.from(table).insert(batch);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      return;
    } catch (e) {
      if (attempt >= 6 || !flaky(String(e.message))) throw e;
      await new Promise((r) => setTimeout(r, Math.min(60_000, 3000 * 2 ** (attempt - 1))));
    }
  }
}

/* ----------------------------------------------- the disk seam (agent route) */

/**
 * Write one brief per chapter: the outcomes it is examined on, plus the same
 * standard the API route is held to.
 *
 * This is what makes the agent route and the API route produce the same thing.
 * The brief carries the system prompt verbatim, so neither path can quietly
 * drift into a lower bar, and every file lands in the identical schema that
 * sift() already checks.
 */
async function writeBriefs(subject, chapters, slos, mapping) {
  await mkdir(resolve(GENDIR, 'briefs'), { recursive: true });
  let n = 0;
  for (const chapter of chapters) {
    const mine = slos.filter((s) => mapping[s.code] === chapter.number);
    if (!mine.length) continue;
    const brief = {
      chapter: { id: chapter.id, number: chapter.number, title: chapter.title, blurb: chapter.blurb },
      subject: { id: subject.subject, name: subject.name },
      counts: {
        mcqs: Math.min(20, Math.max(8, mine.length * 2)),
        flashcards: Math.min(16, Math.max(6, mine.length)),
        shortQs: 6,
        blanks: 6,
        sections: '3 to 5',
      },
      standard: GEN_SYSTEM,
      urduRule: mediumRule('ur').trim(),
      outcomes: mine.map((s) => ({ code: s.code, cognitive: s.cognitive, text: s.text })),
      writeTo: [
        relative(ROOT, resolve(GENDIR, `${chapter.id}-en.json`)),
        relative(ROOT, resolve(GENDIR, `${chapter.id}-ur.json`)),
      ],
      schema: {
        sections: [{ title: 'string', blocks: '[{kind:h|p|def|formula|list|example, ...}]', slo_codes: ['string'] }],
        mcqs: [{ topic: 's', q: 's', options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 's', difficulty: 'easy|medium|hard', slo_code: 's' }],
        flashcards: [{ front: 's', back: 's', slo_code: 's' }],
        shortQs: [{ marks: 3, q: 's', answer: 's', points: ['s'], slo_code: 's' }],
        blanks: [{ before: 's', after: 's', answer: 's', options: ['a', 'b', 'c', 'd'], slo_code: 's' }],
      },
    };
    await writeFile(resolve(GENDIR, 'briefs', `${chapter.id}.json`), `${JSON.stringify(brief, null, 2)}\n`);
    n++;
  }
  return n;
}

/**
 * Take whatever the agents wrote and put it through the identical gate.
 *
 * Nothing here trusts the file. It is sifted by the same rules the API route
 * uses, written with the same replace semantics, and reports the same counts,
 * so a chapter generated by an agent is indistinguishable downstream from one
 * generated by the script. That is the whole point of the seam.
 */
async function insertFromDisk(db, doc, chapters, slos, mapping, STATUS) {
  let written = 0;
  let dropped = 0;

  for (const chapter of chapters) {
    const mine = slos.filter((s) => mapping[s.code] === chapter.number);
    if (!mine.length) continue;

    for (const medium of MEDIA) {
      const file = resolve(GENDIR, `${chapter.id}-${medium}.json`);
      const label = `${chapter.id}/${medium}`;
      let raw;
      try {
        raw = dashless(JSON.parse(await readFile(file, 'utf8')), commaFor(medium));
      } catch {
        continue; // not written yet, which is normal mid-run
      }

      const { clean, dropped: bad, fatal } = sift(raw, mine);
      if (fatal) {
        dropped++;
        console.log(`${C.red(' drop')} ${label.padEnd(14)} ${C.dim(fatal)}`);
        continue;
      }

      const tables = rows(clean, { chapter, subject: doc, medium, status: STATUS });
      try {
        if (!DRY) {
          await replaceRows(db, chapter, medium, tables);
        }
        written++;
        const counts = Object.entries(tables).map(([t, r]) => `${r.length} ${t.replace('chapter_', '')}`);
        console.log(`${C.green('   ok')} ${label.padEnd(14)} ${C.dim(`${counts.join(', ')}${bad.length ? ` · ${bad.length} rejected` : ''}`)}`);
      } catch (e) {
        dropped++;
        console.log(`${C.red(' fail')} ${label.padEnd(14)} ${C.dim(String(e.message).slice(0, 120))}`);
      }
    }
  }
  return { written, dropped };
}

/* ------------------------------------------------------------------- main */

async function main() {
  const env = await loadEnv();
  if (!env.ANTHROPIC_API_KEY) {
    console.error(C.red('apps/web/.env.local needs ANTHROPIC_API_KEY'));
    process.exit(1);
  }

  // Published on the client's explicit instruction: no human review at MVP.
  // The flag stays so a chapter can be pulled in one UPDATE if it is wrong.
  const STATUS = 'published';

  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

  await mkdir(MAPDIR, { recursive: true });

  const SPEC = PUNJAB ? {} : JSON.parse(await readFile(SPEC_FILE ?? resolve(DATA, 'chapters.json'), 'utf8'));

  const subjects = [];
  if (PUNJAB) {
    // One document per subject in the FBISE shape, so everything below runs
    // unchanged. Each outcome already carries its chapter number.
    const catalogue = JSON.parse(await readFile(resolve(ROOT, 'data/punjab/catalogue.json'), 'utf8'));
    const { data: names } = await db.from('subjects').select('id,name');
    const nameOf = new Map((names ?? []).map((r) => [r.id, r.name]));
    const bySubject = new Map();
    for (const s of catalogue.slos.filter((x) => x.grade === GRADE)) {
      if (!bySubject.has(s.subject)) bySubject.set(s.subject, []);
      bySubject.get(s.subject).push({ code: s.code, text: s.text, cognitive: null, assessment: null, chapter: s.chapter });
    }
    for (const [subject, list] of bySubject) {
      if (ONLY_SUBJECTS && !ONLY_SUBJECTS.includes(subject)) continue;
      subjects.push({ subject, name: nameOf.get(subject) ?? subject, domains: [{ code: 'textbook', slos: list }] });
    }
    if (ONLY_SUBJECTS) subjects.sort((a, b) => ONLY_SUBJECTS.indexOf(a.subject) - ONLY_SUBJECTS.indexOf(b.subject));
  } else {
    const files = (await readdir(DATA)).filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.includes('-'));
    for (const f of files) {
      const doc = JSON.parse(await readFile(resolve(DATA, f), 'utf8'));
      if (ONLY_SUBJECTS && !ONLY_SUBJECTS.includes(doc.subject)) continue;
      subjects.push(doc);
    }
  }

  let written = 0;
  let dropped = 0;
  /** Every (chapter, medium) to generate, pooled after mapping resolves. */
  const jobs = [];

  for (const doc of subjects) {
    const { data: chapters } = await db
      .from('chapters')
      .select('id,number,title,blurb')
      .eq('subject_id', doc.subject)
      .eq('grade', GRADE)
      // Physics chapter 3 exists once per board per class. Without this, a
      // Punjab chapter would be generated against FBISE outcomes, and the
      // other way round.
      .eq('board', BOARD)
      .order('number');
    if (!chapters?.length) {
      console.log(`${C.yellow('skip')} ${doc.subject}: no chapters`);
      continue;
    }

    // Examinable outcomes only. Null assessment means the source merged that
    // column, not that the outcome is unexamined, so it stays in.
    const slos = (doc.domains ?? [])
      .flatMap((d) => d.slos)
      .filter((s) => s.assessment !== 'formative' && !BAD_SLOS.has(s.code));

    if (!slos.length) {
      console.log(`${C.yellow('skip')} ${doc.subject}: no examinable outcomes`);
      continue;
    }

    // Phase 1: mapping, cached. Punjab needs none: the book printed each
    // outcome inside its chapter, and the catalogue kept that.
    const mapPath = resolve(MAPDIR, `${doc.subject}.json`);
    let mapping = PUNJAB ? Object.fromEntries(slos.map((s) => [s.code, s.chapter])) : undefined;
    if (!mapping && !REMAP) {
      try {
        mapping = JSON.parse(await readFile(mapPath, 'utf8')).mapping;
      } catch {
        /* not mapped yet */
      }
    }
    // Deterministic first. Only ask the model where the board's own structure
    // has not been written down yet.
    if (!mapping && SPEC.subjects?.[doc.subject]) {
      const r = mapByCode(SPEC.subjects[doc.subject], slos);
      mapping = r.mapping;
      await writeFile(mapPath, `${JSON.stringify({ subject: doc.subject, method: 'table-of-specifications', mapping }, null, 2)}\n`);
      console.log(
        `${C.dim(`  mapped ${doc.subject}: ${Object.keys(mapping).length} by code`)}${r.missed.length ? C.yellow(` · ${r.missed.length} unmatched: ${r.missed.slice(0, 4).join(', ')}`) : ''}`,
      );
    }

    if (!mapping) {
      process.stdout.write(C.dim(`  mapping ${doc.subject}… (model, no ToS recorded) `));
      const r = await mapSlosToChapters(env, doc, chapters, slos);
      mapping = r.mapping;
      await writeFile(mapPath, `${JSON.stringify({ subject: doc.subject, model: MODEL, mapping }, null, 2)}\n`);
      console.log(C.dim(`${Object.keys(mapping).length} mapped${r.unmapped ? `, ${r.unmapped} unmapped` : ''}`));
    }

    if (BRIEFS) {
      const n = await writeBriefs(doc, chapters, slos, mapping);
      console.log(`${C.green('   ok')} ${doc.subject.padEnd(6)} ${C.dim(`${n} briefs -> ${relative(ROOT, resolve(GENDIR, 'briefs'))}/`)}`);
      continue;
    }

    if (FROM_DISK) {
      const r = await insertFromDisk(db, doc, chapters, slos, mapping, STATUS);
      written += r.written;
      dropped += r.dropped;
      continue;
    }

    // Phase 2: queue this subject's generation jobs for the pool below.
    let targets = chapters;
    if (LIMIT) targets = targets.slice(0, LIMIT);

    for (const chapter of targets) {
      const mine = slos.filter((s) => mapping[s.code] === chapter.number);
      // Unmapped chapters are skipped in a bulk run, because a whole-syllabus
      // pass should follow the board. Naming one with --chapter is a decision
      // to write it anyway, and then it goes through on title alone.
      if (!mine.length && !ONLY_CHAPTERS) {
        console.log(`${C.dim('  --  ')} ${chapter.id.padEnd(10)} ${C.dim('no outcomes mapped here')}`);
        continue;
      }
      for (const medium of MEDIA) jobs.push({ doc, chapter, mine, medium });
    }
  }

  if (ONLY_CHAPTERS) {
    const before = jobs.length;
    for (let i = jobs.length - 1; i >= 0; i--) {
      if (!ONLY_CHAPTERS.includes(jobs[i].chapter.id)) jobs.splice(i, 1);
    }
    console.log(C.dim(`  --chapter: kept ${jobs.length} of ${before}`));
  }

  // Already-generated chapter-media are skipped when asked, so an
  // interrupted overnight run resumes instead of respending.
  if (MISSING_ONLY && jobs.length) {
    const have = new Set();
    for (const doc of subjects) {
      const { data } = await db
        .from('chapter_sections')
        .select('chapter_id,medium')
        .like('chapter_id', `${doc.subject}-%`);
      for (const r of data ?? []) have.add(`${r.chapter_id}|${r.medium}`);
    }
    const before = jobs.length;
    for (let i = jobs.length - 1; i >= 0; i--) {
      if (have.has(`${jobs[i].chapter.id}|${jobs[i].medium}`)) jobs.splice(i, 1);
    }
    if (before !== jobs.length) console.log(C.dim(`  ${before - jobs.length} already generated, skipped`));
  }

  console.log(C.bold(`\n  ${jobs.length} chapter-media to generate\n`));

  const runJob = async ({ doc, chapter, mine, medium }) => {
    const label = `${chapter.id}/${medium}`;
    try {
      const raw = dashless(await generateChapter(env, { subject: doc, chapter, slos: mine, medium }), commaFor(medium));
      const { clean, dropped: bad, fatal } = sift(raw, mine);

      if (fatal) {
        dropped++;
        console.log(`${C.red(' drop')} ${label.padEnd(14)} ${C.dim(fatal)}`);
        return;
      }

      const tables = rows(clean, { chapter, subject: doc, medium, status: STATUS });
      const counts = Object.entries(tables).map(([t, r]) => `${r.length} ${t.replace('chapter_', '')}`);

      if (!DRY) {
        // Keep a disk copy beside the database rows: the audit trail, and
        // what a regeneration or a later review reads.
        await mkdir(GENDIR, { recursive: true });
        await writeFile(resolve(GENDIR, `${chapter.id}-${medium}.json`), `${JSON.stringify(clean, null, 1)}\n`);
        // Replace, do not merge. The chapter already holds placeholder rows
        // from packages/core occupying the same (chapter_id, medium,
        // position) slots, so an upsert keyed on id collides with a
        // different row that owns the slot. Clearing first also makes a
        // regeneration a clean replacement rather than two overlapping
        // sets of questions for the same chapter.
        await replaceRows(db, chapter, medium, tables);
      }
      written++;
      console.log(
        `${C.green('   ok')} ${label.padEnd(14)} ${C.dim(
          `${mine.length} SLOs -> ${counts.join(', ')}${bad.length ? ` · ${bad.length} rejected` : ''}`,
        )}`,
      );
    } catch (e) {
      dropped++;
      console.log(`${C.red(' fail')} ${label.padEnd(14)} ${C.dim(String(e.message).slice(0, 120))}`);
    }
  };

  let cursor = 0;
  let capped = 0;
  const costSoFar = () => spent.input * PRICE.input + spent.output * PRICE.output;
  const worker = async () => {
    for (;;) {
      const job = jobs[cursor++];
      if (!job) return;
      if (MAX_SPEND && costSoFar() >= MAX_SPEND) {
        capped++;
        continue;
      }
      await runJob(job);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  console.log(C.bold(`\n  ${written} chapter-media written, ${dropped} dropped${DRY ? ' (dry run, nothing saved)' : ''}`));
  console.log(C.dim(`  ${spent.input.toLocaleString()} tokens in, ${spent.output.toLocaleString()} out, about $${costSoFar().toFixed(2)} at list price\n`));
  if (capped) console.log(C.yellow(`  ${capped} chapter-media not started: the $${MAX_SPEND} ceiling was reached. Re-run with --missing to continue.\n`));
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
