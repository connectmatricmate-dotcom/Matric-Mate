import type { StringKey } from '@matricmate/core';
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

/**
 * A fresh coach report. It lives in the coach card on the dashboard, so that
 * is where a tap lands: this pointed at the monthly grade table, which is a
 * different page that says nothing the notification promised.
 *
 * No email. The coach rewrites every day for anyone who studied, so this went
 * out daily, with no report in it and no link to one: exactly the routine mail
 * this file keeps out of the inbox a receipt has to reach.
 */
export const reportReady = (): Notice => ({
  kind: 'report',
  title: 'notifications.reportTitle',
  body: 'notifications.reportBody',
  target: 'home',
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

/** They stopped partway through a chapter and never came back to it. A tap opens that chapter. */
export const resumeChapter = (chapter: string, chapterId?: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.resumeChapterTitle',
  body: 'notifications.resumeChapterBody',
  params: { chapter },
  ...(chapterId ? { target: 'chapter' as const, chapterId } : { target: 'study' as const }),
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
 * The general evening nudge, in eight flavours.
 *
 * Rotated rather than random, keyed on the day, so a student gets a different
 * sentence each night instead of the same one for a month. Random would repeat
 * by chance; a rotation cannot. Eight rather than four since a student who has
 * stopped hears from us every evening, not three times and then never.
 */
const COMEBACK = ['comeback1', 'comeback2', 'comeback3', 'comeback4', 'comeback5', 'comeback6', 'comeback7', 'comeback8'] as const;

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
 * Three rungs, and on every other evening the rotating nudge above: silence
 * after a fortnight lost exactly the students these messages exist for. Each
 * rung fires on its exact day rather than on "at least". With `>=` the fortnight message repeated every night
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

/** One of their own subjects, named, for a student who has been away. */
export const awaySubject = (subject: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.awaySubjectTitle',
  body: 'notifications.awaySubjectBody',
  params: { subject },
  target: 'study',
});

/** The same, for a student who has never studied: there is nothing to go back to yet. */
export const startSubject = (subject: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.startSubjectTitle',
  body: 'notifications.startSubjectBody',
  params: { subject },
  target: 'study',
});

/* ------------------------------------------- for a student who studied today */

/** Today is already their best day this week, with the count to prove it. */
export const bestDay = (n: number): Notice => ({
  kind: 'reminder',
  title: 'notifications.bestDayTitle',
  body: 'notifications.bestDayBody',
  params: { n },
  target: 'practice',
});

/** Close enough to their best day this week that the gap is worth naming. */
export const moreToday = (n: number, k: number): Notice => ({
  kind: 'reminder',
  title: 'notifications.moreTodayTitle',
  body: 'notifications.moreTodayBody',
  params: { n, k },
  target: 'practice',
});

/** Some questions today, and a best day too far off to hold up as a target. */
export const moreSet = (n: number): Notice => ({
  kind: 'reminder',
  title: 'notifications.moreSetTitle',
  body: 'notifications.moreSetBody',
  params: { n },
  target: 'practice',
});

export const planDone = (): Notice => ({
  kind: 'reminder',
  title: 'notifications.planDoneTitle',
  body: 'notifications.planDoneBody',
  target: 'home',
});

/** Studied today without answering anything: read notes or listened. */
export const keepGoing = (): Notice => ({
  kind: 'reminder',
  title: 'notifications.keepGoingTitle',
  body: 'notifications.keepGoingBody',
  target: 'practice',
});

/* ------------------------------------------------- the afternoon message */

/**
 * One flashcard from a chapter in their own syllabus, question and answer
 * together, so the notification is worth reading even if it is never opened.
 * A tap opens the chapter it came from.
 */
export const recall = (subject: string, question: string, answer: string, chapterId: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.recallTitle',
  body: 'notifications.recallBody',
  params: { subject, question, answer },
  target: 'chapter',
  chapterId,
});

const GENERAL_TIPS: StringKey[] = [
  'tips.general1',
  'tips.general2',
  'tips.general3',
  'tips.general4',
  'tips.general5',
  'tips.general6',
  'tips.general7',
  'tips.general8',
  'tips.general9',
  'tips.general10',
];

const SUBJECT_TIPS: Record<string, StringKey[]> = {
  math: ['tips.math1', 'tips.math2', 'tips.math3'],
  phy: ['tips.phy1', 'tips.phy2', 'tips.phy3'],
  chem: ['tips.chem1', 'tips.chem2', 'tips.chem3'],
  bio: ['tips.bio1', 'tips.bio2', 'tips.bio3'],
  eng: ['tips.eng1', 'tips.eng2', 'tips.eng3'],
  urd: ['tips.urd1', 'tips.urd2', 'tips.urd3'],
  isl: ['tips.isl1', 'tips.isl2', 'tips.isl3'],
  pst: ['tips.pst1', 'tips.pst2', 'tips.pst3'],
  cs: ['tips.cs1', 'tips.cs2', 'tips.cs3'],
};

/**
 * An exam tip, alternating between one for the named subject and one that
 * holds for every paper. `turn` counts up by one per tip this student is
 * sent, so neither list repeats before it has been worked through.
 */
export const examTip = (subjectId: string | null, subject: string, turn: number, target: 'study' | 'home'): Notice => {
  const own = (subject && subjectId && SUBJECT_TIPS[subjectId]) || [];
  const t = Math.abs(turn);
  const useOwn = own.length > 0 && t % 2 === 0;
  // With no subject tips to alternate with, the general list steps every
  // time; halving the turn repeated each tip on two days running.
  const general = own.length ? Math.floor(t / 2) : t;
  return {
    kind: 'reminder',
    title: useOwn ? 'notifications.tipTitle' : 'notifications.tipTitleGeneral',
    body: useOwn ? own[Math.floor(t / 2) % own.length] : GENERAL_TIPS[general % GENERAL_TIPS.length],
    params: { subject },
    target,
  };
};
