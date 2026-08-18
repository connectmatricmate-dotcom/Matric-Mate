import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { BILLING_SITE, type ReportData } from '@matricmate/core';

/**
 * The monthly report card as a real PDF file, drawn rather than printed.
 *
 * The website used to open a print dialog. That is not a download, it is a
 * detour: the student picks "Save as PDF" from a menu, chooses a folder, and
 * gets whatever margins and headers the browser felt like adding. What they
 * asked for was a file.
 *
 * Drawn with pdf-lib, not rendered from HTML by a headless browser. Shaping
 * Nastaliq correctly needs a real text engine, which means shipping Chromium,
 * which is fifty megabytes and several seconds of cold start on every request
 * for a page a student opens once a month. This is a few hundred kilobytes and
 * a few milliseconds, and the layout is simple enough to place by hand.
 *
 * The consequence is that the PDF is in English whatever language the app is
 * in, and the screen says so before you tap. A standard PDF font covers Latin
 * only, so Urdu would come out as empty boxes: better to be plainly English
 * than quietly broken. The app itself, and the report card on screen, are
 * still fully Urdu.
 */

const TEAL = rgb(0.039, 0.494, 0.643); // #0A7EA4
const INK = rgb(0.059, 0.239, 0.298); // #0F3D4C
const INK2 = rgb(0.243, 0.392, 0.451); // #3E6473
const LINE = rgb(0.851, 0.886, 0.863); // #D9E2DC
const PAPER = rgb(0.98, 0.984, 0.969); // #FAFBF7

const A4 = { w: 595.28, h: 841.89 };
const M = 48;

/**
 * A standard PDF font can only encode Latin-1. A student whose name is written
 * in Urdu would otherwise throw on the first character, so anything outside
 * that range is dropped, and a name that was entirely outside it falls back to
 * the caller's word for "student" rather than to an empty line.
 */
function latin1(value: string, fallback: string): string {
  const kept = [...value].filter((c) => c.charCodeAt(0) <= 0xff).join('').trim();
  return kept || fallback;
}

export function reportPdf(d: ReportData): Promise<Uint8Array> {
  return build(d);
}

async function build(d: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.labels.title} ${d.month}`);
  doc.setCreator('MatricMate');
  doc.setProducer('MatricMate');

  const page = doc.addPage([A4.w, A4.h]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const student = latin1(d.studentName, 'Student');

  let y = A4.h - M;

  // Masthead: wordmark left, generated date right, brand rule under both.
  page.drawText('MatricMate', { x: M, y: y - 18, size: 20, font: bold, color: TEAL });
  right(page, d.labels.generated, A4.w - M, y - 12, 9, body, INK2);
  y -= 30;
  page.drawRectangle({ x: M, y, width: A4.w - M * 2, height: 2.5, color: TEAL });
  y -= 34;

  page.drawText(latin1(d.labels.title, 'Report card'), { x: M, y, size: 22, font: bold, color: INK });
  y -= 16;
  page.drawText(`${latin1(d.labels.month, 'Month')}: ${latin1(d.month, '')}`, { x: M, y, size: 10.5, font: body, color: INK2 });
  y -= 26;

  // Who this is about.
  box(page, M, y - 46, A4.w - M * 2, 46);
  page.drawText(student, { x: M + 14, y: y - 20, size: 14, font: bold, color: INK });
  page.drawText(latin1(d.classLine, ''), { x: M + 14, y: y - 36, size: 10, font: body, color: INK2 });
  y -= 62;

  // The four headline numbers.
  const stats: [string, string][] = [
    [d.overallGrade, d.labels.overall],
    [`${d.overallAccuracy}%`, d.labels.accuracy],
    [String(d.questions), d.labels.questions],
    [String(d.activeDays), d.labels.activeDays],
  ];
  const gap = 10;
  const sw = (A4.w - M * 2 - gap * 3) / 4;
  stats.forEach(([value, label], i) => {
    const x = M + i * (sw + gap);
    box(page, x, y - 54, sw, 54);
    centre(page, latin1(value, '0'), x + sw / 2, y - 26, 19, bold, INK);
    centre(page, sentence(latin1(label, '')), x + sw / 2, y - 43, 8, body, INK2);
  });
  y -= 76;

  // Per-subject table.
  const cols = [M, M + 210, M + 300, M + 390, A4.w - M - 40];
  page.drawRectangle({ x: M, y: y - 20, width: A4.w - M * 2, height: 20, color: PAPER });
  const heads = [d.labels.subject, d.labels.grade, d.labels.accuracy, d.labels.attempted, d.labels.trend];
  heads.forEach((h, i) => {
    const text = latin1(h, '').toUpperCase();
    if (i === 0) page.drawText(text, { x: cols[0] + 8, y: y - 14, size: 7.5, font: bold, color: INK2 });
    else centre(page, text, cols[i] + 20, y - 14, 7.5, bold, INK2);
  });
  y -= 20;

  for (const r of d.rows) {
    page.drawText(latin1(r.subject, ''), { x: cols[0] + 8, y: y - 15, size: 10.5, font: body, color: INK });
    centre(page, latin1(r.grade, ''), cols[1] + 20, y - 15, 10.5, bold, INK);
    // A dash rather than 0%, so an unattempted subject does not read as a zero
    // score. The on-screen card makes the same distinction.
    centre(page, r.attempted ? `${r.accuracy}%` : '-', cols[2] + 20, y - 15, 10.5, body, INK);
    centre(page, r.attempted ? String(r.attempted) : '-', cols[3] + 20, y - 15, 10.5, body, INK);
    // The arrows are outside Latin-1, so they become words the font can draw.
    centre(page, r.trend === '↑' ? 'up' : r.trend === '↓' ? 'down' : 'same', cols[4] + 20, y - 15, 9, body, INK2);
    y -= 22;
    page.drawRectangle({ x: M, y: y + 4, width: A4.w - M * 2, height: 0.6, color: LINE });
  }

  y -= 16;
  for (const line of wrap(latin1(d.labels.footnote, ''), body, 9, A4.w - M * 2)) {
    page.drawText(line, { x: M, y, size: 9, font: body, color: INK2 });
    y -= 13;
  }

  // Page furniture at the foot, so a mostly empty A4 still reads as a finished
  // document rather than a page that ran out.
  page.drawRectangle({ x: M, y: M + 22, width: A4.w - M * 2, height: 0.6, color: LINE });
  page.drawText('MatricMate', { x: M, y: M + 8, size: 8.5, font: bold, color: TEAL });
  right(page, BILLING_SITE, A4.w - M, M + 8, 8.5, body, INK2);

  return doc.save();
}

/**
 * These labels are shared with the app, where several of them sit mid-sentence
 * and are therefore lowercase: "accuracy", "questions". Stacked under a figure
 * on a printed card they read as a typo, so the first letter is lifted here
 * rather than changing copy that is correct where it came from.
 */
function sentence(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function box(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, borderColor: LINE, borderWidth: 1, color: rgb(1, 1, 1) });
}

function centre(page: PDFPage, text: string, cx: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

function right(page: PDFPage, text: string, rx: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  page.drawText(text, { x: rx - font.widthOfTextAtSize(text, size), y, size, font, color });
}

/** Greedy wrap, so a long footnote does not run off the page. */
function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
