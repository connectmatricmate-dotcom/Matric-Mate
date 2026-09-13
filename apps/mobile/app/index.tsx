import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import { hasSeenWelcome } from '../src/lib/first-run';
import { takePendingNotificationRoute } from '../src/core/usePush';
import { useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { useAuth } from '../src/store/auth';
import { C, F, S } from '../src/theme';
import { Label, Wordmark } from '../src/components/ui';
import { resetTo } from '../src/core/nav';

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
 * Waits for all three answers. `accountReady` is the local study cache, read
 * for the account now signed in, `loading` is the stored Supabase session
 * being read back off the device, and `seen` is this flag. Routing on any one
 * alone bounces a signed-in student through the wrong screen for a frame on
 * every cold start.
 */
export default function Splash() {
  const { state, accountReady } = useApp();
  const t = useT();
  const { loading, role, roleReady } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void hasSeenWelcome().then(setSeen);
  }, []);

  useEffect(() => {
    // accountReady, not hydrated: the store is already hydrated for the
    // signed-out login screen, and routing on that sent a returning student
    // whose account had not been read yet into onboarding.
    if (!accountReady || loading || seen === null) return;
    /*
     * A signed-in account also waits for its role. Routing on the 'student'
     * default sent an administrator into "Which class are you in?", because
     * staff have no subjects and the onboarding branch caught them first.
     */
    if (state.user && !roleReady) return;
    const to = !state.user
      ? seen
        ? '/login'
        : '/welcome'
      : role !== 'student'
        ? // Straight to the tabs gate, which shows staff the website signpost.
          // They have no onboarding to do; onboarding builds a study plan.
          '/(tabs)'
        : !state.onboarding?.subjects?.length
          ? '/onboarding/class'
          : '/(tabs)';
    /**
     * A notification that opened the app decides where it opens.
     *
     * The tap used to be handled only by the push listener, which navigated
     * while this timer was still pending, and then this replaced whatever it
     * had opened with the dashboard. Two decisions racing on one launch. Read
     * here instead, so there is one, and pushed on top of the tabs rather than
     * replacing them, so back goes home instead of nowhere.
     */
    const opened = to === '/(tabs)' ? takePendingNotificationRoute() : null;
    // Long enough to register the brand, short enough not to read as delay.
    // Was 550ms on top of hydration, and the whole cold start read as slow.
    const t = setTimeout(() => {
      // History starts here: whatever led to this screen (the welcome
      // carousel, the login form) is not somewhere back should go.
      resetTo(to);
      if (opened) router.push(opened as never);
    }, 300);
    return () => clearTimeout(t);
  }, [accountReady, loading, seen, state.user, state.onboarding, role, roleReady]);

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
