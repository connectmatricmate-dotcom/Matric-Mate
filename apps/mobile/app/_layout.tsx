import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_600SemiBold } from '@expo-google-fonts/noto-nastaliq-urdu';
import { ConnectivityProvider } from '../src/core/connectivity';
import { AuthProvider } from '../src/store/auth';
import { AppProvider, useApp } from '../src/store/app';
import { useQuotaRealtime } from '../src/core/useQuota';
import { usePush } from '../src/core/usePush';
import { Btn, Text, ToastHost } from '../src/components/ui';
import { C, F, isRTL } from '../src/theme';
import { en, ur } from '@matricmate/core';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * The screen a student gets instead of a white one.
 *
 * expo-router renders a layout's exported ErrorBoundary in place of the routes
 * beneath it, and neither layout exported one, so any uncaught render error
 * anywhere in the app left a production build on a blank screen with no
 * message and nothing to press. If the fault was on the screen they land on,
 * reopening did not help either.
 *
 * Deliberately plain, and deliberately not using the app's own hooks: this
 * runs when something in the tree has already failed, and a provider that is
 * part of the failure would take the recovery screen down with it. Retry first,
 * because most of these are transient, and a way home for when it is not.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  /* The language without a hook. isRTL() reads the same module flag the store
     sets on every render, so this speaks the student's language without
     depending on a provider that may be part of what just failed. Exactly the
     trick the web's RouteError uses to read the store outside React. */
  const s = isRTL() ? ur : en;
  return (
    <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
      <Text style={{ fontFamily: F.display, fontSize: 21, lineHeight: isRTL() ? 44 : 28, color: C.ink, textAlign: 'center' }}>
        {s.states.crashTitle}
      </Text>
      <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: isRTL() ? 32 : 22, color: C.ink2, textAlign: 'center' }}>
        {s.states.crashBody}
      </Text>
      <View style={{ height: 8 }} />
      <Btn title={s.common.retry} onPress={() => void retry()} />
      <Btn
        title={s.states.goHome}
        variant="ghost"
        onPress={() => {
          router.replace('/');
          void retry();
        }}
      />
      {/* The message itself, small and last: it is for the person reading a
          bug report, not for the student. */}
      <Text style={{ fontFamily: F.body, fontSize: 11, color: C.ink3, textAlign: 'center' }} numberOfLines={2}>
        {error.message}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
    NotoNastaliqUrdu_400Regular,
    NotoNastaliqUrdu_600SemiBold,
  });

  // A face that fails to load must not hold the app hostage: without the
  // error branch, fontsLoaded stayed false forever and the splash never hid.
  // System fonts are a downgrade; a frozen splash is an outage.
  const ready = fontsLoaded || !!fontError;

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/* Auth sits outside the study store, which reads identity and entitlement from it. */}
      <ConnectivityProvider>
        <AuthProvider>
          <AppProvider>
            <SplashGate />
            <QuotaLive />
            <PushLive />
            <ToastHost>
              <Chrome />
            </ToastHost>
          </AppProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}

/**
 * The navigator and the system bars, as a child of AppProvider rather than a
 * part of RootLayout.
 *
 * Both read the palette, and RootLayout does not subscribe to the store, so
 * from up there they were evaluated once and kept whatever theme was current
 * at launch: switching to dark left a white status bar and a white flash
 * behind every screen transition. Down here the store re-renders them.
 */
function Chrome() {
  const { state } = useApp();
  return (
    <>
      {/* The bar's own text, so it is light on a dark ground and vice versa. */}
      <StatusBar style={state.settings.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.paper },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}

/**
 * Holds the splash until the saved settings are back from storage.
 *
 * The splash used to lift as soon as the fonts were ready, but the language
 * lives in AsyncStorage and arrives a moment later, so an Urdu student saw one
 * frame of a left-to-right English app before it flipped. Waiting for
 * hydration costs a few milliseconds and removes the flash entirely.
 *
 * The timeout is the same reasoning as the font error branch above: if
 * hydration somehow never reports, a slightly wrong first frame is a blemish
 * and a splash that never lifts is an outage.
 */
function SplashGate() {
  const { hydrated } = useApp();
  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const bail = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 2500);
    return () => clearTimeout(bail);
  }, [hydrated]);
  return null;
}

/**
 * Keeps the AI quota current for as long as the app is open.
 *
 * Mounted once, at the root, so every screen's number moves together: a
 * question asked on this student's laptop lands here too, and a charge the
 * app did not make itself still shows up.
 */
function QuotaLive() {
  const { state } = useApp();
  useQuotaRealtime(state.user?.id);
  return null;
}

/**
 * Registers this phone for push and routes a tap on a notification.
 *
 * Mounted inside AppProvider because it needs the signed-in user, and once
 * rather than per screen: the permission prompt and the token write should
 * happen on launch, not every time somebody opens a tab.
 */
function PushLive() {
  const { state } = useApp();
  usePush(state.user?.id ?? null);
  return null;
}
