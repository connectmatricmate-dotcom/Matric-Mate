#!/usr/bin/env node
/**
 * Turn what was read out of the Punjab textbooks into the catalogue the rest
 * of the system uses: chapters, their topics, and the outcomes content is
 * written against.
 *
 *   node scripts/build-punjab-catalogue.mjs
 *
 * Reads data/punjab/contents/ (each book's contents page) and
 * data/punjab/outcomes/ (inside each chapter), writes
 * data/punjab/catalogue.json. No network, no model: same input, same output,
 * so the file can be reviewed as a diff when a book is re-read or a missing
 * one arrives.
 *
 * WHAT COUNTS AS AN OUTCOME
 *
 *   1. The outcomes the chapter prints, verbatim (origin textbook_slo). Every
 *      science, maths and computer science chapter in the 2023 editions has
 *      them.
 *   2. Where a chapter prints none, its numbered topics stand in, one outcome
 *      per topic (origin textbook_topic). The code says T, not S, so nothing
 *      downstream mistakes one for the other.
 *   3. Where there are no topics either, as with an Urdu lesson, the lesson
 *      itself is the one outcome.
 *
 * Codes are ours, PJ-PHY-10-C10-S03, because the books print none. They are
 * stable for as long as the book is: re-reading a chapter that has not
 * changed mints the same codes, which matters because every generated
 * question stores the code it was written for.
 *
 * WHEN TWO MEDIUMS EXIST
 *
 * The English-medium book is the primary: its titles and outcomes go in as
 * printed. An Urdu-medium book of the same subject contributes the Urdu
 * chapter titles. Where only the Urdu-medium book exists (Pakistan Studies 10,
 * until the English one arrives), it is the primary, and the English titles
 * are the renderings recorded at extraction.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { C, ROOT, scrubDashes } from './pdf-vision.mjs';

const CONTENTS = resolve(ROOT, 'data/punjab/contents');
/** Translated Urdu names (scripts/translate-punjab-titles.mjs), the last resort after any book's. */
const TRANSLATED = resolve(ROOT, 'data/punjab/urdu-titles.json');
const OUTCOMES = resolve(ROOT, 'data/punjab/outcomes');
/**
 * Blurbs written by hand, which win over the line built from the book's
 * topics: data/punjab/blurbs.json in English, data/urdu-blurbs.json in Urdu.
 * The built line is empty for a lesson with no topics and only an author's
 * name for most Urdu lessons, and a catalogue rebuild must never put those
 * back over a written one.
 */
const WRITTEN_BLURBS = resolve(ROOT, 'data/punjab/blurbs.json');
const URDU_BLURBS = resolve(ROOT, 'data/urdu-blurbs.json');
const OUT = resolve(ROOT, 'data/punjab/catalogue.json');

const readJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
};

const pad = (n) => String(n).padStart(2, '0');

/**
 * Some books print every title in capitals (Biology: "HUMAN URINARY SYSTEM").
 * Shown as-is that shouts from every chapter list, so an all-capitals title
 * is set in title case, keeping the acronyms that are meant to be capitals.
 * Anything already in mixed case is left exactly as printed.
 */
const ACRONYMS = new Map(
  ['DNA', 'RNA', 'ATP', 'ADP', 'NADP', 'CFCs', 'HIV', 'AIDS', 'pH', 'ICT', 'AI', 'IT', 'HTML', 'CSS', 'CPU', 'GPS', 'USB', 'UN', 'SI', 'PCTB'].map(
    (a) => [a.toUpperCase(), a],
  ),
);
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'its', 'of', 'on', 'or', 'the', 'to', 'with']);
function tidyCase(text) {
  if (!text || /[a-z]/.test(text) || !/[A-Z]{3}/.test(text)) return text;
  let first = true;
  return text.toLowerCase().replace(/[a-z][a-z']*/g, (word) => {
    const known = ACRONYMS.get(word.toUpperCase());
    const out = known ?? (!first && SMALL.has(word) ? word : word[0].toUpperCase() + word.slice(1));
    first = false;
    return out;
  });
}

/**
 * Headings that are really topics: numbered under their own chapter
 * (10.1, 10.2.1). Numbered list items inside the prose ("1.", "a-", "(ii)")
 * come back from the reader as headings too, and are not.
 */
function topicsFrom(chapter, read) {
  const own = new RegExp(`^${chapter.number}(\\.\\d+)+$`);
  const headings = read?.headings ?? [];
  const numbered = headings.filter((h) => h.number && own.test(h.number));
  if (numbered.length) {
    // Unnumbered headings after a numbered one are its sub-topics.
    const topics = [];
    for (const h of headings) {
      if (h.number && own.test(h.number)) topics.push({ number: h.number, title: tidyCase(h.title.trim()), subtopics: [] });
      else if (!h.number && topics.length) topics.at(-1).subtopics.push(tidyCase(h.title.trim()));
    }
    return topics;
  }
  return headings.filter((h) => !h.number).map((h) => ({ number: null, title: tidyCase(h.title.trim()), subtopics: [] }));
}

/** The contents page's own topic list, used where the chapter was not read whole. */
const contentsTopics = (entry) =>
  (entry?.topics ?? []).map((t) => ({ number: t.number ?? null, title: t.title.trim(), titleEn: t.titleEn?.trim() || null, subtopics: [] }));

const URDU = /[\u0600-\u06FF]/;

/**
 * The English half of a bilingual title, "نظریہ کی اہمیت (Importance of
 * Ideology)", or the title itself when it has none.
 */
function englishOf(title) {
  if (!URDU.test(title)) return title;
  const gloss = title.match(/\(([^()]*[A-Za-z][^()]*)\)\s*$/);
  return gloss ? gloss[1].trim() : title;
}

/**
 * One line a student can read under the chapter name. Built from the book's
 * own topics rather than written, so it cannot claim anything the chapter
 * does not contain. English throughout, like every other blurb, so a topic
 * with no English rendering is left out rather than mixing scripts. And
 * short: as many main topics as fit in about a line and a half, then
 * "and more".
 */
function blurbFor(subject, topics) {
  const names = topics
    .filter((t) => !t.number || /^\d+\.\d+$/.test(t.number))
    .map((t) => (t.titleEn ?? englishOf(t.title)).replace(/[.:]+$/, ''))
    .filter((n) => n && !URDU.test(n));
  if (!names.length) return '';
  if (subject === 'eng') return names[0];
  const kept = [];
  for (const n of names) {
    if (kept.length && [...kept, n].join(', ').length > 150) break;
    kept.push(n);
  }
  if (kept.length < names.length) return `${kept.join(', ')} and more.`;
  return kept.length === 1 ? `${kept[0]}.` : `${kept.slice(0, -1).join(', ')} and ${kept.at(-1)}.`;
}

/**
 * Whether an Urdu-medium book's chapter is the same chapter as the English
 * book's chapter of that number.
 *
 * Usually it is: most pairs are one edition set twice, page for page. Not
 * always: the Urdu-medium Pakistan Studies 10 in hand turned out to be the
 * older PCTB edition, with chapters 4 to 7 in a different order from the
 * PECTAA English one, so matching by number put "World Affairs" in Urdu over
 * "Geography" in English. Two independent signals, either enough: the Urdu
 * book's own English rendering shares words with the English title, or the
 * chapter starts on the same printed page, give or take two.
 */
const STOP = new Set(['a', 'an', 'and', 'of', 'the', 'in', 'to', 'for', 'with', 'its', 'is', 'are', 'on', 'as', 'by', 'from', 'or', 'pakistan']);
const words = (t) => new Set((t ?? '').toLowerCase().match(/[a-z]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? []);
/** Share of words two titles have in common, 0 to 1, comparing the Urdu book's own English rendering. */
function overlap(englishTitle, urdu) {
  const rendering = urdu.titleEn ?? urdu.title.match(/\(([^()]*[A-Za-z][^()]*)\)\s*$/)?.[1] ?? '';
  const a = words(englishTitle);
  const b = words(rendering);
  if (!a.size || !b.size) return 0;
  return [...a].filter((w) => b.has(w)).length / new Set([...a, ...b]).size;
}

function sameChapter(englishTitle, englishPage, urdu, sameEdition) {
  if (overlap(englishTitle, urdu) >= 0.25) return true;
  // Pages prove nothing between two editions: chapter 1 starts on page 1 in
  // both, and "Geography" on 64 beside "World Affairs" on 65 was a fluke that
  // made it through before this rule.
  return sameEdition && Number.isInteger(englishPage) && Number.isInteger(urdu.page) && Math.abs(englishPage - urdu.page) <= 2;
}

/**
 * One edition set twice, which is what makes a page comparison evidence:
 * the same number of chapters, nearly all starting within two pages of each
 * other.
 */
function isSameEdition(englishChapters, urduChapters) {
  if (!englishChapters?.length || englishChapters.length !== urduChapters.length) return false;
  const close = englishChapters.filter((e) => {
    const u = urduChapters.find((c) => c.number === e.number);
    return u && Number.isInteger(e.page) && Number.isInteger(u.page) && Math.abs(e.page - u.page) <= 2;
  }).length;
  return close / englishChapters.length >= 0.8;
}

/**
 * Of two readings of one Urdu title, the fuller. The contents page is small
 * print read at lower resolution and drops a letter now and then ("پیائش"
 * for "پیمائش"); the chapter opening is large print read sharply but
 * sometimes loses a space. Counting letters, spaces aside, picks the reading
 * that missed nothing.
 */
function fullerUrdu(a, b) {
  if (!a || !b) return a || b;
  const letters = (t) => t.replace(/\s|\([^()]*[A-Za-z][^()]*\)/g, '');
  const [x, y] = [letters(a), letters(b)];
  // Only a correction, never a different title: the opening page can also
  // carry "باب اوّل" or an author, and those are not part of the name.
  return y.length > x.length && editDistance(x, y) <= 2 ? b : a;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

/**
 * Which Urdu-medium chapter, if any, is each English chapter.
 *
 * Same number first, where sameChapter agrees. Then the rest by title across
 * numbers: the older Urdu-medium editions the client approved (Physics 10,
 * Biology 9, Chemistry 9, Computer Science 9, Pakistan Studies 10) are a
 * different syllabus numbered differently, but where a chapter survived
 * ("Sound", "Electrostatics") its Urdu name is still the right one. That pass
 * is held to a stricter bar, since there is no page to agree on, and it is
 * one to one, best match first: a one-word title like "The Cell" shares its
 * only word with "Cell Cycle", and would otherwise take the name that belongs
 * to the chapter actually called Cell Cycle.
 */
function matchUrduChapters(english, urduChapters, sameEdition) {
  const out = new Map();
  const taken = new Set();
  for (const e of english) {
    const u = urduChapters.find((c) => c.number === e.number);
    if (u && sameChapter(e.name, e.page, u, sameEdition)) {
      out.set(e.number, u);
      taken.add(u.number);
    }
  }
  const pairs = [];
  for (const e of english) {
    if (out.has(e.number)) continue;
    for (const u of urduChapters) {
      const score = taken.has(u.number) ? 0 : overlap(e.name, u);
      if (score >= 0.5) pairs.push({ e, u, score });
    }
  }
  for (const { e, u } of pairs.sort((a, b) => b.score - a.score)) {
    if (out.has(e.number) || taken.has(u.number)) continue;
    out.set(e.number, u);
    taken.add(u.number);
  }
  return out;
}

/**
 * Misreads confirmed by eye against the page image, where reading again did
 * not fix them. Keyed by Urdu-medium book and its own chapter number. Kept
 * short on purpose: an entry here is a claim someone looked at the page.
 */
const URDU_TITLE_FIXES = {
  // Small-print contents row, read three times as three different wrong
  // strings (a doubled word, then a cut-off one). The page prints this.
  'pst-10-ur:2': 'تحریک پاکستان اور پاکستان کا قیام',
};

/** An Urdu title without the English gloss some books print after it in brackets. */
const bareUrdu = (t) => t?.replace(/\s*\([^()]*[A-Za-z][^()]*\)\s*$/, '').replace(/\s{2,}/g, ' ').trim() || null;

/**
 * An Urdu lesson's title as printed carries its author in a closing bracket,
 * "اپنی مدد آپ (سر سیّد احمد خاں)", and the English rendering after a middot.
 * The author is not part of the lesson's name: it goes in the blurb, which is
 * where the chapter list shows a line about the chapter.
 */
function splitAuthor(urduTitle, englishTitle) {
  const u = urduTitle?.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  const [en, author] = (englishTitle ?? '').split(' · ');
  if (!u || !author) return null;
  return { urdu: u[1].trim(), english: en.trim(), author: author.trim() };
}

async function main() {
  const names = (await readdir(OUTCOMES)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  const books = [];
  for (const name of names.sort()) {
    const outcomes = await readJson(join(OUTCOMES, `${name}.json`));
    const contents = await readJson(join(CONTENTS, `${name}.json`));
    books.push({ name, outcomes, contents });
  }

  // Group by subject and class; English medium leads where both exist.
  const groups = new Map();
  for (const b of books) {
    const key = `${b.outcomes.subject}-${b.outcomes.grade}`;
    const g = groups.get(key) ?? [];
    g.push(b);
    g.sort((x, y) => (x.outcomes.medium === 'en' ? -1 : 1) - (y.outcomes.medium === 'en' ? -1 : 1));
    groups.set(key, g);
  }

  const chapters = [];
  const slos = [];
  const problems = [];
  const bookList = [];
  const translated = (await readJson(TRANSLATED))?.titles ?? {};
  const writtenBlurbs = (await readJson(WRITTEN_BLURBS))?.blurbs ?? {};
  const urduBlurbs = (await readJson(URDU_BLURBS))?.blurbs ?? {};

  for (const [, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const primary = group[0];
    const urduBook = group.find((b) => b.outcomes.medium === 'ur');
    const { subject, grade } = primary.outcomes;
    const SUBJ = subject.toUpperCase();
    // An Urdu-medium copy only has to have its contents page read to lend its
    // chapter titles. Reading inside it is for Urdu-medium generation, later.
    const urduContents = primary.outcomes.medium === 'en' ? await readJson(join(CONTENTS, `${subject}-${grade}-ur.json`)) : null;
    if (urduContents && !urduBook) {
      bookList.push({
        file: `content/punjab/textbooks/${subject}-${grade}-ur.pdf`,
        subject,
        grade,
        medium: 'ur',
        role: 'urdu titles',
        title: urduContents.bookTitle ?? null,
        curriculum: urduContents.curriculum ?? null,
        contentsPage: true,
      });
    }

    for (const b of group) {
      bookList.push({
        file: b.outcomes.source,
        subject,
        grade,
        medium: b.outcomes.medium,
        role: b === primary ? 'primary' : 'urdu titles',
        title: b.contents?.bookTitle ?? null,
        curriculum: b.contents?.curriculum ?? null,
        contentsPage: b.outcomes.contentsPage,
      });
    }

    const urduChapters = urduContents?.chapters ?? (urduBook && urduBook !== primary ? urduBook.outcomes.chapters : []);
    const urduMatches = matchUrduChapters(
      primary.outcomes.chapters.map((ch) => {
        const e = primary.contents?.chapters.find((c) => c.number === ch.number);
        return { number: ch.number, name: e?.titleEn ?? e?.title ?? ch.title, page: e?.page };
      }),
      urduChapters,
      isSameEdition(primary.contents?.chapters, urduChapters),
    );

    for (const ch of primary.outcomes.chapters) {
      const entry = primary.contents?.chapters.find((c) => c.number === ch.number);
      const read = ch.read;
      if (!read) {
        problems.push(`${primary.name} ch${ch.number}: not read yet`);
        continue;
      }

      // Titles. Urdu-named subjects keep the Urdu as the Urdu title and the
      // English rendering as the title, the FBISE convention.
      const fromContents = (entry?.title ?? ch.title ?? '').trim();
      const printed = tidyCase(
        URDU.test(fromContents) ? bareUrdu(fullerUrdu(fromContents, read.titleOnPage?.trim())) : fromContents || (read.titleOnPage ?? '').trim(),
      );
      const english = entry?.titleEn ?? ch.titleEn ?? null;
      const urduEntry = urduMatches.get(ch.number);
      const urduFromBook = urduEntry ? bareUrdu(URDU_TITLE_FIXES[`${subject}-${grade}-ur:${urduEntry.number}`] ?? urduEntry.title) : null;
      // Mostly Urdu, not merely containing some: an English title can carry an
      // honorific in Arabic script ("Hazrat Muhammad's (صلی اللہ علیہ وآلہ وسلم) ...").
      const printedIsUrdu = (printed.match(/[\u0600-\u06FF]/g)?.length ?? 0) > (printed.match(/[A-Za-z]/g)?.length ?? 0);
      const lesson = subject === 'urd' ? splitAuthor(printed, english) : null;
      const title = lesson?.english ?? (printedIsUrdu ? (english ?? printed) : printed);
      // A book's name first, printed or Urdu-medium; a translation only where
      // no book gives one, so a book that arrives later wins by itself.
      const urduTitle =
        lesson?.urdu ?? (printedIsUrdu ? printed.replace(/\s{2,}/g, ' ') : urduFromBook) ?? translated[`${subject}-pj-${grade}-${ch.number}`] ?? null;

      const topics = read.headings?.length ? topicsFrom(ch, read) : contentsTopics(entry);
      const id = `${subject}-pj-${grade}-${ch.number}`;
      const base = `PJ-${SUBJ}-${pad(grade)}-C${ch.number}`;

      const rows = [];
      if (read.slos?.length) {
        read.slos.forEach((text, i) => rows.push({ code: `${base}-S${pad(i + 1)}`, text: text.trim(), origin: 'textbook_slo' }));
      } else if (topics.length) {
        topics
          .filter((t) => !t.number || /^\d+\.\d+$/.test(t.number))
          .forEach((t, i) => rows.push({ code: `${base}-T${pad(i + 1)}`, text: t.number ? `${t.number} ${t.title}` : t.title, origin: 'textbook_topic' }));
      } else {
        rows.push({ code: `${base}-T01`, text: english ? `${printed} (${english})` : printed, origin: 'textbook_topic' });
      }

      if (!title) problems.push(`${id}: no title`);
      if (rows.some((r) => !r.text)) problems.push(`${id}: an empty outcome`);

      chapters.push({
        id,
        subject,
        grade,
        number: ch.number,
        title,
        urduTitle,
        blurb: writtenBlurbs[id] ?? (lesson ? lesson.author : blurbFor(subject, topics)),
        urduBlurb: urduBlurbs[id] ?? null,
        source: { file: primary.outcomes.source, pdfStart: ch.pdfStart, pdfEnd: ch.pdfEnd, printedPage: entry?.page ?? null },
        sloHeading: read.sloHeading ?? null,
        topics,
        outcomes: rows.map((r) => r.code),
      });
      for (const r of rows) slos.push({ ...r, subject, grade, chapter: ch.number, chapterId: id });
    }
  }

  const codes = new Set();
  for (const s of slos) {
    if (codes.has(s.code)) problems.push(`duplicate code ${s.code}`);
    codes.add(s.code);
  }
  const ids = new Set();
  for (const c of chapters) {
    if (ids.has(c.id)) problems.push(`duplicate chapter ${c.id}`);
    ids.add(c.id);
  }

  const catalogue = scrubDashes({
    board: 'punjab',
    note: 'Built by scripts/build-punjab-catalogue.mjs from the PCTB 2023 textbooks. Structure and printed outcomes only.',
    books: bookList,
    chapters,
    slos,
  });
  await writeFile(OUT, `${JSON.stringify(catalogue, null, 1)}\n`);

  const by = (origin) => slos.filter((s) => s.origin === origin).length;
  console.log(`${C.green('  ok')} ${chapters.length} chapters from ${books.length} books`);
  console.log(`     ${slos.length} outcomes: ${by('textbook_slo')} printed, ${by('textbook_topic')} standing in from topics or lessons`);
  for (const g of ['9', '10']) {
    const list = [...new Set(chapters.filter((c) => String(c.grade) === g).map((c) => c.subject))];
    console.log(C.dim(`     class ${g}: ${list.join(', ')}`));
  }
  if (problems.length) {
    console.log(C.yellow(`\n  ${problems.length} to look at:`));
    for (const p of problems.slice(0, 30)) console.log(C.yellow(`    ${p}`));
  }
}

await main();
