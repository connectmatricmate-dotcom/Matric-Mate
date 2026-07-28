import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Btn, Card, Header, Label, Pill, Row, Screen, Small, Spacer, Tap } from '../../src/components/ui';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

type Filter = 'all' | 'wrong' | 'flagged';

export default function Review() {
  const s = session.current;
  const [filter, setFilter] = useState<Filter>('wrong');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!s) return [];
    return s.mcqs
      .map((m) => ({ mcq: m, a: s.answers[m.id] }))
      .filter(({ a }) => (filter === 'all' ? true : filter === 'wrong' ? a && !a.correct : a?.flagged))
      .sort((x, y) => Number(!!x.a?.correct) - Number(!!y.a?.correct));
  }, [s, filter]);

  const wrongCount = s ? Object.values(s.answers).filter((a) => !a.correct).length : 0;
  const flagCount = s ? Object.values(s.answers).filter((a) => a.flagged).length : 0;

  if (!s) {
    return (
      <Screen>
        <Header title="Review" back />
        <Card flat style={{ alignItems: 'center', gap: S.md }}>
          <Small>This session has ended. Start a new one to review answers.</Small>
          <Btn title="Practice now" sm onPress={() => router.replace('/session/setup')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Review" sub={s.label} back onBack={() => router.replace('/(tabs)/practice')} />

      <Row gap={S.sm}>
        <Pill tone={filter === 'all' ? 'teal' : 'grey'} onPress={() => setFilter('all')}>
          All · {s.mcqs.length}
        </Pill>
        <Pill tone={filter === 'wrong' ? 'red' : 'grey'} onPress={() => setFilter('wrong')}>
          Wrong · {wrongCount}
        </Pill>
        <Pill tone={filter === 'flagged' ? 'orange' : 'grey'} onPress={() => setFilter('flagged')}>
          Flagged · {flagCount}
        </Pill>
      </Row>

      <Spacer h={S.md} />
      {rows.length === 0 ? (
        <Card flat style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 30 }}>🎉</Text>
          <Body style={{ marginTop: 6, textAlign: 'center' }}>
            {filter === 'wrong' ? 'Koi ghalti nahi — sab sahi!' : 'Nothing flagged in this session.'}
          </Body>
        </Card>
      ) : (
        <View style={{ gap: S.sm }}>
          {rows.map(({ mcq, a }) => {
            const isOpen = open === mcq.id;
            const wrong = a && !a.correct;
            return (
              <Card
                key={mcq.id}
                flat
                style={{ borderLeftWidth: 4, borderLeftColor: wrong ? C.red : C.green, opacity: wrong ? 1 : 0.8 }}
                onPress={() => setOpen(isOpen ? null : mcq.id)}
              >
                <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{mcq.q}</Text>
                <Row gap={S.sm} style={{ marginTop: S.sm, flexWrap: 'wrap' }}>
                  {a?.chosen != null ? (
                    <Pill tone={wrong ? 'red' : 'green'}>You: {String.fromCharCode(65 + a.chosen)}</Pill>
                  ) : (
                    <Pill tone="grey">Not answered</Pill>
                  )}
                  <Pill tone="green">Correct: {String.fromCharCode(65 + mcq.answer)}</Pill>
                  {a?.confidence != null ? (
                    <Pill tone="orange">{['Tukka 🎲', 'Thora sure', 'Pakka ✓'][a.confidence]}</Pill>
                  ) : null}
                </Row>
                {isOpen ? (
                  <>
                    <Spacer h={S.sm} />
                    <Label style={{ color: C.teal }}>Why</Label>
                    <Body style={{ fontSize: 13.5, marginTop: 2 }}>{mcq.explanation}</Body>
                    <Spacer h={S.sm} />
                    <Row gap={S.sm}>
                      <Btn title="Ask AI" variant="line" sm onPress={() => router.push(`/tutor/chat?q=${encodeURIComponent(mcq.q)}`)} />
                      <Btn title="Read chapter" variant="ghost" sm onPress={() => router.push(`/learn/reader/${mcq.chapterId}`)} />
                    </Row>
                  </>
                ) : (
                  <Small style={{ marginTop: 6 }}>Tap to see the explanation</Small>
                )}
              </Card>
            );
          })}
        </View>
      )}
      <Spacer h={S.lg} />
      <Btn
        title="Done"
        onPress={() => {
          session.clear();
          router.replace('/(tabs)/practice');
        }}
      />
    </Screen>
  );
}
