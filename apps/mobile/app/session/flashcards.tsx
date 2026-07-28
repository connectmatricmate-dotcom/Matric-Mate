import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bar, Btn, Card, H2, Header, Pill, Row, Screen, Skeleton, Small, Spacer, Tap, Ur } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { useAsync } from '../../src/core/useAsync';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb } from '../../src/theme';

export default function Flashcards() {
  const { chapter } = useLocalSearchParams<{ chapter?: string }>();
  const chapterId = chapter ?? 'phy-3';
  const { state, actions } = useApp();
  const { data: cards, loading } = useAsync(() => api.getFlashcards(chapterId), [chapterId]);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [repeats, setRepeats] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>([]);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(spin, { toValue: flipped ? 1 : 0, duration: 260, useNativeDriver: !isWeb }).start();
  }, [flipped, spin]);

  const card = cards?.[i];
  const done = !!cards && i >= cards.length;

  const frontRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const frontOpacity = spin.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = spin.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

  function mark(isKnown: boolean) {
    if (!card) return;
    actions.markCard(card.id, isKnown);
    if (isKnown) setKnown((k) => [...k, card.id]);
    else setRepeats((r) => [...r, card.id]);
    setFlipped(false);
    spin.setValue(0);
    setI(i + 1);
  }

  const total = cards?.length ?? 0;

  if (loading) {
    return (
      <Screen>
        <Header title="Flashcards" back />
        <Skeleton h={320} style={{ borderRadius: 22 }} />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <Header title="Flashcards" sub="Session complete" back onBack={() => router.back()} />
        <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <Text style={{ fontSize: 40 }}>🎉</Text>
          <H2>{known.length} yaad, {repeats.length} repeat</H2>
          <Small style={{ textAlign: 'center' }}>
            Repeats come back first next time — that’s how spaced repetition keeps them stuck.
          </Small>
        </Card>
        <Spacer h={S.lg} />
        {repeats.length ? (
          <Btn
            title={`Review ${repeats.length} repeats`}
            onPress={() => {
              setI(0);
              setRepeats([]);
              setKnown([]);
            }}
          />
        ) : null}
        <Spacer h={S.sm} />
        <Btn title="Back to chapter" variant="line" onPress={() => router.replace(`/learn/chapter/${chapterId}`)} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Row gap={S.sm}>
          <View style={{ flex: 1 }}>
            <Btn title="Repeat 🔁" variant="line" onPress={() => mark(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title="Yaad hai ✓" variant="green" onPress={() => mark(true)} />
          </View>
        </Row>
      }
    >
      <Header title="Flashcards" sub={`Card ${i + 1} of ${total}`} back />
      <Bar pct={(i / Math.max(1, total)) * 100} tone="teal" />
      <Spacer h={S.lg} />

      <Tap onPress={() => setFlipped((f) => !f)}>
        <View style={{ height: 320 }}>
          <Animated.View
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              opacity: frontOpacity,
              transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
              backgroundColor: C.card,
              borderWidth: 1.5,
              borderColor: C.line,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              gap: S.md,
            }}
          >
            <Text style={{ fontFamily: F.bodyBold, fontSize: 11, letterSpacing: 0.8, color: C.ink2 }}>TERM</Text>
            <H2 style={{ fontSize: 23, textAlign: 'center' }}>{card?.front}</H2>
            <Small>Tap to flip</Small>
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              opacity: backOpacity,
              transform: [{ perspective: 1000 }, { rotateY: backRotate }],
              backgroundColor: C.teal,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              gap: S.md,
            }}
          >
            <Text style={{ fontFamily: F.bodyBold, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.7)' }}>
              DEFINITION
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 16, lineHeight: 26, color: '#fff', textAlign: 'center' }}>
              {card?.back}
            </Text>
            {card?.urduBack ? (
              <Ur size={14} style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
                {card.urduBack}
              </Ur>
            ) : null}
          </Animated.View>
        </View>
      </Tap>

      <Spacer h={S.md} />
      <Row gap={S.sm} style={{ justifyContent: 'center' }}>
        <Pill tone="green">{known.length} yaad</Pill>
        <Pill tone="orange">{repeats.length} repeat</Pill>
        <Pill tone="grey">{state.cardsKnown.length} known overall</Pill>
      </Row>
    </Screen>
  );
}
