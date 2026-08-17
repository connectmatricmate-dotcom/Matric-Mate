import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import type { NotificationTarget } from '@matricmate/core';
import { supabase } from '../lib/supabase';

/**
 * Registering this phone to receive push, and routing a tap on one.
 *
 * The permission prompt is the part worth being careful about. Android 13 and
 * later require an explicit runtime request, and a student only ever gets asked
 * once: refuse it and the system silently denies every later request, with no
 * dialog and no way back except Settings. So it is asked at a moment that makes
 * sense rather than the instant the app opens on a cold install.
 *
 * It is also re-checked on every launch, not once ever. Someone who declined
 * before an update, or who turned notifications off in Settings and later back
 * on, has to be able to end up registered without reinstalling. Asking again
 * when the system has already made the decision is free: it returns the
 * existing answer without showing anything.
 */

/** Shared destinations, in this app's route names. Mirrors app/notifications.tsx. */
const ROUTE: Record<NotificationTarget, string> = {
  home: '/(tabs)',
  study: '/(tabs)/study',
  practice: '/(tabs)/practice',
  progress: '/(tabs)/progress',
  'session-setup': '/session/setup',
  report: '/insights/report',
  payments: '/account/payments',
  subscription: '/account/subscription',
};

/**
 * A notification arriving while the app is open should still be seen. Without
 * this the system swallows it on the assumption that a foreground app has
 * already told the user itself, which is not true here: the message may be
 * about a screen they are not looking at.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function register(userId: string): Promise<void> {
  // An emulator has no push service to register with, and asking throws.
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    /*
     * Android needs a channel before anything can be delivered, and one is
     * created whether or not permission is granted: the channel is what gives
     * the notification its colour and importance, and if the student allows
     * notifications later it has to already exist.
     */
    await Notifications.setNotificationChannelAsync('default', {
      name: 'MatricMate',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#0A7EA4',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    /*
     * Ask only when asking would actually show something.
     *
     * `canAskAgain` goes false once the student has declined, and from then on
     * requesting is a silent no-op that returns the same refusal. Checking it
     * rather than calling anyway is the difference between "ask on the first
     * open, and after an update if they were never asked" and "pester on every
     * launch forever". The second is how apps get their notifications turned
     * off in Settings and never turned back on.
     */
    if (!existing.canAskAgain) return;
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;

  const token = (await Notifications.getDevicePushTokenAsync()).data;
  if (typeof token !== 'string' || !token) return;

  /*
   * Upsert, because the same device keeps its token across launches and we
   * want last_seen_at moved forward rather than a duplicate row. That column
   * is the only way to tell a live device from one that was uninstalled
   * months ago, since Firebase never tells us either way.
   */
  await supabase.from('push_tokens').upsert(
    { token, user_id: userId, platform: 'android', last_seen_at: new Date().toISOString() },
    { onConflict: 'token' },
  );
}

export function usePush(userId: string | null) {
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Once per signed-in user per launch. Re-running on every render would
    // hammer both the permission API and the table.
    if (registeredFor.current === userId) return;
    registeredFor.current = userId;

    // Never allowed to break startup: a phone with no Play Services, or a
    // blocked network, must still get an app.
    void register(userId).catch(() => {});
  }, [userId]);

  /** A tap on a notification opens the screen it is about. */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = response.notification.request.content.data?.target;
      const route = typeof target === 'string' ? ROUTE[target as NotificationTarget] : undefined;
      if (route) router.push(route as never);
    });
    return () => sub.remove();
  }, []);
}
