import { useEffect } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store/app';
import { C, F, S } from '../src/theme';
import { Label } from '../src/components/ui';

/**
 * Splash + route gate. Decides where a returning student lands:
 * no account → welcome · account but no setup → onboarding · otherwise → app.
 */
export default function Splash() {
  const { state, hydrated } = useApp();

  useEffect(() => {
    if (!hydrated) return;
    const to = !state.user
      ? '/welcome'
      : !state.onboarding?.subjects?.length
        ? '/onboarding/class'
        : '/(tabs)';
    const t = setTimeout(() => router.replace(to), 550);
    return () => clearTimeout(t);
  }, [hydrated, state.user, state.onboarding]);

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
