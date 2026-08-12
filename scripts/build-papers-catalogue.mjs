#!/usr/bin/env node
/**
 * Build the catalogue of FBISE past papers and topper answer scripts.
 *
 *   node scripts/build-papers-catalogue.mjs
 *
 * Output: data/fbise/papers.json, committed, a few KB.
 *
 * NOTHING IS DOWNLOADED, AND THAT IS THE POINT
 *
 * These are hundreds of megabytes of scanned paper that FBISE already serves
 * free from a public government site. Copying them would cost storage, add a
 * redistribution question nobody needs to answer, and go stale every year. So
 * the catalogue holds URLs and the apps link out.
 *
 * The one exception is anything the board publishes only inside a ZIP. A
 * browser cannot open one page of a ZIP, so those have to be extracted and
 * hosted. They are marked `needsHosting: true` and are the only files that
 * should ever end up in our own storage.
 *
 * Everything here is a scan with no text layer. Do not try to parse it. These
 * exist so a student can look at how a real marked answer was written, which is
 * the thing no amount of generated content teaches.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/fbise');
const BASE = 'https://fbise.edu.pk/';

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/** The board's index pages, one per year. It adds a new one each session. */
const PAST_PAPER_PAGES = [
  { year: 2025, url: 'https://fbise.edu.pk/AllOldPapersSSC1.php' },
  { year: 2024, url: 'https://fbise.edu.pk/AllOldPapersSSC1_2024.php' },
  { year: 2023, url: 'https://fbise.edu.pk/AllOldPapersSSC1_2023.php' },
];

const TOPPERS_PAGE = 'https://fbise.edu.pk/topper_copies.php';

/** Subject from a topper filename. The board names them inconsistently. */
const SUBJECT_OF = (file) => {
  const n = file.toLowerCase();
  for (const [prefix, id] of [
    ['bio', 'bio'],
    ['che', 'chem'],
    ['csc', 'cs'],
    ['eng', 'eng'],
    ['ist', 'isl'],
    ['mat', 'math'],
    ['phy', 'phy'],
    ['pst', 'pst'],
    ['urd', 'urd'],
  ])
    if (n.startsWith(prefix)) return id;
  return null;
};

/**
 * A human label for a past paper file. The board's own names are the best
 * source we have, so clean them rather than invent something.
 */
const LABEL_OF = (file) =>
  file
    .replace(/\.(pdf|zip)$/i, '')
    // The board codes the session into the filename: 1A25 is first annual 2025,
    // 2A25 the second. Unreadable to a student, so spell it out. No \b here:
    // the codes sit against an underscore, which is a word character, so there
    // is no boundary to match.
    .replace(/[_\s-]1A(\d{2})(?![0-9])/i, ' First Annual 20$1')
    .replace(/[_\s-]2A(\d{2})(?![0-9])/i, ' Second Annual 20$1')
    .replace(/[_-]+/g, ' ')
    .replace(/\bSSC-?I\b/i, 'SSC Part 1')
    .replace(/\bSSC-?II\b/i, 'SSC Part 2')
    .replace(/\bHIC\b/i, 'Hearing impaired candidates')
    .replace(/\bQP\b/i, 'question papers')
    .replace(/\s+/g, ' ')
    .trim();

const absolute = (href) => (href.startsWith('http') ? href : BASE + href.replace(/^\//, '').split('/').map(encodeURIComponent).join('/'));

async function linksOn(url, pattern) {
  const html = await fetch(url).then((r) => r.text());
  return [...new Set([...html.matchAll(pattern)].map((m) => m[1]))];
}

async function main() {
  await mkdir(OUT, { recursive: true });

  /* past papers ---------------------------------------------------------- */

  const pastPapers = [];
  for (const { year, url } of PAST_PAPER_PAGES) {
    let hrefs = [];
    try {
      hrefs = await linksOn(url, /href="([^"]*Old(?:%20| )Question(?:%20| )Paper[^"]*\.(?:pdf|zip))"/gi);
    } catch (e) {
      console.error(`${C.red('fail')} ${year}: ${e.message}`);
      continue;
    }
    for (const href of hrefs) {
      const file = decodeURIComponent(href.split('/').pop());
      // SSC-II is Class 10. Keep it out: this app is Class 9.
      const isPartTwo = /SSC[-_ ]?II/i.test(file);
      const isZip = /\.zip$/i.test(file);
      pastPapers.push({
        year,
        file,
        label: LABEL_OF(file),
        url: absolute(href),
        classLevel: isPartTwo ? 10 : 9,
        // A browser cannot open one page of a ZIP, so these are the only files
        // we ever have to host ourselves.
        needsHosting: isZip,
        note: isZip ? 'ZIP: extract SSC-I Normal.pdf and host it, the rest is Class 10 or accessibility variants' : null,
      });
    }
    console.log(`${C.green('  ok')} past papers ${year} ${C.dim(`${hrefs.length} files`)}`);
  }

  /* topper answer scripts ------------------------------------------------ */

  const toppers = [];
  try {
    const hrefs = await linksOn(TOPPERS_PAGE, /href="(Topper_Copies\/[^"]+)"/g);
    for (const href of hrefs) {
      const file = href.split('/').pop();
      const folder = href.split('/')[1] ?? '';
      const [level, year] = folder.split('_');
      const subject = SUBJECT_OF(file);
      if (level !== 'SSC' || !subject) continue; // HSSC is Class 11 and 12
      toppers.push({ subject, year: Number(year) || null, url: absolute(href) });
    }
    // Number them per subject so the UI can say "Topper 1", "Topper 2".
    const seen = {};
    for (const t of toppers) {
      seen[t.subject] = (seen[t.subject] ?? 0) + 1;
      t.n = seen[t.subject];
    }
    console.log(`${C.green('  ok')} topper scripts ${C.dim(`${toppers.length} for SSC`)}`);
  } catch (e) {
    console.error(`${C.red('fail')} toppers: ${e.message}`);
  }

  const doc = {
    _note: [
      'Links to FBISE, not copies. The board serves these free from a public site and they are',
      'hundreds of megabytes of scanned paper, so the apps link out rather than host them.',
      '',
      'Everything here is a scan with no text layer. Do not parse it. Toppers exist so a student',
      'can see how a real marked answer was written, which is what no generated content teaches.',
      '',
      'needsHosting means the board only publishes it inside a ZIP, which a browser cannot open',
      'a page of. Those are the only files that belong in our own storage.',
    ],
    retrieved: new Date().toISOString().slice(0, 10),
    pastPapers,
    toppers,
  };

  await writeFile(resolve(OUT, 'papers.json'), `${JSON.stringify(doc, null, 2)}\n`);

  const cls9 = pastPapers.filter((p) => p.classLevel === 9);
  const hosting = pastPapers.filter((p) => p.needsHosting);
  console.log(
    C.dim(
      `\n  ${cls9.length} Class 9 past papers, ${toppers.length} topper scripts -> data/fbise/papers.json` +
        `${hosting.length ? `\n  ${hosting.length} need extracting and hosting: ${hosting.map((h) => h.file).join(', ')}` : ''}`,
    ),
  );
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
