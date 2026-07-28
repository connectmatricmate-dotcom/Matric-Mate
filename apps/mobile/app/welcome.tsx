import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Body, H1, Screen, Tap } from '../src/components/ui';
import { C, F, S } from '../src/theme';

const SLIDES = [
  {
    emoji: '📚',
    h: 'Poori tayyari, one app',
    s: 'Chapter-wise notes, audio lessons and examples for FBISE Class 9 — English aur Urdu medium.',
  },
  {
    emoji: '🎯',
    h: 'Practice till it sticks',
    s: 'MCQs, flashcards, fill-in-the-blanks, past papers and timed exams — with instant explanations.',
  },
  {
    emoji: '✨',
    h: 'Your 24/7 AI tutor',
    s: 'Stuck at 1 AM? Ask a doubt and get step-by-step help, in English or Urdu.',
  },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <Screen
      scroll={false}
      footer={
        <View style={{ gap: S.sm }}>
          {last ? (
            <Btn title="Get started" variant="orange" onPress={() => router.push('/onboarding/class')} />
          ) : (
            <Btn title="Next" onPress={() => setI(i + 1)} />
          )}
          <Btn title="I already have an account" variant="ghost" onPress={() => router.push('/login')} />
        </View>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: S.lg }}>
        <Image
          source={require('../assets/wordmark.png')}
          style={{ width: 150, height: 30, alignSelf: 'center', marginTop: S.md }}
          resizeMode="contain"
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md }}>
          <Text style={{ fontSize: 84 }}>{slide.emoji}</Text>
          <H1 style={{ textAlign: 'center', fontSize: 25 }}>{slide.h}</H1>
          <Body style={{ textAlign: 'center', color: C.ink2, maxWidth: 340 }}>{slide.s}</Body>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: S.sm }}>
            {SLIDES.map((_, n) => (
              <Tap key={n} onPress={() => setI(n)}>
                <View
                  style={{
                    width: n === i ? 22 : 8,
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: n === i ? C.orange : '#DDE6E1',
                  }}
                />
              </Tap>
            ))}
          </View>
        </View>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.ink3, textAlign: 'center' }}>
          Demo build · sample content
        </Text>
      </View>
    </Screen>
  );
}
