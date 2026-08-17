import { colors } from './tokens';

/**
 * The monthly report card as a standalone printable document.
 *
 * One generator for both apps on purpose. The website printed the live page,
 * so the PDF carried whatever chrome the browser felt like including, and the
 * Android app did not print at all: both its buttons showed a toast and did
 * nothing. A student handing this to a parent should get the same sheet either
 * way, with the school's name on it rather than a screenshot of an app.
 *
 * Plain HTML with inline styles, no external stylesheet or font: it is fed to
 * a print dialog on the web and to expo-print on Android, and neither is a
 * good place to discover that a CDN is unreachable.
 */

export type ReportRow = {
  subject: string;
  /** Already localised: "n/a" when the student has not attempted the subject. */
  grade: string;
  accuracy: number;
  attempted: number;
  trend: string;
};

export type ReportData = {
  studentName: string;
  classLine: string;
  month: string;
  overallGrade: string;
  overallAccuracy: number;
  questions: number;
  activeDays: number;
  rows: ReportRow[];
  /** Localised labels, so the sheet prints in the student's own language. */
  labels: {
    title: string;
    month: string;
    overall: string;
    questions: string;
    activeDays: string;
    subject: string;
    grade: string;
    accuracy: string;
    attempted: string;
    footnote: string;
    /** "Generated 18 August 2026", already formatted by the caller. */
    generated: string;
    trend: string;
  };
  /** Right to left when the app is in Urdu, so the sheet matches the app. */
  rtl?: boolean;
  /** Data URI or absolute URL. Omitted rather than linked: a print job that
   *  reaches for a network image prints a broken box. */
  logoDataUri?: string;
};

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function reportHtml(d: ReportData): string {
  const dir = d.rtl ? 'rtl' : 'ltr';
  const align = d.rtl ? 'right' : 'left';

  const rows = d.rows
    .map(
      (r) => `
      <tr>
        <td style="padding:9px 10px;border-bottom:1px solid ${colors.line};text-align:${align}">${esc(r.subject)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid ${colors.line};text-align:center;font-weight:800">${esc(r.grade)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid ${colors.line};text-align:center">${r.attempted ? `${r.accuracy}%` : '&mdash;'}</td>
        <td style="padding:9px 10px;border-bottom:1px solid ${colors.line};text-align:center">${r.attempted || '&mdash;'}</td>
        <td style="padding:9px 10px;border-bottom:1px solid ${colors.line};text-align:center">${esc(r.trend)}</td>
      </tr>`,
    )
    .join('');

  const stat = (value: string, label: string) => `
    <div style="flex:1;min-width:0;border:1px solid ${colors.line};border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:${colors.ink}">${esc(value)}</div>
      <div style="font-size:11px;color:${colors.ink2};margin-top:2px">${esc(label)}</div>
    </div>`;

  return `<!doctype html>
<html dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.labels.title)}</title></head>
<body style="margin:0;padding:28px;background:#fff;color:${colors.ink};font-family:system-ui,-apple-system,'Segoe UI',sans-serif;direction:${dir}">

  <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid ${colors.teal};padding-bottom:14px">
    ${d.logoDataUri ? `<img src="${d.logoDataUri}" alt="MatricMate" style="height:30px">` : `<div style="font-size:20px;font-weight:800;color:${colors.teal}">MatricMate</div>`}
    <div style="margin-${d.rtl ? 'right' : 'left'}:auto;text-align:${d.rtl ? 'left' : 'right'};font-size:11px;color:${colors.ink2}">
      ${esc(d.labels.generated)}
    </div>
  </div>

  <h1 style="margin:18px 0 2px;font-size:24px">${esc(d.labels.title)}</h1>
  <div style="font-size:13px;color:${colors.ink2}">${esc(d.labels.month)}: ${esc(d.month)}</div>

  <div style="margin-top:16px;border:1px solid ${colors.line};border-radius:14px;padding:14px">
    <div style="font-size:17px;font-weight:800">${esc(d.studentName)}</div>
    <div style="font-size:12.5px;color:${colors.ink2};margin-top:2px">${esc(d.classLine)}</div>
  </div>

  <div style="display:flex;gap:10px;margin-top:14px">
    ${stat(d.overallGrade, d.labels.overall)}
    ${stat(`${d.overallAccuracy}%`, d.labels.accuracy)}
    ${stat(String(d.questions), d.labels.questions)}
    ${stat(String(d.activeDays), d.labels.activeDays)}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:13px">
    <thead>
      <tr style="background:${colors.paper}">
        <th style="padding:9px 10px;text-align:${align};font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${colors.ink2}">${esc(d.labels.subject)}</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${colors.ink2}">${esc(d.labels.grade)}</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${colors.ink2}">${esc(d.labels.accuracy)}</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${colors.ink2}">${esc(d.labels.attempted)}</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${colors.ink2}">${esc(d.labels.trend)}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p style="margin-top:18px;font-size:11.5px;line-height:1.6;color:${colors.ink2}">${esc(d.labels.footnote)}</p>
</body>
</html>`;
}
