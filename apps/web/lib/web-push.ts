'use client';

import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { createClient } from '@/lib/supabase/client';

/**
 * Registering this browser to receive push.
 *
 * The Android half of this has worked since the APK; this is the same idea
 * where the device is a browser. It obtains an FCM registration token, which
 * is the same kind of token the server already sends to, so nothing on the
 * sending side changes: one row in push_tokens, platform 'web'.
 *
 * Permission is never requested on page load. Chrome allows it, and it is the
 * single most disliked pattern on the web: a prompt before the visitor knows
 * what the site is gets denied, and a denial is permanent short of digging
 * through site settings. So this registers silently when permission has
 * already been granted, and asks only from an explicit control in settings.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

/** Configured, in a browser, and a browser that can actually do this. */
export async function pushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!config.projectId || !VAPID) return false;
  // Safari on iOS only supports this for a site added to the home screen, and
  // isSupported() is what knows the current rules rather than a UA guess.
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** 'granted' | 'denied' | 'default', or null where push is unavailable. */
export async function pushPermission(): Promise<NotificationPermission | null> {
  return (await pushSupported()) ? Notification.permission : null;
}

/**
 * Get a token for this browser and store it against the student.
 *
 * `ask` false is the silent path used on load: it does nothing unless the
 * student has already granted permission. `ask` true is the settings control.
 *
 * Who it registers is not a parameter: the database takes the caller from the
 * session, which is the only account it could honestly belong to.
 */
export async function registerWebPush(ask = false): Promise<'registered' | 'denied' | 'unsupported' | 'skipped'> {
  if (!(await pushSupported())) return 'unsupported';

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') {
    if (!ask) return 'skipped';
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  }

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    // Served by a route so the config comes from env; see the sibling
    // app/firebase-messaging-sw.js/route.ts for why it is not a static file.
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: registration });
    if (!token) return 'skipped';

    /*
     * claim_push_token, not an upsert on the table.
     *
     * A shared browser is the same problem as a shared phone: the FCM token
     * belongs to the browser profile, so the second account to sign in here
     * tries to write a row the first one owns, and row level security refuses
     * it (42501). The result was a silent one, which is how it went unnoticed
     * on Android for a fortnight. See migration 0025.
     */
    const { error } = await createClient().rpc('claim_push_token', { p_token: token, p_platform: 'web' });
    if (error) return 'skipped';

    /*
     * A message arriving while the tab is focused is NOT shown as a system
     * notification: the browser suppresses it, and drawing our own on top of a
     * page the student is already looking at is noise. The inbox updates
     * itself over the realtime channel, so the count moves on its own.
     */
    onMessage(getMessaging(app), () => {});

    return 'registered';
  } catch {
    // A blocked service worker, a private window, an extension in the way.
    // None of it is worth an error message on a page about something else.
    return 'unsupported';
  }
}

/**
 * Hand this browser back before signing out.
 *
 * Called while the session is still valid, because the function is scoped to
 * the caller. A shared laptop is the same problem as a shared phone: without
 * this, the next student to sign in here would keep receiving the last one's
 * notifications. Never throws, and never blocks a sign-out.
 */
export async function releaseWebPush(): Promise<void> {
  try {
    if (!(await pushSupported()) || Notification.permission !== 'granted') return;
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) return;
    const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: registration });
    if (!token) return;
    await createClient().rpc('release_push_token', { p_token: token });
  } catch {
    // Nothing about notifications may stand between a student and signing out.
  }
}
