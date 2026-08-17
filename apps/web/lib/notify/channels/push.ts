import 'server-only';
import { createSign } from 'node:crypto';
import { translate } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ChannelAdapter } from '../types';

/**
 * Firebase Cloud Messaging, to the Android app and to the browser.
 *
 * Free and unlimited, which makes it the right home for the routine messages
 * it would be absurd to pay for: streaks, today's plan, a new report card. It
 * is never the only channel for anything that matters, because it reaches only
 * the students who installed the app and allowed notifications, and a renewal
 * reminder cannot depend on that.
 *
 * Environment: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 *
 * No firebase-admin dependency. That package exists to manage a whole Firebase
 * project; all this needs is a signed JWT swapped for an access token and one
 * POST, which is about thirty lines and no supply chain.
 */

const projectId = () => process.env.FIREBASE_PROJECT_ID ?? '';
const clientEmail = () => process.env.FIREBASE_CLIENT_EMAIL ?? '';

/**
 * The key is a multi-line PEM. Vercel stores the real newlines; a .env file
 * cannot, so it holds them escaped. Accept both rather than depending on which
 * way it was pasted, because the failure is a signature error at send time and
 * nowhere near the paste.
 */
const privateKey = () => (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const b64 = (v: string | object) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/**
 * Google's access tokens last an hour, so one is kept rather than minting a
 * fresh one per notification. The nightly job sends in a loop and would
 * otherwise do a round trip to Google before every single message.
 */
let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail(),
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claim)}`;

  let assertion: string;
  try {
    assertion = `${input}.${createSign('RSA-SHA256').update(input).sign(privateKey()).toString('base64url')}`;
  } catch (e) {
    // Almost always a key whose newlines did not survive being pasted.
    console.error('notify/push: could not sign with FIREBASE_PRIVATE_KEY', e instanceof Error ? e.message : e);
    return null;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) {
    console.error('notify/push: token exchange refused', res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export const push: ChannelAdapter = {
  name: 'push',
  configured: () => Boolean(projectId() && clientEmail() && privateKey()),

  send: async (to, notice) => {
    if (!push.configured()) return 'unconfigured';
    if (!to.prefs.channelPush) return 'skipped';

    const admin = createAdminClient();
    const { data: devices } = await admin.from('push_tokens').select('token').eq('user_id', to.userId);

    // Nobody installed the app, or nobody granted permission. Not a failure:
    // it is the normal state for a student who only uses the website.
    if (!devices?.length) return 'skipped';

    const token = await accessToken();
    if (!token) return 'failed';

    const title = translate(to.lang, notice.title, notice.params);
    const body = translate(to.lang, notice.body, notice.params);
    const url = `https://fcm.googleapis.com/v1/projects/${projectId()}/messages:send`;

    const results = await Promise.all(
      (devices as { token: string }[]).map(async ({ token: device }) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            message: {
              token: device,
              notification: { title, body },
              // A destination name, not a URL: the two apps spell the same
              // screen differently. See NotificationTarget in core. Values
              // must be strings, which FCM enforces.
              data: { target: notice.target ?? 'home', kind: notice.kind },
            },
          }),
        });
        if (res.ok) return true;

        /*
         * 404 UNREGISTERED and 400 for a malformed token both mean the device
         * is gone: the app was uninstalled, or Firebase rotated the token and
         * never told us. Deleting it here is the only pruning this table gets,
         * and without it a dead device is retried nightly forever.
         */
        if (res.status === 404 || res.status === 400) {
          await admin.from('push_tokens').delete().eq('token', device);
        } else {
          console.error('notify/push: send refused', res.status, (await res.text()).slice(0, 160));
        }
        return false;
      }),
    );

    // One live device is a delivered notification. All of them dead is the
    // same as having none, which is a skip rather than a failure.
    if (results.some(Boolean)) return 'sent';
    return results.length ? 'skipped' : 'skipped';
  },
};
