import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LanguageToggle } from '../src/components/LanguageToggle';
import { markWelcomeSeen } from '../src/lib/first-run';
import { Body, Btn, H1, Screen, Tap } from '../src/components/ui';
import { useT } from '../src/i18n';
import type { StringKey } from '../src/i18n';
import { C, S, rowDir } from '../src/theme';

const SLIDES: { emoji: string; title: StringKey; body: StringKey }[] = [
  { emoji: '📚', title: 'welcome.slide1Title', body: 'welcome.slide1Body' },
  { emoji: '🎯', title: 'welcome.slide2Title', body: 'welcome.slide2Body' },
  { emoji: '✨', title: 'welcome.slide3Title', body: 'welcome.slide3Body' },
];

export default function Welcome() {
  const t = useT();
  // Seen once is seen. Marked on the way out rather than on mount, so
  // backgrounding the app mid-carousel still shows the rest of it next time.
  const leave = (to: '/onboarding/class' | '/login') => {
    markWelcomeSeen();
    router.push(to);
  };
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <Screen
      scroll={false}
      footer={
        <View style={{ gap: S.sm }}>
          {last ? (
            <Btn title={t('welcome.getStarted')} variant="orange" onPress={() => leave('/onboarding/class')} />
          ) : (
            <Btn title={t('common.next')} onPress={() => setI(i + 1)} />
          )}
          <Btn title={t('welcome.haveAccount')} variant="ghost" onPress={() => leave('/login')} />
        </View>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: S.lg }}>
        <View style={{ flexDirection: rowDir(), alignItems: 'center', marginTop: S.sm }}>
          <Image
            source={require('../assets/wordmark.png')}
            style={{ width: 132, height: 26 }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }} />
          <LanguageToggle compact />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md }}>
          <Text style={{ fontSize: 80 }}>{slide.emoji}</Text>
          <H1 style={{ textAlign: 'center', fontSize: 25 }}>{t(slide.title)}</H1>
          <Body style={{ textAlign: 'center', color: C.ink2, maxWidth: 340 }}>{t(slide.body)}</Body>

          <View style={{ flexDirection: rowDir(), gap: 6, marginTop: S.sm }}>
            {SLIDES.map((_, n) => (
              <Tap key={n} onPress={() => setI(n)} hit>
                <View
                  style={{
                    width: n === i ? 22 : 8,
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: n === i ? C.orange : C.mute,
                  }}
                />
              </Tap>
            ))}
          </View>
        </View>

      </View>
    </Screen>
  );
}
