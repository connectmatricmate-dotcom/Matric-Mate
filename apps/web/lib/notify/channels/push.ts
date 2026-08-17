import 'server-only';
import { translate } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ChannelAdapter } from '../types';

/**
 * Firebase Cloud Messaging, to the Android app and to the browser.
 *
 * Free and unlimited, which makes it the right home for the routine messages
 * that would be absurd to pay for: streaks, today's plan, a new report card.
 * It is never the only channel for anything that matters, because it reaches
 * only the students who installed the app and allowed notifications, and a
 * renewal reminder cannot depend on that.
 *
 * Sending is the HTTP v1 API, which wants a short-lived OAuth token signed
 * with the service account key rather than the old server key. The signing is
 * the part still missing: everything up to it is here, so switching this on is
 * adding three environment variables, not writing a channel.
 *
 * Needs from the client, all free:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY     (from the service account JSON)
 */

const projectId = () => process.env.FIREBASE_PROJECT_ID ?? '';
const clientEmail = () => process.env.FIREBASE_CLIENT_EMAIL ?? '';
const privateKey = () => process.env.FIREBASE_PRIVATE_KEY ?? '';

export const push: ChannelAdapter = {
  name: 'push',
  configured: () => Boolean(projectId() && clientEmail() && privateKey()),

  send: async (to, notice) => {
    if (!push.configured()) return 'unconfigured';
    if (!to.prefs.channelPush) return 'skipped';

    const admin = createAdminClient();
    const { data: devices } = await admin
      .from('push_tokens')
      .select('token,platform')
      .eq('user_id', to.userId);

    // Nobody has installed the app, or nobody granted permission. Not a
    // failure: it is the normal state for a student who only uses the website.
    if (!devices?.length) return 'skipped';

    const message = {
      title: translate(to.lang, notice.title, notice.params),
      body: translate(to.lang, notice.body, notice.params),
      // The apps route on a destination name, not a URL, because the two spell
      // the same screen differently. See NotificationTarget in core.
      data: { target: notice.target ?? 'home', kind: notice.kind },
    };

    void message;
    /*
     * Deliberately not implemented rather than faked.
     *
     * Returning 'sent' here without a request having left the building is the
     * exact class of bug this whole sweep has been unpicking: a thing that
     * reports success while doing nothing. It stays honest until the key
     * exists, and the dispatcher records it as unconfigured.
     */
    return 'unconfigured';
  },
};
