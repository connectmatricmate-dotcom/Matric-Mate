import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
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

/**
 * Claims this phone's push token for the signed-in student, asking the OS for
 * permission first when `ask` is set and asking could show a dialog. Resolves
 * true once the token is claimed, false when push cannot arrive here.
 */
async function register(userId: string, ask = true): Promise<boolean> {
  // An emulator has no push service to register with, and asking throws.
  if (!Device.isDevice) return false;

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
    if (!ask || !existing.canAskAgain) return false;
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return false;

  const token = (await Notifications.getDevicePushTokenAsync()).data;
  if (typeof token !== 'string' || !token) return false;

  /*
   * claim_push_token, not an upsert.
   *
   * The token belongs to the phone and survives signing out, so the second
   * student to use a phone tries to write the row the first one owns. Row
   * level security refuses that, correctly, and an upsert therefore failed
   * with 42501 while the app looked away: the new account got no push at all
   * and the old account's notifications kept arriving on a phone they had
   * signed out of. See migration 0025. The function does the handover in one
   * privileged step and can only ever write the caller's own id.
   */
  const { error } = await supabase.rpc('claim_push_token', { p_token: token, p_platform: 'android' });
  // Worth a line in the log rather than another silent failure: without a row
  // here the student is simply never pushed to, and nothing else would say so.
  if (error) console.warn('push: could not claim this device', error.message);
  return !error;
}

/**
 * Hand this phone back before signing out.
 *
 * Called while the session is still valid, because the function is scoped to
 * the caller. Skipping it would leave the phone addressed to an account
 * nobody is signed in to any more.
 */
export async function releasePushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    const token = (await Notifications.getDevicePushTokenAsync()).data;
    if (typeof token !== 'string' || !token) return;
    await supabase.rpc('release_push_token', { p_token: token });
  } catch {
    // Signing out must not be blocked by anything to do with notifications.
  }
}

/**
 * The response that opened the app, once, as a route.
 *
 * A tap on a notification while the app is closed does not arrive as an event
 * anyone is listening for yet, which is why expo keeps the last one and
 * documents this as the way to read it. The app only had the listener, and
 * even when that did fire, the splash was already holding a timer to replace
 * whatever was on screen with the dashboard 300ms after hydration: two
 * navigations racing, and the notification's the one that lost.
 *
 * So the splash asks for it and decides once. Cleared on read, or every cold
 * start from now until the student taps another one would reopen the same
 * screen. The id is kept so the live listener below can tell that this
 * response has already been dealt with.
 */
let consumedResponseId: string | null = null;

export function takePendingNotificationRoute(): string | null {
  try {
    const response = Notifications.getLastNotificationResponse();
    if (!response) return null;
    consumedResponseId = response.notification.request.identifier;
    Notifications.clearLastNotificationResponse();
    const target = response.notification.request.content.data?.target;
    return (typeof target === 'string' ? ROUTE[target as NotificationTarget] : undefined) ?? null;
  } catch {
    // An older binary without the API, or no notification at all. Launching
    // normally is the right answer either way.
    return null;
  }
}

export function usePush(userId: string | null) {
  const registeredFor = useRef<string | null>(null);
  /** Whether this launch has actually claimed the token for `registeredFor`. */
  const claimed = useRef(false);

  useEffect(() => {
    if (!userId) {
      // Signed out. Sign-out handed this phone's row back (releasePushToken),
      // so the next sign-in has to claim it again, even as the same student.
      // Remembering who registered last skipped exactly that, and a student
      // who signed out and back in got no push until the app was restarted.
      registeredFor.current = null;
      claimed.current = false;
      return;
    }
    // Once per signed-in user per launch. Re-running on every render would
    // hammer both the permission API and the table.
    if (registeredFor.current === userId) return;
    registeredFor.current = userId;
    claimed.current = false;

    // Never allowed to break startup: a phone with no Play Services, or a
    // blocked network, must still get an app.
    void register(userId)
      .then((ok) => {
        if (registeredFor.current === userId) claimed.current = ok;
      })
      .catch(() => {});
  }, [userId]);

  /**
   * Notifications switched back on in Settings, noticed on the way back.
   *
   * Registration used to be once per launch, so a student who had refused and
   * later allowed notifications in Settings stayed unreachable until the app
   * was killed. Never asks here: returning to the app is not the moment for a
   * dialog, and if permission is still missing this is a silent no-op.
   */
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active' || claimed.current || registeredFor.current !== userId) return;
      void register(userId, false)
        .then((ok) => {
          if (ok && registeredFor.current === userId) claimed.current = true;
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [userId]);

  /** A tap on a notification opens the screen it is about, while the app runs. */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      // The launch tap belongs to the splash, which has already routed for it.
      // Without this the target would be pushed twice on a cold start.
      if (response.notification.request.identifier === consumedResponseId) return;
      const target = response.notification.request.content.data?.target;
      const route = typeof target === 'string' ? ROUTE[target as NotificationTarget] : undefined;
      if (!route) return;
      // A tab is gone back down to, not pushed: over a stacked screen a push
      // put a second set of tabs on top of it (see app/notifications.tsx).
      if (route.startsWith('/(tabs)')) router.dismissTo(route as never);
      else router.push(route as never);
    });
    return () => sub.remove();
  }, []);
}

/** Whether the system lets this app notify. 'unavailable': an emulator, or no push service. */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

type PermissionRead = { status: PushPermission | null; canAskAgain: boolean };

/**
 * Whether push can actually reach this phone, for the screen that offers it.
 *
 * The account's push switch read "On this phone" after the system permission
 * had been refused, which is a promise nothing can keep: register() stops
 * quietly at the refusal and no notification ever arrives. This is the
 * phone's half of the answer, read on mount and again on every return to the
 * app, so a change made in Settings shows up. `status` is null until the first
 * read lands.
 *
 * `ask` shows the system dialog when Android still allows one (canAskAgain),
 * claims the token on a yes, and resolves with the new status. Once a student
 * has refused, Android shows nothing more, and the only way back is the app's
 * page in Settings (Linking.openSettings()).
 */
export function usePushPermission(userId: string | null): PermissionRead & { ask: () => Promise<PushPermission> } {
  const [read, setRead] = useState<PermissionRead>({ status: null, canAskAgain: false });

  useEffect(() => {
    let alive = true;
    const check = () =>
      void readPermission().then((next) => {
        if (alive) setRead(next);
      });
    check();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const ask = useCallback(async (): Promise<PushPermission> => {
    try {
      if (userId) await register(userId, true);
      else if (Device.isDevice) await Notifications.requestPermissionsAsync();
    } catch {
      // The status read below says what actually happened.
    }
    const next = await readPermission();
    setRead(next);
    return next.status ?? 'unavailable';
  }, [userId]);

  return { ...read, ask };
}

async function readPermission(): Promise<PermissionRead> {
  try {
    const p = Device.isDevice ? await Notifications.getPermissionsAsync() : null;
    if (!p) return { status: 'unavailable', canAskAgain: false };
    return {
      status: p.status === 'granted' ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined',
      canAskAgain: p.canAskAgain,
    };
  } catch {
    // An older binary without the module: push cannot arrive, so say so.
    return { status: 'unavailable', canAskAgain: false };
  }
}
