/**
 * A chapter's weight on the annual paper, from the board's Table of
 * Specification as recorded in data/fbise/chapters.json (Class 9) and
 * data/fbise/chapters-ssc2.json (Class 10).
 *
 * Shared by every script that writes exam_share, so the seeders and the
 * repair can never disagree. The column has three states, and the apps and
 * the mock paper read each one differently:
 *
 *   a number   the board's share of the paper for this chapter
 *   0          the board sets nothing on this chapter (listed in notExamined,
 *              or given 0 marks in the ToS); no badge, never drawn
 *   null       no weight published for it; no badge, shares what is left
 *
 * One more rule. A subject where the board weighs a single chapter and no
 * other gets no shares at all. Pakistan Studies Class 9 was that subject:
 * the ToS weighs History (one chapter) at 22.2% and the other seven chapters
 * only as two domain totals, and the mock paper, seeing one real share against
 * seven blanks, drew almost its whole MCQ section from that one chapter.
 */

/** number -> { marks, share } for one subject's spec entry. */
export function weightsFor(subject) {
  const out = new Map();
  const chapters = subject?.chapters ?? [];
  const notExamined = new Set(subject?.notExamined ?? []);
  const weighed = chapters.filter((c) => !notExamined.has(c.number) && Number(c.share) > 0);
  const lone = weighed.length === 1;
  for (const c of chapters) {
    const share = c.share ?? null;
    out.set(c.number, { marks: c.marks ?? null, share: lone && Number(share) > 0 ? null : share });
  }
  for (const n of notExamined) out.set(n, { marks: out.get(n)?.marks ?? null, share: 0 });
  return out;
}
