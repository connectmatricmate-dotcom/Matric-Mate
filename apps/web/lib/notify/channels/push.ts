import 'server-only';
import { createHash, createPrivateKey, createSign } from 'node:crypto';
import { translate } from '@matricmate/core';
import { SITE_URL } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRetry } from '../jobs';
import { webPath, type ChannelAdapter } from '../types';

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
const privateKey = () =>
  (process.env.FIREBASE_PRIVATE_KEY ?? '')
    .trim()
    // Pasted with the quotes from the JSON file still around it.
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n');

const b64 = (v: string | object) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/**
 * Google's access tokens last an hour, so one is kept rather than minting a
 * fresh one per notification. The nightly job sends in a loop and would
 * otherwise do a round trip to Google before every single message.
 */
let cached: { token: string; expires: number } | null = null;

/** Why the last attempt to get an access token failed, for the health check. */
let lastTokenError: string | null = null;

async function accessToken(): Promise<string | null> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  lastTokenError = null;

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
    lastTokenError = `sign: ${e instanceof Error ? e.message : String(e)}`;
    console.error('notify/push: could not sign with FIREBASE_PRIVATE_KEY', lastTokenError);
    return null;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) {
    lastTokenError = `exchange ${res.status}: ${(await res.text()).slice(0, 200)}`;
    console.error('notify/push: token exchange refused', lastTokenError);
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
    const { data: devices, error } = await withRetry((signal) =>
      admin.from('push_tokens').select('token,platform').eq('user_id', to.userId).abortSignal(signal),
    );
    if (error) {
      console.error('notify/push: device read failed', error.message);
      return 'failed';
    }

    // Nobody installed the app, or nobody granted permission. Not a failure:
    // it is the normal state for a student who only uses the website.
    if (!devices?.length) return 'skipped';

    const token = await accessToken();
    if (!token) return 'failed';

    const title = translate(to.lang, notice.title, notice.params);
    const body = translate(to.lang, notice.body, notice.params);
    const url = `https://fcm.googleapis.com/v1/projects/${projectId()}/messages:send`;
    const target = notice.target ?? 'home';
    // A chapter travels as its own field, so an app that predates chapter
    // targets reads an unknown destination and simply opens normally.
    const chapter = target === 'chapter' && notice.chapterId ? { chapter: notice.chapterId } : {};

    const results = await Promise.all(
      (devices as { token: string; platform: string }[]).map(async ({ token: device, platform }) => {
        try {
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
                data: { target, kind: notice.kind, ...chapter },
                // The channel the app creates before it registers, so every
                // push wears the same name and importance in Settings.
                ...(platform === 'android' ? { android: { notification: { channel_id: 'default' } } } : {}),
                /*
                 * In a browser the Firebase worker shows a message that has a
                 * notification block by itself, and opens this link when it
                 * is tapped. The worker used to show its own copy as well, so
                 * every web push arrived twice and one of the two did nothing
                 * on tap. See app/firebase-messaging-sw.js.
                 */
                // FCM refuses a link that is not https, so a laptop's
                // localhost build sends the notification without one.
                ...(platform === 'web'
                  ? {
                      webpush: {
                        notification: { icon: `${SITE_URL}/icon.png`, tag: notice.kind },
                        ...(SITE_URL.startsWith('https://')
                          ? { fcm_options: { link: new URL(webPath(target, notice.chapterId), SITE_URL).toString() } }
                          : {}),
                      },
                    }
                  : {}),
              },
            }),
          });
          if (res.ok) return 'sent' as const;

          /*
           * Deleted only when Firebase says the TOKEN is the problem: 404
           * UNREGISTERED (the app was uninstalled, or the token rotated and
           * nobody told us), or a 400 that names the registration token.
           * Deleting on any 400 also threw away good devices whenever the
           * message itself was malformed, which is our bug, not theirs.
           * Without this pruning a dead device is retried nightly forever.
           */
          const text = await res.text();
          let code = '';
          let message = '';
          try {
            const parsed = JSON.parse(text) as { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } };
            message = parsed.error?.message ?? '';
            code = parsed.error?.details?.find((d) => d.errorCode)?.errorCode ?? parsed.error?.status ?? '';
          } catch {
            // Not JSON: logged below as it came.
          }
          const deadToken = res.status === 404 || code === 'UNREGISTERED' || (res.status === 400 && /registration token/i.test(message));
          if (deadToken) {
            const { error: pruneError } = await admin.from('push_tokens').delete().eq('token', device);
            if (pruneError) console.error('notify/push: could not prune a dead device', pruneError.message);
            return 'dead' as const;
          }
          console.error('notify/push: send refused', res.status, text.slice(0, 160));
          return 'failed' as const;
        } catch (e) {
          // One device's network failure must not lose the others.
          console.error('notify/push: send failed', e instanceof Error ? e.message : e);
          return 'failed' as const;
        }
      }),
    );

    // One live device is a delivered notification. All of them dead is the
    // same as having none, which is a skip rather than a failure. Anything
    // else is a real failure and is reported as one: the jobs count these, and
    // a push that could not go out must not read as a student without a phone.
    if (results.includes('sent')) return 'sent';
    return results.includes('failed') ? 'failed' : 'skipped';
  },
};

const fingerprint = (v: string) => (v ? createHash('sha256').update(v).digest('hex').slice(0, 10) : null);

/**
 * What stands between this deployment and a delivered push, step by step.
 *
 * `configured` only says the three variables exist, and for a month that was
 * all anyone could see: every scheduled push failed at the login to Google
 * while the in-app copy was written as normal, so nothing looked wrong. This
 * walks the same path a real send takes and reports where it stops.
 *
 * Nothing secret leaves: the key is described by its shape, the project and
 * the service account by a short hash to compare against a known-good copy.
 * Each registered device is checked with `validate_only`, so Firebase judges
 * the request and delivers nothing.
 */
export async function diagnosePush(): Promise<Record<string, unknown>> {
  const raw = process.env.FIREBASE_PRIVATE_KEY ?? '';
  let parses = false;
  try {
    createPrivateKey(privateKey());
    parses = true;
  } catch {
    // Reported as parses: false.
  }
  const report: Record<string, unknown> = {
    projectId: fingerprint(projectId()),
    clientEmail: fingerprint(clientEmail()),
    key: {
      length: raw.length,
      quoted: /^\s*["']/.test(raw),
      escapedNewlines: raw.includes('\\n'),
      realNewlines: raw.includes('\n'),
      pkcs8Header: raw.includes('BEGIN PRIVATE KEY'),
      parses,
    },
  };

  cached = null;
  const token = await accessToken();
  report.login = token ? 'ok' : lastTokenError;
  if (!token) return report;

  const admin = createAdminClient();
  const { data: devices } = await admin.from('push_tokens').select('token');
  const verdicts: Record<string, number> = {};
  for (const { token: device } of (devices ?? []) as { token: string }[]) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId()}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ validate_only: true, message: { token: device, notification: { title: 'check', body: 'check' } } }),
    });
    const key = res.ok ? 'valid' : `${res.status} ${((await res.text()).match(/"status":\s*"([A-Z_]+)"/) ?? [])[1] ?? ''}`.trim();
    verdicts[key] = (verdicts[key] ?? 0) + 1;
  }
  report.devices = verdicts;
  return report;
}
