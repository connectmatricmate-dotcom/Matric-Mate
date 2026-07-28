import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Empty, Header, Row, Screen, SectionTitle, Small, Spacer } from '../../src/components/ui';
import { subjectById } from '../../src/core/content';
import { weakTopics } from '../../src/core/domain';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Weak() {
  const { state } = useApp();
  const rows = useMemo(() => weakTopics(state.attempts), [state.attempts]);

  const bySubject = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.subjectId] ||= []).push(r);
    return acc;
  }, {});

  return (
    <Screen>
      <Header title="Weak topics" sub="Spotted from your own answers" back />

      {rows.length === 0 ? (
        <Empty
          emoji="🔍"
          title="Nothing flagged yet"
          sub="Practice a bit first — we look for topics where you drop below 75%."
          cta={<Btn title="Practice 10 MCQs" sm onPress={() => router.push('/session/setup')} />}
        />
      ) : (
        Object.entries(bySubject).map(([sid, list]) => (
          <View key={sid}>
            <SectionTitle>{subjectById(sid)?.name}</SectionTitle>
            <View style={{ gap: S.sm }}>
              {list.map((w) => (
                <Card key={w.topic} flat>
                  <Row>
                    <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{w.topic}</Text>
                    <Text
                      style={{
                        fontFamily: F.display,
                        fontSize: 16,
                        color: w.accuracy < 50 ? C.red : C.orangeDark,
                      }}
                    >
                      {w.accuracy}%
                    </Text>
                  </Row>
                  <Small>
                    {w.right} right out of {w.total} attempted
                  </Small>
                  <Row gap={S.sm} style={{ marginTop: S.md }}>
                    <View style={{ flex: 1 }}>
                      <Btn title="Study" variant="line" sm onPress={() => router.push(`/learn/chapter/${w.chapterId}`)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn title="Practise 10" sm onPress={() => router.push(`/session/setup?chapter=${w.chapterId}`)} />
                    </View>
                  </Row>
                </Card>
              ))}
            </View>
          </View>
        ))
      )}
      <Spacer h={S.lg} />
      <Small>A topic appears here after at least 3 attempts below 75% accuracy.</Small>
    </Screen>
  );
}
