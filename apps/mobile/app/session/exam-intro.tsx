import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, H2, Header, Pill, Row, Screen, Small, Spacer } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { chapterById, subjectById } from '../../src/core/content';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

export default function ExamIntro() {
  const { subject, chapter, paper, ai } = useLocalSearchParams<{ subject?: string; chapter?: string; paper?: string; ai?: string }>();
  const { state, derived } = useApp();
  const [busy, setBusy] = useState(false);

  const subjectId = subject ?? (chapter ? chapterById(chapter)?.subjectId : undefined) ?? derived.subjects[0] ?? 'phy';
  const isAi = ai === '1';
  const count = 20;
  const minutes = 30;

  const best = state.results
    .filter((r) => r.subjectId === subjectId && r.mode === 'exam')
    .sort((a, b) => b.score / b.total - a.score / a.total)[0];

  const label = isAi
    ? 'AI test — your weak topics'
    : paper
      ? `FBISE ${paper} — practice as exam`
      : chapter
        ? `${chapterById(chapter)?.title} — chapter test`
        : `${subjectById(subjectId)?.name} — timed exam`;

  async function start() {
    setBusy(true);
    const mcqs = isAi
      ? await api.generateTest(['Circular motion', 'Turning Effect of Forces', 'Transport'], count)
      : await api.getMcqs({ chapterIds: chapter ? [chapter] : undefined, subjectId: chapter ? undefined : subjectId, count });
    setBusy(false);
    session.start({
      mode: 'exam',
      label,
      subjectId,
      chapterId: chapter ?? null,
      mcqs,
      durationSec: minutes * 60,
      aiGenerated: isAi,
    });
    router.replace('/session/exam');
  }

  return (
    <Screen footer={<Btn title="Start exam" variant="orange" onPress={start} loading={busy} />}>
      <Header title="Timed exam" sub={label} back />

      <Card border={C.orange} style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Icon name="clock" size={34} color={C.orangeDark} />
        <H2 style={{ marginTop: 8, textAlign: 'center' }}>
          {count} questions · {minutes} minutes
        </H2>
        <Small style={{ textAlign: 'center' }}>No answers until you submit · XP counts double</Small>
        <Row gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap', justifyContent: 'center' }}>
          {best ? <Pill tone="green">Best: {Math.round((best.score / best.total) * 100)}%</Pill> : <Pill tone="grey">First attempt</Pill>}
          <Pill tone="orange">Leaving pauses once</Pill>
          {isAi ? <Pill tone="teal">AI-generated</Pill> : null}
        </Row>
      </Card>

      <Spacer h={S.lg} />
      <Card flat>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>Before you start</Text>
        <View style={{ gap: 6, marginTop: 8 }}>
          <Small>• Phone silent kar lo — {minutes} minute focus.</Small>
          <Small>• You can flag questions and come back to them.</Small>
          <Small>• The timer keeps running if you close the app (one pause allowed).</Small>
        </View>
      </Card>
    </Screen>
  );
}
