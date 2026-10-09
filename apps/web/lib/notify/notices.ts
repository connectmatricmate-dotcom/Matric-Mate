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
 * The first thing a new account hears, from the welcome job (/api/cron/welcome),
 * once per account (profiles.welcomed_at).
 *
 * Email too, and the email is the long one: how the free trial works, what
 * comes after it, the plans with their prices and a button that signs the
 * student in on the plans page. A student who only ever has the app used to
 * meet a locked screen on day four with nothing having told them what comes
 * next. The inbox and push line names the website in plain words, which is as
 * far as the app may go (core/billing.ts).
 */
export const welcome = (link: string, aiPerDay: number): Notice => ({
  kind: 'reminder',
  title: 'notifications.welcomeTitle',
  body: 'notifications.welcomeBody',
  params: { n: aiPerDay },
  target: 'home',
  also: ['email'],
  email: { body: 'email.welcomeBody', plans: true, action: { label: 'email.seePlans', href: link }, note: 'email.linkNote' },
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

export const paymentReceived = (
  date: string,
  plan: 'basic' | 'premium' = 'premium',
  /** For the emailed receipt: what was paid and the payment's reference. */
  receipt?: { amount: number; reference: string },
): Notice => ({
  kind: 'payment',
  title: 'notifications.paymentTitle',
  // Named for the plan bought: every receipt used to say Premium.
  body: plan === 'basic' ? 'notifications.paymentBodyBasic' : 'notifications.paymentBody',
  params: { date, amount: receipt ? `Rs ${receipt.amount.toLocaleString('en-PK')}` : '', reference: receipt?.reference ?? '' },
  target: 'payments',
  // Email too. This is money, and the student wants something to keep: the
  // email (outside the app) says how much and the reference, which the inbox
  // and the phone do not.
  also: ['email'],
  ...(receipt
    ? { email: { body: plan === 'basic' ? 'email.receiptBodyBasic' : 'email.receiptBody', note: 'email.receiptNote' } }
    : {}),
});

/**
 * A student has asked for Premium while plans are switched on by hand.
 *
 * The inbox and push line says the request arrived and nothing more: it shows
 * in the Android app, which may not show a price or a way to pay
 * (core/billing.ts). The email is outside the app and carries the whole of
 * it: the amount, the accounts, and the WhatsApp number for the screenshot.
 */
export const planRequested = (details: { amount: string; accounts: string; whatsapp: string }): Notice => ({
  kind: 'payment',
  title: 'notifications.planRequestTitle',
  body: 'notifications.planRequestBody',
  params: details,
  target: 'subscription',
  also: ['email'],
  email: { body: 'email.planRequestBody' },
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

/*
 * Plan reminders, from the hourly plans job (/api/cron/plans), each sent once
 * per plan end date (plan_notices). The inbox and push lines say what is
 * happening and name the website in plain words, because the app shows them:
 * Google Play allows that much for an app that sells nothing itself, but no
 * link and no price (core/billing.ts). The email, which is outside the app,
 * lists the plans with their prices and carries a button that signs the
 * student in on the website's plans page (`link`, lib/signin-link.ts).
 */

/** Day two of a three-day trial: two days left, and what happens after. */
export const trialDay2 = (subject: string, date: string, link: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.trialDay2Title',
  body: 'notifications.trialDay2Body',
  params: { subject, date },
  target: 'subscription',
  also: ['email'],
  email: { body: 'email.trialDay2Body', plans: true, action: { label: 'email.seePlans', href: link }, note: 'email.linkNote' },
});

/**
 * The last day of a free trial: `time` is when it ends, and `today` whether
 * that is still today in Karachi. It can go out up to a day ahead, so an
 * evening reminder is usually about tomorrow.
 */
export const trialEnding = (subject: string, time: string, today: boolean, link: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.trialEndsTitle',
  body: today ? 'notifications.trialEndsBody' : 'notifications.trialEndsTomorrowBody',
  params: { subject, time },
  target: 'subscription',
  also: ['email'],
  email: {
    body: today ? 'email.trialEndsBody' : 'email.trialEndsTomorrowBody',
    plans: true,
    action: { label: 'email.seePlans', href: link },
    note: 'email.linkNote',
  },
});

/** A free trial that has just ended. */
export const trialEnded = (link: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.trialEndedTitle',
  body: 'notifications.trialEndedBody',
  target: 'subscription',
  also: ['email'],
  email: { body: 'email.trialEndedBody', plans: true, action: { label: 'email.seePlans', href: link }, note: 'email.linkNote' },
});

/** A paid plan with three days left. */
export const planEnding = (date: string, link: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.planEndsTitle',
  body: 'notifications.planEndsBody',
  params: { date },
  target: 'subscription',
  also: ['email'],
  email: { body: 'email.planEndsBody', plans: true, action: { label: 'email.renew', href: link }, note: 'email.linkNote' },
});

/** A paid plan in its last day. */
export const planLastDay = (date: string, link: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.planLastDayTitle',
  body: 'notifications.planLastDayBody',
  params: { date },
  target: 'subscription',
  also: ['email'],
  email: { body: 'email.planLastDayBody', plans: true, action: { label: 'email.renew', href: link }, note: 'email.linkNote' },
});

/** A paid plan that has just ended. */
export const planEnded = (date: string, link: string): Notice => ({
  kind: 'reminder',
  title: 'notifications.planEndedTitle',
  body: 'notifications.planEndedBody',
  params: { date },
  target: 'subscription',
  also: ['email'],
  email: { body: 'email.planEndedBody', plans: true, action: { label: 'email.renew', href: link }, note: 'email.linkNote' },
});

export type LapsedStep = 3 | 7 | 14 | 30;

/**
 * Still no plan, 3, 7, 14 or 30 days after a trial or plan ended, and then
 * silence: a student who has not come back in a month is not brought back by
 * a fifth email, only taught to ignore the address. Each step has its own
 * wording, so the ladder never repeats itself. The last two are email only
 * (Notice.emailOnly): a phone buzzing about it for the fourth time is nagging.
 */
export const lapsed = (step: LapsedStep, link: string): Notice => {
  const late = step >= 14;
  return {
    kind: 'reminder',
    title: `notifications.lapsed${step}Title` as Notice['title'],
    // The inbox line for the email-only steps is never shown; 3's stands in so the key is real.
    body: late ? 'notifications.lapsed3Body' : (`notifications.lapsed${step}Body` as Notice['body']),
    target: 'subscription',
    also: ['email'],
    ...(late ? { emailOnly: true } : {}),
    email: { body: `email.lapsed${step}Body` as Notice['body'], plans: true, action: { label: 'email.seePlans', href: link }, note: 'email.linkNote' },
  };
};

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
