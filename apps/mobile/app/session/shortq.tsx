import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Btn, Card, H2, Header, Label, Pill, Row, Screen, Seg, Skeleton, Small, Spacer } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { useAsync } from '../../src/core/useAsync';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

type Mark = 'got' | 'partial' | 'missed';

export default function ShortQuestions() {
  const { chapter } = useLocalSearchParams<{ chapter?: string }>();
  const chapterId = chapter ?? 'phy-3';
  const { actions } = useApp();
  const { data: content, loading } = useAsync(() => api.getChapterContent(chapterId), [chapterId]);

  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);

  const items = content?.shortQs ?? [];
  const item = items[i];
  const done = !!content && i >= items.length;

  function mark(m: Mark) {
    if (!item) return;
    setMarks((prev) => [...prev, m]);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId,
      subjectId: chapterId.split('-')[0],
      topic: 'Short questions',
      correct: m === 'got',
      confidence: null,
      mode: 'shortq',
    });
    setRevealed(false);
    setI(i + 1);
  }

  if (loading) {
    return (
      <Screen>
        <Header title="Short questions" back />
        <Skeleton h={140} />
      </Screen>
    );
  }

  if (done) {
    const got = marks.filter((m) => m === 'got').length;
    return (
      <Screen>
        <Header title="Short questions" sub="Complete" back />
        <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <Text style={{ fontSize: 38 }}>📝</Text>
          <H2>
            {got} / {items.length} confident
          </H2>
          <Small style={{ textAlign: 'center' }}>
            Anything you marked “partially” or “missed” feeds your weak topics, so tests can focus there.
          </Small>
        </Card>
        <Spacer h={S.lg} />
        <Btn title="Back to chapter" onPress={() => router.replace(`/learn/chapter/${chapterId}`)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Short questions" sub={`${i + 1} of ${items.length}`} back />

      <Card>
        <Row gap={S.sm}>
          <Label style={{ color: C.teal }}>Question {i + 1}</Label>
          <Pill tone="grey">{item?.marks} marks</Pill>
        </Row>
        <Text style={{ fontFamily: F.display, fontSize: 17, lineHeight: 25, color: C.ink, marginTop: 6 }}>{item?.q}</Text>
      </Card>

      <Spacer h={S.md} />
      {!revealed ? (
        <>
          <Card flat tint={C.tealTint}>
            <Small>Think through your answer first — writing it in your notebook works best.</Small>
          </Card>
          <Spacer h={S.md} />
          <Btn title="Reveal model answer" onPress={() => setRevealed(true)} />
        </>
      ) : (
        <>
          <Card flat tint={C.greenTint} border={C.green}>
            <Label style={{ color: C.green }}>Model answer</Label>
            <Body style={{ marginTop: 4 }}>{item?.answer}</Body>
            <Spacer h={S.sm} />
            <Label style={{ color: C.ink2 }}>Marking points</Label>
            <View style={{ gap: 4, marginTop: 4 }}>
              {item?.points.map((p, n) => (
                <Small key={n}>• {p}</Small>
              ))}
            </View>
          </Card>

          <Spacer h={S.lg} />
          <Label>How did you do?</Label>
          <Spacer h={S.sm} />
          <Row gap={S.sm}>
            <View style={{ flex: 1 }}>
              <Btn title="Got it" variant="green" sm onPress={() => mark('got')} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn title="Partially" variant="orange" sm onPress={() => mark('partial')} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn title="Missed" variant="danger" sm onPress={() => mark('missed')} />
            </View>
          </Row>
          <Spacer h={S.sm} />
          <Small>Be honest — this is what makes the weak-topic list useful.</Small>
        </>
      )}
    </Screen>
  );
}
