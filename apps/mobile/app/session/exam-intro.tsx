import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, H2, Header, Pill, Row, Screen, Small, Spacer } from '../../src/components/ui';
import { api } from '@matricmate/core';
import { chapterById, subjectById } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

export default function ExamIntro() {
  const { subject, chapter, paper, ai } = useLocalSearchParams<{
    subject?: string;
    chapter?: string;
    paper?: string;
    ai?: string;
  }>();
  const { state, derived } = useApp();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const subjectId = subject ?? (chapter ? chapterById(chapter)?.subjectId : undefined) ?? derived.subjects[0] ?? 'phy';
  const isAi = ai === '1';
  const count = 20;
  const minutes = 30;

  const best = state.results
    .filter((r) => r.subjectId === subjectId && r.mode === 'exam')
    .sort((a, b) => b.score / b.total - a.score / a.total)[0];

  const label = isAi
    ? t('tutor.aiTestTitle')
    : paper
      ? `FBISE ${paper}`
      : chapter
        ? (chapterById(chapter)?.title ?? '')
        : (subjectById(subjectId)?.name ?? '');

  async function start() {
    setBusy(true);
    const mcqs = isAi
      ? await api.generateTest(['Circular motion', 'Turning Effect of Forces', 'Transport'], count)
      : await api.getMcqs({
          chapterIds: chapter ? [chapter] : undefined,
          subjectId: chapter ? undefined : subjectId,
          count,
        });
    setBusy(false);
    session.start({
      mode: 'exam',
      label: `${label} · ${t('session.examTitle')}`,
      subjectId,
      chapterId: chapter ?? null,
      mcqs,
      durationSec: minutes * 60,
      aiGenerated: isAi,
    });
    router.replace('/session/exam');
  }

  return (
    <Screen footer={<Btn title={t('session.startExam')} variant="orange" onPress={start} loading={busy} />}>
      <Header title={t('session.examTitle')} sub={label} back />

      <Card border={C.orange} style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Icon name="clock" size={34} color={C.orangeDark} />
        <H2 style={{ marginTop: 10, textAlign: 'center' }}>{t('session.examRules', { n: count, min: minutes })}</H2>
        <Small style={{ textAlign: 'center', marginTop: 2 }}>{t('session.examRulesSub')}</Small>
        <Row gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap', justifyContent: 'center' }}>
          {best ? (
            <Pill tone="green">{t('session.best', { n: Math.round((best.score / best.total) * 100) })}</Pill>
          ) : (
            <Pill tone="grey">{t('session.firstAttempt')}</Pill>
          )}
          <Pill tone="orange">{t('session.pauseOnce')}</Pill>
          {isAi ? <Pill tone="teal">{t('session.aiGenerated')}</Pill> : null}
        </Row>
      </Card>

      <Spacer h={S.lg} />
      <Card flat>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{t('session.beforeStart')}</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          <Small>• {t('session.beforeStart1', { min: minutes })}</Small>
          <Small>• {t('session.beforeStart2')}</Small>
          <Small>• {t('session.beforeStart3')}</Small>
        </View>
      </Card>
    </Screen>
  );
}
