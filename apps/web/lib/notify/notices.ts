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
 * Every notice reaches the in-app inbox and the student's phone. That pair is
 * not configurable per notice, so the notification screen and the phone can
 * never disagree about what happened. See Notice.also.
 *
 * The only decision left here is email, and the rule is: anything worth
 * keeping, nothing routine.
 */

export const streakAtRisk = (days: number): Notice => ({
  kind: 'streak',
  title: 'notifications.streakTitle',
  body: 'notifications.streakBody',
  params: { n: days },
  target: 'session-setup',
  // Timely and worthless a day later, so push only. Nobody wants this in
  // their inbox, and nobody would pay to send it.
});

/**
 * The first thing a new install says.
 *
 * Sent by hand rather than on a trigger, because "installed the app" is not
 * an event this system can see: there is no install hook, only a device
 * registering a push token, and firing on that would greet the same person
 * again every time they reinstalled or switched phone.
 *
 * Inbox and push, no email. It is a hello, not a record.
 */
export const welcome = (): Notice => ({
  kind: 'reminder',
  title: 'notifications.welcomeTitle',
  body: 'notifications.welcomeBody',
  target: 'home',
});

export const nothingStudiedToday = (): Notice => ({
  kind: 'reminder',
  title: 'notifications.reminderTitle',
  body: 'notifications.reminderBody',
  target: 'home',
});

export const reportReady = (): Notice => ({
  kind: 'report',
  title: 'notifications.reportTitle',
  body: 'notifications.reportBody',
  target: 'report',
  // Email too: a report card is the thing a student shows a parent, and it
  // reads better on a bigger screen than a notification shade.
  also: ['email'],
});

export const paymentReceived = (date: string): Notice => ({
  kind: 'payment',
  title: 'notifications.paymentTitle',
  body: 'notifications.paymentBody',
  params: { date },
  target: 'payments',
  // Email too. This is money, and the student wants something to keep.
  also: ['email'],
});

/* ------------------------------------------------------- the evening nudge */

/**
 * A streak that is about to break, warned in proportion to what it is worth.
 *
 * Losing a two day streak is a shrug. Losing a five week one is the thing that
 * makes a student close the app for good, so it gets a louder sentence.
 */
export const streakAtRiskTiered = (days: number): Notice =>
  days >= 30
    ? { ...streakAtRisk(days), title: 'notifications.streakEpicTitle', body: 'notifications.streakEpicBody' }
    : days >= 7
      ? { ...streakAtRisk(days), title: 'notifications.streakLongTitle', body: 'notifications.streakLongBody' }
      : streakAtRisk(days);

/** Reaching a streak, rather than nearly losing one. The only happy nudge. */
export const streakMilestone = (days: number): Notice => ({
  kind: 'streak',
  title: 'notifications.streakMilestoneTitle',
  body: 'notifications.streakMilestoneBody',
  params: { n: days },
  target: 'home',
});

/** They stopped partway through a chapter and never came back to it. */
export const resumeChapter = (chapter: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.resumeChapterTitle',
  body: 'notifications.resumeChapterBody',
  params: { chapter },
  target: 'study',
});

/** Their actual worst topic, named. Vague encouragement is easy to ignore. */
export const weakTopicNudge = (topic: string, pct: number): Notice => ({
  kind: 'reminder',
  title: 'notifications.weakTopicTitle',
  body: 'notifications.weakTopicBody',
  params: { topic, pct },
  target: 'practice',
});

/** Today's plan, still with tasks on it, while there is still an evening left. */
export const planUnfinished = (left: number): Notice => ({
  kind: 'reminder',
  title: 'notifications.planLeftTitle',
  body: 'notifications.planLeftBody',
  params: { n: left },
  target: 'home',
});

/**
 * The general evening nudge, in four flavours.
 *
 * Rotated rather than random, keyed on the day, so a student gets a different
 * sentence each night instead of the same one for a month. Random would repeat
 * by chance; a rotation cannot.
 */
const COMEBACK = ['comeback1', 'comeback2', 'comeback3', 'comeback4'] as const;

export const comeBack = (dayIndex: number): Notice => {
  const pick = COMEBACK[Math.abs(dayIndex) % COMEBACK.length];
  return {
    kind: 'reminder',
    title: `notifications.${pick}Title` as Notice['title'],
    body: `notifications.${pick}Body` as Notice['body'],
    target: 'home',
  };
};

/**
 * Win-back, for a student who has stopped altogether.
 *
 * Three rungs and then silence, and each rung fires on its exact day rather
 * than on "at least". With `>=` the fortnight message repeated every night
 * from day 14 to day 21, which is eight identical notifications to somebody
 * who is already drifting away: the surest way to have them turn notifications
 * off rather than come back.
 */
export const awayFor = (days: number): Notice | null => {
  const stage = days === 14 ? 'away14' : days === 7 ? 'away7' : days === 3 ? 'away3' : null;
  if (!stage) return null;
  return {
    kind: 'reminder',
    title: `notifications.${stage}Title` as Notice['title'],
    body: `notifications.${stage}Body` as Notice['body'],
    target: 'home',
  };
};
