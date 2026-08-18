import 'server-only';
import type { Language } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { inbox } from './channels/inbox';
import { push } from './channels/push';
import { email } from './channels/email';
import type { Channel, ChannelAdapter, DeliveryResult, Notice, Recipient } from './types';

export type { Notice, Recipient } from './types';
export * from './notices';

/**
 * One way to tell a student something.
 *
 * Before this, every job that had news wrote its own row into the
 * notifications table and that was the end of it: the payment webhook did,
 * the coach job did, the nudge job did, each with its own hardcoded wording
 * and its own idea of what language the student reads. Adding a second
 * channel would have meant editing all three, and a third would mean editing
 * them again.
 *
 * So a caller says what happened and to whom. This decides where it goes,
 * which is a question with four inputs the caller should not have to hold:
 * which channels the notice is even suitable for, which ones the student has
 * left switched on, which ones have credentials, and, for WhatsApp, whether
 * there is recorded consent.
 *
 * Never throws. A notification is a side effect of something more important
 * (a payment settling, a report being written) and must not be able to fail
 * that. Every channel is attempted independently, and the results come back
 * for the caller to log if it wants them.
 */

const ADAPTERS: Record<Channel, ChannelAdapter> = {
  inbox,
  push,
  email,
};

/** Everything the channels need about a student, in one read. */
export async function loadRecipient(userId: string): Promise<Recipient | null> {
  const admin = createAdminClient();

  const [{ data: profile }, { data: auth }] = await Promise.all([
    admin.from('profiles').select('settings,onboarding').eq('id', userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  if (!profile && !auth?.user) return null;

  const settings = ((profile?.settings ?? {}) as Record<string, unknown>) ?? {};
  const medium = (profile?.onboarding as { medium?: string } | null)?.medium;

  return {
    userId,
    lang: (medium === 'ur' ? 'ur' : 'en') as Language,
    email: auth?.user?.email ?? null,
    prefs: {
      // Absent means never set, and both default to on. Only an explicit false
      // is the student saying no.
      channelPush: settings.channelPush !== false,
      channelEmail: settings.channelEmail !== false,
    },
  };
}

export type NotifyReport = Partial<Record<Channel, DeliveryResult>>;

export async function notify(to: Recipient | string, notice: Notice): Promise<NotifyReport> {
  const recipient = typeof to === 'string' ? await loadRecipient(to) : to;
  if (!recipient) return {};

  const report: NotifyReport = {};

  await Promise.all(
    notice.channels.map(async (name) => {
      const adapter = ADAPTERS[name];
      if (!adapter) return;
      try {
        report[name] = await adapter.send(recipient, notice);
      } catch (e) {
        // One channel failing must not take the others down with it, and must
        // never reach the caller: see the note above about side effects.
        console.error(`notify/${name}: threw`, e instanceof Error ? e.message : e);
        report[name] = 'failed';
      }
    }),
  );

  return report;
}

/** Which channels are actually wired up, for a health check or a setup page. */
export function channelStatus(): Record<Channel, boolean> {
  return {
    inbox: inbox.configured(),
    push: push.configured(),
    email: email.configured(),
  };
}
