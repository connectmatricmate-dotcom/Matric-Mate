import type { Notice } from './types';

/**
 * Every message the product sends, and the channels each one is allowed on.
 *
 * Kept in one file on purpose. The channel list is an editorial decision, not
 * a technical one, and it is the decision most likely to be got wrong quietly:
 * a streak nudge that finds its way into email teaches students to ignore the
 * address we later need for a receipt, and a payment receipt that only reaches
 * a push notification leaves them with no record of what they paid for.
 *
 * The rule of thumb behind the lists below:
 *   · inbox  always, it is free and it is the record inside the app
 *   · push   anything timely, it is free and unlimited
 *   · email  anything worth keeping, and nothing routine
 *   · whatsapp only where reaching the student protects a subscription, since
 *     it is the one channel that costs per message
 */

export const streakAtRisk = (days: number): Notice => ({
  kind: 'streak',
  title: 'notifications.streakTitle',
  body: 'notifications.streakBody',
  params: { n: days },
  target: 'session-setup',
  // Timely and worthless a day later, so push only. Nobody wants this in
  // their inbox, and nobody would pay to send it.
  channels: ['inbox', 'push'],
});

export const nothingStudiedToday = (): Notice => ({
  kind: 'reminder',
  title: 'notifications.reminderTitle',
  body: 'notifications.reminderBody',
  target: 'home',
  channels: ['inbox', 'push'],
});

export const reportReady = (): Notice => ({
  kind: 'report',
  title: 'notifications.reportTitle',
  body: 'notifications.reportBody',
  target: 'report',
  // Email too: a report card is the thing a student shows a parent, and it
  // reads better on a bigger screen than a notification shade.
  channels: ['inbox', 'push', 'email'],
});

export const paymentReceived = (date: string): Notice => ({
  kind: 'payment',
  title: 'notifications.paymentTitle',
  body: 'notifications.paymentBody',
  params: { date },
  target: 'payments',
  // Every channel that will carry it. This is money: the student wants a
  // written record, and it is worth paying to confirm.
  channels: ['inbox', 'push', 'email', 'whatsapp'],
});
