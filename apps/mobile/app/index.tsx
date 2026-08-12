import { useEffect } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store/app';
import { useAuth } from '../src/store/auth';
import { C, F, S } from '../src/theme';
import { Label } from '../src/components/ui';

/**
 * Splash + route gate. Decides where a returning student lands:
 * no account → welcome · account but no setup → onboarding · otherwise → app.
 *
 * Waits for both stores. `hydrated` is the local study cache; `loading` is the
 * stored Supabase session being read back off the device. Routing on either one
 * alone would bounce a signed-in student through the welcome screen for a frame
 * on every cold start.
 */
export default function Splash() {
  const { state, hydrated } = useApp();
  const { loading } = useAuth();

  useEffect(() => {
    if (!hydrated || loading) return;
    const to = !state.user
      ? '/welcome'
      : !state.onboarding?.subjects?.length
        ? '/onboarding/class'
        : '/(tabs)';
    // Long enough to register the brand, short enough not to read as delay.
    // Was 550ms on top of hydration, and the whole cold start read as slow.
    const t = setTimeout(() => router.replace(to), 300);
    return () => clearTimeout(t);
  }, [hydrated, loading, state.user, state.onboarding]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', gap: S.lg }}>
      <Image
        source={require('../assets/monogram.png')}
        style={{ width: 180, height: 140 }}
        resizeMode="contain"
      />
      <Image
        source={require('../assets/wordmark.png')}
        style={{ width: 210, height: 40 }}
        resizeMode="contain"
      />
      <Label style={{ marginTop: S.sm, fontFamily: F.bodyBold }}>Your 9th &amp; 10th study mate</Label>
    </View>
  );
}
