import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Btn, Card, Header, Label, Pill, Row, Screen, Small, Spacer, useToast } from '../../src/components/ui';
import { accuracy, boardName, formatDate, grade, mediumName, subjectById } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, textEnd } from '../../src/theme';

export default function Report() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();

  const [now] = useState(() => Date.now());
  const month = formatDate(now, lang, { month: 'long', year: 'numeric' });
  const overallAcc = accuracy(state.attempts);

  const rows = useMemo(
    () =>
      derived.subjects.map((sid) => {
        const set = state.attempts.filter((a) => a.subjectId === sid);
        // Zero when unattempted. The old fallback graded syllabus coverage
        // as if it were accuracy, and the row hides unattempted subjects
        // anyway, so it could only ever have misled.
        const acc = set.length ? accuracy(set) : 0;
        const half = Math.floor(set.length / 2);
        const older = set.slice(0, half);
        const recent = set.slice(half);
        const delta = older.length && recent.length ? accuracy(recent) - accuracy(older) : 0;
        const trend = delta > 4 ? '↑' : delta < -4 ? '↓' : '→';
        return { sid, acc, trend, attempted: set.length };
      }),
    [derived.subjects, state.attempts]
  );

  const activeDays = state.activeDays.filter((d) => d.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;

  return (
    <Screen>
      <Header title={t('progress.reportTitle')} sub={month} back />

      <Card border={C.teal} style={{ borderWidth: 2 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Image source={require('../../assets/wordmark.png')} style={{ width: 120, height: 24 }} resizeMode="contain" />
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
            <Text style={{ fontFamily: F.display, fontSize: 24, color: C.orangeDark }}>{grade(overallAcc)}</Text>
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
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13.5, color: C.ink }}>{subjectById(r.sid)?.name}</Text>
              <Text style={{ fontFamily: F.display, fontSize: 15, color: C.ink, width: 44, textAlign: textEnd() }}>
                {r.attempted ? grade(r.acc) : 'n/a'}
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
          <Pill tone="teal">{t('progress.activeDays', { n: activeDays })}</Pill>
          <Pill tone="teal">{`${state.attempts.length} ${t('common.questions')}`}</Pill>
          <Pill tone="orange">{`${state.results.length} ${t('progress.tests')}`}</Pill>
          <Pill tone="grey">{t('account.levelLine', { xp: state.xp, level: derived.level })}</Pill>
        </Row>
      </Card>

      <Spacer h={S.lg} />
      <Row gap={S.sm}>
        <View style={{ flex: 1 }}>
          <Btn title={t('progress.share')} variant="whatsapp" icon="whatsapp" onPress={() => toast(t('progress.shareToast'))} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn title={t('progress.savePdf')} variant="line" icon="download" onPress={() => toast(t('progress.pdfToast'))} />
        </View>
      </Row>
      <Spacer h={S.md} />
      <Small>{t('progress.reportFootnote')}</Small>
    </Screen>
  );
}
