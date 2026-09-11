/**
 * The board's own FBISE Class 9 papers: past papers and topper answer scripts.
 *
 * Both come straight from data/fbise/papers.json at the repo root, built once
 * by scripts/build-papers-catalogue.mjs and scripts/fetch-toppers.mjs and
 * committed. Almost every url points at fbise.edu.pk: the board serves these
 * free from its own site, hundreds of megabytes of scanned PDFs with no text
 * layer, so neither app hosts or parses a copy, a screen just opens the link.
 * The one exception is `selfHosted`: one session the board only publishes
 * inside a ZIP, which a browser cannot open a single page of, so
 * scripts/host-zip-papers.mjs extracted those PDFs into our own storage. A
 * screen can link to a selfHosted paper exactly like any other, it just did
 * not come straight from fbise.edu.pk.
 *
 * This file is the only place that reads the JSON, so both apps stay on one
 * copy of the catalogue instead of drifting.
 */
import catalogueJson from '../../../data/fbise/papers.json';
import punjabJson from '../../../data/punjab/papers.json';
import { BOARD_LABEL } from './boards';
import { SUBJECTS } from './content';
import type { Board } from './types';

export type FbisePastPaper = {
  year: number;
  file: string;
  label: string;
  url: string;
  classLevel: number;
  /** True when this PDF was extracted from the board's ZIP and now lives in
   *  our own storage. False means the url is the board's own site. */
  selfHosted: boolean;
  /** The board's original ZIP this was extracted from, when selfHosted. */
  extractedFrom?: string;
  /** True for an accessibility variant, e.g. a hearing-impaired-candidates paper. */
  accessibility?: boolean;
};

export type FbiseTopperPaper = {
  /** One of our subject ids: phy, chem, bio, math, eng, urd, isl, pst, cs. */
  subject: string;
  year: number;
  url: string;
  /** 1-indexed position among that subject's scripts, lowest first. */
  n: number;
};

type Catalogue = {
  retrieved: string;
  pastPapers: FbisePastPaper[];
  toppers: FbiseTopperPaper[];
};

const catalogue = catalogueJson as Catalogue;

/**
 * FBISE past papers for a class, newest year first.
 *
 * The grade is a parameter and not a constant because both classes exist now.
 * The catalogue currently holds SSC-I papers only, so a Class 10 student gets
 * an empty list and the screen says so, which is the honest answer. Showing
 * them Class 9 papers as "your board's papers" was not.
 */
export function fbisePastPapers(grade: number = 9): FbisePastPaper[] {
  return catalogue.pastPapers.filter((p) => p.classLevel === grade).slice().sort((a, b) => b.year - a.year);
}

/** The same papers grouped by year, newest year first. */
export function fbisePastPapersByYear(grade: number = 9): { year: number; papers: FbisePastPaper[] }[] {
  const papers = fbisePastPapers(grade);
  const years = [...new Set(papers.map((p) => p.year))];
  return years.map((year) => ({ year, papers: papers.filter((p) => p.year === year) }));
}

/**
 * A past paper as a screen shows it, whichever board it came from.
 *
 * FBISE publishes one PDF per session covering every subject; the Punjab
 * boards publish per subject and per board. Both reduce to a titled link and
 * the site it opens on, which is all a screen needs, so the two screens stay
 * one screen.
 */
export type PastPaperLink = {
  key: string;
  year: number;
  label: string;
  url: string;
  /** The site the link opens on, for the "hosted on" line. */
  host: string;
  selfHosted: boolean;
  /** Punjab only: which board set it, and for which subject. */
  board?: string;
  subject?: string;
};

type PunjabPaper = {
  board: string;
  boardName: string;
  classLevel: number;
  year: number;
  subject: string;
  label: string;
  url: string;
};
type PunjabCatalogue = { retrieved: string | null; papers: PunjabPaper[] };
const punjab = punjabJson as PunjabCatalogue;

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Past papers for a student's board and class, grouped by year, newest first.
 * Punjab papers within a year run in the app's subject order, then by board.
 */
export function pastPapersByYear(board: Board, grade: number): { year: number; papers: PastPaperLink[] }[] {
  const links: PastPaperLink[] =
    board === 'punjab'
      ? punjab.papers
          .filter((p) => p.classLevel === grade)
          .map((p) => ({
            key: p.url,
            year: p.year,
            label: p.label,
            url: p.url,
            host: hostOf(p.url),
            selfHosted: false,
            board: p.board,
            subject: p.subject,
          }))
      : fbisePastPapers(grade).map((p) => ({
          key: p.file,
          year: p.year,
          label: p.label,
          url: p.url,
          host: p.selfHosted ? '' : hostOf(p.url),
          selfHosted: p.selfHosted,
        }));
  const order = new Map(SUBJECTS.map((s, i) => [s.id, i]));
  const years = [...new Set(links.map((p) => p.year))].sort((a, b) => b - a);
  return years.map((year) => ({
    year,
    papers: links
      .filter((p) => p.year === year)
      .sort(
        (a, b) =>
          (order.get(a.subject ?? '') ?? 99) - (order.get(b.subject ?? '') ?? 99) || (a.board ?? '').localeCompare(b.board ?? ''),
      ),
  }));
}

/** The name a year heading carries: "FBISE", "Punjab Board". */
export const pastPapersBoardLabel = (board: Board): string => BOARD_LABEL[board];

/**
 * The span of past papers we actually link to, or null when there are none.
 *
 * The practice tile advertised "FBISE 2019 to 2025" as a literal in both
 * language tables while the catalogue held nine papers across 2023, 2024 and
 * 2025, all Class 9. A Class 10 student got the same promise over the honest
 * empty state behind it. The tile reads this instead, so it can only ever
 * claim what the catalogue has.
 */
export function pastPaperYears(grade: number = 9, board: Board = 'fbise'): { from: number; to: number; count: number } | null {
  const papers = pastPapersByYear(board, grade).flatMap((g) => g.papers);
  if (!papers.length) return null;
  const years = papers.map((p) => p.year);
  return { from: Math.min(...years), to: Math.max(...years), count: papers.length };
}

/** A subject's topper scripts, script 1 first. */
export function fbiseToppersFor(subjectId: string): FbiseTopperPaper[] {
  return catalogue.toppers
    .filter((t) => t.subject === subjectId)
    .slice()
    .sort((a, b) => a.n - b.n);
}

/**
 * The years the topper scripts come from.
 *
 * They carry no class, and that is not an omission we can fill in: the board
 * publishes them in one folder per year under Topper_Copies/SSC_<year>, with
 * no part number anywhere in the path or the file name. So the screen names
 * the examination and the year rather than implying the scripts belong to the
 * student's own class, which is what it was doing by saying nothing.
 */
export function topperYears(): number[] {
  return [...new Set(catalogue.toppers.map((t) => t.year))].sort((a, b) => b - a);
}

/** Subject ids that have at least one topper script, in the app's usual subject order. */
export function fbiseTopperSubjectIds(): string[] {
  const present = new Set(catalogue.toppers.map((t) => t.subject));
  return SUBJECTS.map((s) => s.id).filter((id) => present.has(id));
}
