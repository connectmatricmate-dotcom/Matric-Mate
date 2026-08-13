import { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bar, Btn, Card, Empty, ErrorState, H2, Header, Pill, Row, Screen, Skeleton, Small, Spacer, Tap, Ur } from '../../src/components/ui';
import { api, chaptersFor } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb } from '../../src/theme';

export default function Flashcards() {
  const { chapter } = useLocalSearchParams<{ chapter?: string }>();
  const { state, actions } = useApp();
  // Arriving with no chapter param used to mean Physics chapter 3 for
  // everyone. Follow the student instead: the chapter they last studied,
  // else the first chapter of their first subject.
  const chapterId = chapter ?? state.lastChapterId ?? chaptersFor(state.onboarding?.subjects?.[0] ?? 'phy')[0]?.id ?? 'phy-1';
  const t = useT();
  const { data: cards, loading, error, reload } = useAsync(() => api.getFlashcards(chapterId), [chapterId]);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [repeats, setRepeats] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>([]);
  // Null means the full deck. Set to the repeat ids when the student asks to
  // review them: the button used to reset the whole deck from card one.
  const [round, setRound] = useState<string[] | null>(null);
  // Lazy initialiser, so the value is built once. See the note in ui.tsx/Skeleton.
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(spin, { toValue: flipped ? 1 : 0, duration: 260, useNativeDriver: !isWeb }).start();
  }, [flipped, spin]);

  const deck = round ? (cards ?? []).filter((c) => round.includes(c.id)) : (cards ?? []);
  const card = deck[i];
  const done = !!cards && i >= deck.length;

  useEffect(() => {
    if (done) cheer();
  }, [done]);


  // A failed fetch is not an empty chapter, and an empty chapter is not a
  // finished session. Without these two branches, a network error rendered a
  // blank card, and a chapter with none of this practice type opened straight
  // onto the confetti screen claiming "0 of 0, well done".
  if (error && !(cards ?? []).length) {
    return (
      <Screen>
        <Header title={t('study.flashcards')} back />
        <Spacer h={S.lg} />
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      </Screen>
    );
  }
  if (!loading && cards && (cards ?? []).length === 0) {
    return (
      <Screen>
        <Header title={t('study.flashcards')} back />
        <Spacer h={S.lg} />
        <Empty title={t('session.noItemsTitle')} sub={t('session.noItemsBody')} />
      </Screen>
    );
  }

  const total = deck.length;

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

  if (loading) {
    return (
      <Screen>
        <Header title={t('study.flashcards')} back />
        <Skeleton h={320} style={{ borderRadius: 22 }} />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <Confetti />
        <Header title={t('study.flashcards')} back />
        <Pop>
        <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <H2 style={{ textAlign: 'center' }}>{t('session.cardsDone', { known: known.length, repeat: repeats.length })}</H2>
          <Small style={{ textAlign: 'center' }}>{t('session.cardsDoneSub')}</Small>
        </Card>
        </Pop>
        <Spacer h={S.lg} />
        {repeats.length ? (
          <Btn
            title={t('session.reviewRepeats', { n: repeats.length })}
            onPress={() => {
              setRound(repeats);
              setI(0);
              setRepeats([]);
            }}
          />
        ) : null}
        <Spacer h={S.sm} />
        <Btn title={t('session.backToChapter')} variant="line" onPress={() => router.replace(`/learn/chapter/${chapterId}`)} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Row gap={S.sm}>
          <View style={{ flex: 1 }}>
            <Btn title={t('session.repeat')} variant="line" onPress={() => mark(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title={t('session.known')} variant="green" onPress={() => mark(true)} />
          </View>
        </Row>
      }
    >
      <Header title={t('study.flashcards')} sub={t('session.cardOf', { a: i + 1, b: total })} back />
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
            <Text style={{ fontFamily: F.bodyBold, fontSize: 11, letterSpacing: 0.8, color: C.ink2 }}>
              {t('session.cardTerm')}
            </Text>
            <H2 style={{ fontSize: 23, textAlign: 'center' }}>{card?.front}</H2>
            <Small>{t('session.tapToFlip')}</Small>
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
              {t('session.cardDefinition')}
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
        <Pill tone="green">{t('session.knownCount', { n: known.length })}</Pill>
        <Pill tone="orange">{t('session.repeatCount', { n: repeats.length })}</Pill>
      </Row>
    </Screen>
  );
}
