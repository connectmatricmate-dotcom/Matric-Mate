import { NextResponse } from 'next/server';
import {
  accuracy,
  boardName,
  formatDate,
  grade,
  mediumName,
  subjectById,
  subjectName,
  translate,
  type Attempt,
  type ReportData,
} from '@matricmate/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportPdf } from '@/lib/report-pdf';

/**
 * The student's monthly report card, as a file.
 *
 * Built here rather than in the browser so that the download is a plain link:
 * one request, one PDF, no print dialog and no client-side assembly. It also
 * means the numbers come from the rows themselves rather than from whatever
 * the page happened to be holding.
 *
 * Cheap on purpose. No model call, no headless browser, four small queries
 * scoped to one student and a few milliseconds of drawing. See report-pdf.ts
 * for why it is drawn rather than rendered, and why the file is in English.
 */

const DEFAULT_SUBJECTS = ['phy', 'chem', 'bio', 'math', 'eng', 'urd', 'isl'];

export async function GET() {
  // getUser, never getSession: the session cookie is not proof on its own.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const userId = auth.user.id;

  const admin = createAdminClient();
  const [{ data: profile }, { data: attemptRows }, { data: dayRows }] = await Promise.all([
    admin.from('profiles').select('name,grade,onboarding,role').eq('id', userId).maybeSingle(),
    admin.from('attempts').select('subject_id,correct,confidence,at').eq('user_id', userId).order('at').limit(5000),
    admin.from('active_days').select('day').eq('user_id', userId).limit(400),
  ]);

  // A report card is a student's own progress. Staff accounts have none, so
  // this would have produced an empty PDF rather than an error, which is a
  // worse answer than saying no.
  if (profile?.role && profile.role !== 'student') {
    return NextResponse.json({ error: 'not_a_student' }, { status: 403 });
  }

  const onboarding = (profile?.onboarding ?? {}) as { medium?: string; board?: string; subjects?: string[] };
  /**
   * This sheet is English, whichever language the student reads in.
   *
   * pdf-lib embeds a standard font and a standard font can only encode
   * Latin-1, so every Urdu character is dropped before it is drawn: see
   * latin1() in lib/report-pdf.ts. Passing Urdu in did not produce an Urdu
   * PDF, it produced a half-empty one, with blank table headers and, once the
   * subject names went through the same path, a blank subject column.
   *
   * The student's own language is not lost: the report card on screen is in
   * it, and both apps' Save as PDF goes through reportHtml and a real
   * rendering engine, which can shape Nastaliq. This route is the fallback
   * that has to work everywhere, so it stays in the one script the font has.
   */
  const lang = 'en';
  const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);

  const rows = (attemptRows ?? []) as { subject_id: string; correct: boolean; confidence: number; at: string }[];
  const attempts: Attempt[] = rows.map((r, i) => ({
    id: `r-${i}`,
    mcqId: `m-${i}`,
    chapterId: '',
    subjectId: r.subject_id,
    topic: '',
    correct: r.correct,
    confidence: r.confidence as Attempt['confidence'],
    mode: 'practice',
    at: Date.parse(r.at),
  }));

  const subjects = onboarding.subjects?.length ? onboarding.subjects : DEFAULT_SUBJECTS;
  const overall = accuracy(attempts);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const data: ReportData = {
    studentName: (profile?.name as string | null)?.trim() || t('common.student'),
    classLine: t('account.classLine', {
      class: (profile?.grade as number | null) ?? 9,
      board: boardName(onboarding.board, lang),
      medium: mediumName(onboarding.medium, lang),
    }),
    month: formatDate(Date.now(), lang, { month: 'long', year: 'numeric' }),
    overallGrade: grade(overall),
    overallAccuracy: overall,
    questions: attempts.length,
    activeDays: ((dayRows ?? []) as { day: string }[]).filter((d) => d.day.startsWith(thisMonth)).length,
    rows: subjects.map((sid) => {
      const set = attempts.filter((a) => a.subjectId === sid);
      // Zero rather than a coverage figure when nothing was attempted: the row
      // prints a dash either way, and grading reading as if it were accuracy
      // is the bug the on-screen card already had fixed.
      const acc = set.length ? accuracy(set) : 0;
      const half = Math.floor(set.length / 2);
      const delta = half && set.length - half ? accuracy(set.slice(half)) - accuracy(set.slice(0, half)) : 0;
      return {
        subject: subjectName(subjectById(sid), lang) || sid,
        grade: set.length ? grade(acc) : 'n/a',
        accuracy: acc,
        attempted: set.length,
        trend: delta > 4 ? '↑' : delta < -4 ? '↓' : '→',
      };
    }),
    labels: {
      title: t('progress.reportTitle'),
      month: t('progress.month'),
      overall: t('progress.reportOverall'),
      questions: t('dash.questions'),
      activeDays: t('dash.activeDays'),
      subject: t('session.subject'),
      grade: t('session.grade', { g: '' }).trim(),
      accuracy: t('dash.accuracy'),
      attempted: t('progress.reportAttempted'),
      footnote: t('progress.reportFootnote'),
      generated: t('progress.reportGenerated', { date: formatDate(Date.now(), 'en', { day: 'numeric', month: 'long', year: 'numeric' }) }),
      trend: t('progress.reportTrend'),
    },
  };

  const pdf = await reportPdf(data);
  const name = `MatricMate report ${new Date().toISOString().slice(0, 7)}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      // attachment, so the browser saves it instead of opening a viewer tab.
      'content-disposition': `attachment; filename="${name}"`,
      // A student's own marks. Never cached by a proxy in between.
      'cache-control': 'private, no-store',
    },
  });
}
