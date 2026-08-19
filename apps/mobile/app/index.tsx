import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import { hasSeenWelcome } from '../src/lib/first-run';
import { useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { useAuth } from '../src/store/auth';
import { C, F, S } from '../src/theme';
import { Label, Wordmark } from '../src/components/ui';

/**
 * Splash + route gate. Decides where a student lands on opening the app:
 *
 *   never been here      → welcome, the three-slide introduction
 *   signed out, been here → login
 *   signed in, no subjects → onboarding
 *   otherwise              → the app
 *
 * The second line is the one that was missing. Everybody signed out went to
 * the carousel, so signing out pitched the product to somebody who had been
 * using it for a month and made them swipe through it to reach a password
 * field.
 *
 * Waits for all three answers. `hydrated` is the local study cache, `loading`
 * is the stored Supabase session being read back off the device, and `seen` is
 * this flag. Routing on any one alone bounces a signed-in student through the
 * wrong screen for a frame on every cold start.
 */
export default function Splash() {
  const { state, hydrated } = useApp();
  const t = useT();
  const { loading } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void hasSeenWelcome().then(setSeen);
  }, []);

  useEffect(() => {
    if (!hydrated || loading || seen === null) return;
    const to = !state.user
      ? seen
        ? '/login'
        : '/welcome'
      : !state.onboarding?.subjects?.length
        ? '/onboarding/class'
        : '/(tabs)';
    // Long enough to register the brand, short enough not to read as delay.
    // Was 550ms on top of hydration, and the whole cold start read as slow.
    const t = setTimeout(() => router.replace(to), 300);
    return () => clearTimeout(t);
  }, [hydrated, loading, seen, state.user, state.onboarding]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', gap: S.lg }}>
      <Image
        source={require('../assets/monogram.png')}
        style={{ width: 180, height: 140 }}
        resizeMode="contain"
      />
      <Wordmark />
      <Label style={{ marginTop: S.sm, fontFamily: F.bodyBold }}>{t('welcome.tagline')}</Label>
    </View>
  );
}
