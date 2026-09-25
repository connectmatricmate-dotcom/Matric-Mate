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
  | 'subscription'
  | 'chapter';

/**
 * Where each destination is on the website. The service worker opens these
 * and web push links to them, from this one copy. The Android app has its own
 * route names for the same destinations.
 */
export const WEB_PATHS: Record<NotificationTarget, string> = {
  home: '/dashboard',
  study: '/study',
  practice: '/practice',
  progress: '/progress',
  'session-setup': '/session/setup',
  report: '/insights/report',
  payments: '/account/payments',
  subscription: '/account/subscription',
  // Only the fallback: a chapter target carries its id, see webPath.
  chapter: '/study',
};

/** The website path a notice opens, including the chapter a `chapter` target names. */
export const webPath = (target: NotificationTarget, chapterId?: string): string =>
  target === 'chapter' && chapterId ? `/learn/chapter/${encodeURIComponent(chapterId)}` : WEB_PATHS[target];

/** The target as the notifications column and the push payload store it. */
export const storedTarget = (notice: Pick<Notice, 'target' | 'chapterId'>): string | null =>
  notice.target === 'chapter' ? (notice.chapterId ? `chapter:${notice.chapterId}` : 'study') : (notice.target ?? null);

export type Channel = 'inbox' | 'push' | 'email';

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
  /** The chapter a `chapter` target opens. */
  chapterId?: string;
  /**
   * Channels BEYOND the two every notice gets.
   *
   * Inbox and push are not listed because they are not a choice: anything
   * worth putting in the app's notification screen is worth the student's
   * phone telling them about, and the two lists drifting apart is precisely
   * the bug this shape prevents. They were spelled out on all ten notices and
   * happened to agree; nothing stopped the eleventh from being inbox only.
   *
   * Email is the one real decision. A payment receipt belongs in an inbox a
   * student can search next year; a streak nudge does not, because four of
   * those a week is how an address stops being read.
   *
   * The student's own preferences narrow all of this afterwards, in the
   * adapters.
   */
  also?: Exclude<Channel, 'inbox' | 'push'>[];
  /**
   * Email and nothing else: no inbox row, no push.
   *
   * For the late follow-ups to an account that has stopped (14 and 30 days
   * after a plan ended). A phone that buzzes about the same thing a fifth time
   * teaches its owner to turn notifications off, and then the one that matters
   * never arrives. An email two weeks later is a reminder; a push is nagging.
   */
  emailOnly?: boolean;
  /**
   * The email's own wording and button, when it needs more than the inbox
   * line. The inbox and the push notification are shown by the app, which may
   * name the website in plain words but never link to it or show a price
   * (core/billing.ts); an email is outside the app and can carry both, with a
   * button that signs the student in on the plans page (lib/signin-link.ts).
   * Interpolated with `params` too. A blank line in the body starts a new
   * paragraph.
   */
  email?: {
    body?: StringKey;
    action?: { label: StringKey; href: string };
    /** A small line under the button. */
    note?: StringKey;
    /** The plans on sale and what they cost, under the body (lib/plans.ts). */
    plans?: boolean;
  };
};

/** Everything a channel needs to know about who it is writing to. */
export type Recipient = {
  userId: string;
  lang: Language;
  email: string | null;
  prefs: {
    channelPush: boolean;
    channelEmail: boolean;
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
