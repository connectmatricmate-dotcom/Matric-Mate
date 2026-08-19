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
import { SUBJECTS } from './content';

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
 * The span of past papers we actually link to, or null when there are none.
 *
 * The practice tile advertised "FBISE 2019 to 2025" as a literal in both
 * language tables while the catalogue held nine papers across 2023, 2024 and
 * 2025, all Class 9. A Class 10 student got the same promise over the honest
 * empty state behind it. The tile reads this instead, so it can only ever
 * claim what the catalogue has.
 */
export function pastPaperYears(grade: number = 9): { from: number; to: number; count: number } | null {
  const papers = fbisePastPapers(grade);
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

/** Subject ids that have at least one topper script, in the app's usual subject order. */
export function fbiseTopperSubjectIds(): string[] {
  const present = new Set(catalogue.toppers.map((t) => t.subject));
  return SUBJECTS.map((s) => s.id).filter((id) => present.has(id));
}
