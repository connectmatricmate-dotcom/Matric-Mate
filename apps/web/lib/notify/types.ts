import type { Language, StringKey } from '@matricmate/core';

/**
 * One notification, described once and delivered on as many channels as the
 * student has agreed to.
 *
 * The shape exists so that the jobs that raise notifications never think about
 * channels. `notify()` decides where a message goes; a caller only says what
 * happened and to whom. That is what keeps "the streak is at risk" in one
 * place when it needs to reach an inbox, a phone and eventually a WhatsApp
 * thread, each with different limits on what it can carry.
 */

/** Matches the `kind` column on public.notifications. */
export type NotificationKind = 'streak' | 'reminder' | 'report' | 'payment';

/** Where a tap on the notification should land. See NotificationTarget in core. */
export type NotificationTarget =
  | 'home'
  | 'study'
  | 'practice'
  | 'progress'
  | 'session-setup'
  | 'report'
  | 'payments'
  | 'subscription';

export type Channel = 'inbox' | 'push' | 'email' | 'whatsapp';

/**
 * A message before it has been rendered for any particular channel.
 *
 * Title and body are dictionary keys rather than finished strings, so each
 * channel can render them in the student's own language at the moment it
 * sends, and so a channel that needs different wording (an email has room for
 * a paragraph, a push notification does not) can ask for a different key.
 */
export type Notice = {
  kind: NotificationKind;
  title: StringKey;
  body: StringKey;
  /** Interpolated into both title and body. */
  params?: Record<string, string | number>;
  target?: NotificationTarget;
  /**
   * Channels this notice is allowed on, before the student's own preferences
   * narrow it further. A payment receipt belongs in an email; a streak nudge
   * does not, because nobody wants four of those a week in their inbox.
   */
  channels: Channel[];
};

/** Everything a channel needs to know about who it is writing to. */
export type Recipient = {
  userId: string;
  lang: Language;
  email: string | null;
  /** +92 format, or null. A contact detail, never how they sign in. */
  phone: string | null;
  /** When they agreed to WhatsApp. Null means they have not, so we do not. */
  whatsappOptIn: string | null;
  prefs: {
    channelPush: boolean;
    channelEmail: boolean;
    channelWhatsapp: boolean;
  };
};

/**
 * What a channel reports back.
 *
 * `unconfigured` is deliberately distinct from `failed`. A missing API key is
 * an expected state during setup and must not look like an outage in the
 * logs, or the first real failure gets lost in the noise of channels that
 * were never switched on.
 */
export type DeliveryResult = 'sent' | 'skipped' | 'unconfigured' | 'failed';

export type ChannelAdapter = {
  name: Channel;
  /** False when the credentials are absent, so the dispatcher can say so once. */
  configured: () => boolean;
  send: (to: Recipient, notice: Notice) => Promise<DeliveryResult>;
};
