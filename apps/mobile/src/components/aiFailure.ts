import type { AiFail } from '@matricmate/core';
import type { StringKey } from '../i18n';

/**
 * What to tell a student when an AI request did not come back with an answer.
 *
 * One table for every screen that asks the AI for something. Six screens
 * each wrote the same object out, and a new reason (a chapter outside the
 * student's syllabus) had to be added to all six or the screens disagreed.
 */
const NOTE: Record<AiFail['reason'], StringKey> = {
  offline: 'tutor.offline',
  quota: 'tutor.limitToast',
  rate: 'tutor.slowDown',
  // Status only: this app may not name a plan to get (Google Play).
  plan: 'tutor.aiNotInPlan',
  trial: 'tutor.notInTrial',
  refused: 'tutor.refused',
  syllabus: 'tutor.notInSyllabus',
  error: 'tutor.errorReply',
};

export const aiFailureKey = (reason: AiFail['reason']): StringKey => NOTE[reason];

/**
 * Whether trying the same request again can work. A spent allowance, a missing
 * plan and a chapter outside the syllabus stay that way however often the
 * student taps Retry, so those screens offer none.
 */
export const aiRetryable = (reason: AiFail['reason']): boolean =>
  reason === 'offline' || reason === 'rate' || reason === 'error' || reason === 'refused';
