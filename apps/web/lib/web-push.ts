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
 */
export async function registerWebPush(userId: string, ask = false): Promise<'registered' | 'denied' | 'unsupported' | 'skipped'> {
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
     * Upsert on the token, so reopening the tab moves last_seen_at forward
     * rather than adding a row. That column is the only way to tell a live
     * browser from one somebody used once in March: Firebase never says.
     */
    await createClient()
      .from('push_tokens')
      .upsert({ token, user_id: userId, platform: 'web', last_seen_at: new Date().toISOString() }, { onConflict: 'token' });

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
