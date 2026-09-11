import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, H2, Header, Pill, Row, Screen, Small, Spacer, useToast } from '../../src/components/ui';
import { api, boardName, chapterById, chapterName, subjectById, subjectName, weakTopics } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

export default function ExamIntro() {
  const { subject, chapter, paper, ai, topics, count: countParam } = useLocalSearchParams<{
    subject?: string;
    chapter?: string;
    paper?: string;
    ai?: string;
    topics?: string;
    count?: string;
  }>();
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const subjectId = subject ?? (chapter ? chapterById(chapter)?.subjectId : undefined) ?? derived.subjects[0] ?? 'phy';
  const isAi = ai === '1';
  // The AI screen's choices arrive as params; everything else stays a board
  // exam: 20 questions, 30 minutes.
  const count = isAi && countParam ? Math.min(25, Math.max(5, Number(countParam) || 15)) : 20;
  const minutes = Math.round(count * 1.5);

  const best = state.results
    .filter((r) => r.subjectId === subjectId && r.mode === 'exam')
    .sort((a, b) => (b.total ? b.score / b.total : 0) - (a.total ? a.score / a.total : 0))[0];

  const label = isAi
    ? t('tutor.aiTestTitle')
    : paper
      ? `${boardName(state.onboarding?.board, lang)} ${paper}`
      : chapter
        ? chapterName(chapterById(chapter), lang)
        : subjectName(subjectById(subjectId), lang);

  async function start() {
    setBusy(true);
    let mcqs;
    try {
      // The topic list comes from the AI screen's picker, falling back to the
      // student's actual weak topics. Three Physics topics were hardcoded
      // here, so every AI test was a Physics test whatever the student chose.
      const aiTopics = topics
        ? topics.split('|').filter(Boolean)
        : weakTopics(state.attempts).slice(0, 3).map((w) => w.topic);
      mcqs = isAi
        ? await api.generateTest(aiTopics, count)
        : await api.getMcqs({
            chapterIds: chapter ? [chapter] : undefined,
            subjectId: chapter ? undefined : subjectId,
            count,
          });
    } catch {
      setBusy(false);
      toast(t('states.errorTitle'));
      return;
    }
    setBusy(false);
    if (!mcqs.length) {
      toast(t('session.noQuestions'));
      return;
    }
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
          {/* No pause pill: the exam has no pause mechanism, and promising
              one here cost students who believed it their timer. */}
          {isAi ? <Pill tone="teal">{t('session.weakFocus')}</Pill> : null}
        </Row>
      </Card>

      <Spacer h={S.lg} />
      <Card flat>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{t('session.beforeStart')}</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          <Small>• {t('session.beforeStart1', { min: minutes })}</Small>
          <Small>• {t('session.beforeStart2')}</Small>
        </View>
      </Card>
    </Screen>
  );
}
