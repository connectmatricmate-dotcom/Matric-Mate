import { useEffect } from 'react';
import { Stack } from 'expo-router';
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
import { ToastHost } from '../src/components/ui';
import { C } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
            <ToastHost>
              <StatusBar style="dark" />
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
            </ToastHost>
          </AppProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
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
