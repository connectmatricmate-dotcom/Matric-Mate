import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Header, Label, Pill, Row, Screen, ScriptText, Small, Spacer, Text, Wordmark, useToast } from '../../src/components/ui';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  WORDMARK_DATA_URI,
  accuracy,
  boardName,
  formatDate,
  grade,
  mediumName,
  reportHtml,
  subjectById,
  subjectName,
  testsThisMonth,
} from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, textEnd } from '../../src/theme';

/** The Karachi calendar month an instant falls in, "2026-09": the month the app counts days in. */
const pktMonth = (ms: number): string => new Date(ms + 5 * 3600_000).toISOString().slice(0, 7);

export default function Report() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();

  const [now] = useState(() => Date.now());
  const month = formatDate(now, lang, { month: 'long', year: 'numeric' });
  const printedOn = formatDate(now, lang, { day: 'numeric', month: 'long', year: 'numeric' });

  /**
   * This month's work only, which is what the card says it is: "Monthly
   * report", "grades come from your accuracy this month". Grades, accuracy
   * and counts all came from every answer ever; only the active days were
   * the month's. In Karachi's calendar, like the days themselves.
   */
  const thisMonth = pktMonth(now);
  const monthAttempts = useMemo(
    () => state.attempts.filter((a) => Number.isFinite(a.at) && pktMonth(a.at) === thisMonth),
    [state.attempts, thisMonth],
  );
  const monthResults = useMemo(() => testsThisMonth(state.results), [state.results]);
  const overallAcc = accuracy(monthAttempts);
  // No answers, no grade: a new student, or a new month, was graded "F".
  const overallGrade = monthAttempts.length ? grade(overallAcc) : t('progress.gradeNone');

  const rows = useMemo(
    () =>
      derived.subjects.map((sid) => {
        const set = monthAttempts.filter((a) => a.subjectId === sid);
        // Zero when unattempted. The old fallback graded syllabus coverage
        // as if it were accuracy, and the row hides unattempted subjects
        // anyway, so it could only ever have misled.
        const acc = set.length ? accuracy(set) : 0;
        const half = Math.floor(set.length / 2);
        const older = set.slice(0, half);
        const recent = set.slice(half);
        const delta = older.length && recent.length ? accuracy(recent) - accuracy(older) : 0;
        // No answers this month, no direction: an arrow beside "n/a" said nothing.
        const trend = !set.length ? '' : delta > 4 ? '↑' : delta < -4 ? '↓' : '→';
        return { sid, acc, trend, attempted: set.length };
      }),
    [derived.subjects, monthAttempts]
  );

  // Day keys are Karachi dates, so the month is too. It was UTC, and the
  // count went wrong before five in the morning on the first.
  const activeDays = state.activeDays.filter((d) => d.slice(0, 7) === thisMonth).length;

  const [busy, setBusy] = useState(false);

  /** The printable sheet, built by the same generator the website prints. */
  function printable(): string {
    return reportHtml({
      studentName: state.user?.name ?? t('common.student'),
      classLine: t('account.classLine', {
        class: state.onboarding?.classLevel ?? 9,
        board: boardName(state.onboarding?.board, lang),
        medium: mediumName(state.onboarding?.medium, lang),
      }),
      month,
      overallGrade,
      overallAccuracy: overallAcc,
      questions: monthAttempts.length,
      activeDays,
      rtl: lang === 'ur',
      logoDataUri: WORDMARK_DATA_URI,
      rows: rows.map((r) => ({
        subject: subjectName(subjectById(r.sid), lang) || r.sid,
        grade: r.attempted ? grade(r.acc) : t('progress.gradeNone'),
        accuracy: r.acc,
        attempted: r.attempted,
        trend: r.trend,
      })),
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
        generated: t('progress.reportGenerated', { date: printedOn }),
        trend: t('progress.reportTrend'),
      },
    });
  }

  /**
   * Both buttons do what they say now. They used to show a toast claiming the
   * share sheet had opened and then do nothing at all, on the one screen built
   * for handing to a parent.
   *
   * Text goes through the share sheet as a summary, matching what the website
   * sends to WhatsApp. PDF renders the same branded sheet the website prints
   * and hands the file to the share sheet, so a parent gets a document with
   * the student's name and school on it rather than a screenshot.
   */
  async function shareReport() {
    if (busy) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: printable() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('progress.reportTitle') });
      } else {
        toast(t('progress.reportShared'));
      }
    } catch {
      toast(t('progress.shareFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title={t('progress.reportTitle')} sub={month} back />

      <Card border={C.teal} style={{ borderWidth: 2 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Wordmark width={120} height={24} />
            <Label style={{ marginTop: 6 }}>{t('progress.monthlyReport', { month })}</Label>
          </View>
          <View
            style={{
              width: 66,
              height: 66,
              borderRadius: 99,
              backgroundColor: C.orangeTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: F.display, fontSize: 24, color: C.orangeDark }}>{overallGrade}</Text>
          </View>
        </Row>

        <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink, marginTop: S.md }}>
          {state.user?.name ?? t('common.student')} ·{' '}
          {t('account.classLine', {
            class: state.onboarding?.classLevel ?? 9,
            board: boardName(state.onboarding?.board, lang),
            medium: mediumName(state.onboarding?.medium, lang),
          })}
        </Text>

        <View style={{ marginTop: S.md }}>
          {rows.map((r) => (
            <Row
              key={r.sid}
              style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line, justifyContent: 'space-between' }}
            >
              <ScriptText text={subjectName(subjectById(r.sid), lang)} size={13.5} style={{ flex: 1 }} />
              <Text style={{ fontFamily: F.display, fontSize: 15, color: C.ink, width: 44, textAlign: textEnd() }}>
                {r.attempted ? grade(r.acc) : t('progress.gradeNone')}
              </Text>
              <Text
                style={{
                  width: 26,
                  textAlign: textEnd(),
                  fontFamily: F.bodyBold,
                  fontSize: 14,
                  color: r.trend === '↑' ? C.green : r.trend === '↓' ? C.red : C.ink3,
                }}
              >
                {r.trend}
              </Text>
            </Row>
          ))}
        </View>

        <Row gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
          {/* One of each reads "1 active day", not "1 active days": the
              website had these forms and this card never used them. */}
          <Pill tone="teal">{t(activeDays === 1 ? 'progress.activeDaysOne' : 'progress.activeDays', { n: activeDays })}</Pill>
          <Pill tone="teal">
            {t(monthAttempts.length === 1 ? 'progress.questionsOne' : 'progress.questionsMany', { n: monthAttempts.length })}
          </Pill>
          <Pill tone="orange">{t(monthResults.length === 1 ? 'progress.testsOne' : 'progress.testsMany', { n: monthResults.length })}</Pill>
          <Pill tone="grey">{t('account.levelLine', { xp: state.xp, level: derived.level })}</Pill>
        </Row>
      </Card>

      <Spacer h={S.lg} />
      {/* One action. The other button shared a text summary, which is not the
          report: a parent got a paragraph instead of the sheet. This makes the
          PDF and hands it to Android's own share sheet, so the student sends
          it wherever they like, WhatsApp included. */}
      <Btn title={t('progress.savePdf')} icon="download" loading={busy} onPress={() => void shareReport()} />
      <Spacer h={S.md} />
      <Small>{t('progress.reportFootnote')}</Small>
    </Screen>
  );
}
