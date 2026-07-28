/**
 * Demo data, seeded once at first sign-in so the app looks lived-in: a real
 * streak, real accuracy, real weak topics. Cleared by "Reset demo data".
 * Mirrors the Android app's seed so both demos tell the same story.
 */
import { Attempt, Confidence, Notification, TestResult } from '@matricmate/core';
import type { State } from './persisted-store';

const daysAgo = (n: number) => Date.now() - n * 864e5;

export function seed(): Partial<State> {
  const topics: [string, string, string, number][] = [
    ['Newton’s laws', 'phy', 'phy-3', 5],
    ['Momentum', 'phy', 'phy-3', 4],
    ['Circular motion', 'phy', 'phy-3', 2],
    ['Friction', 'phy', 'phy-3', 3],
    ['Force', 'phy', 'phy-3', 6],
    ['Turning Effect of Forces', 'phy', 'phy-4', 2],
    ['Atomic models', 'chem', 'chem-2', 5],
    ['Isotopes', 'chem', 'chem-2', 4],
    ['Electronic configuration', 'chem', 'chem-2', 3],
    ['Organelles', 'bio', 'bio-4', 5],
    ['Transport', 'bio', 'bio-4', 3],
  ];

  // Confidence pattern per topic: correctness runs k < right, so confident
  // answers land mostly right and guesses mostly wrong, but not perfectly,
  // which is what makes the confidence chart believable.
  const CONF: Confidence[] = [2, 1, 2, 0, 1, 2];
  const attempts: Attempt[] = [];
  let i = 0;
  topics.forEach(([topic, subjectId, chapterId, right]) => {
    for (let k = 0; k < 6; k++) {
      attempts.push({
        id: `seed-a${i}`,
        mcqId: `seed-m${i}`,
        chapterId,
        subjectId,
        topic,
        correct: k < right,
        confidence: CONF[k],
        mode: k % 5 === 0 ? 'exam' : 'practice',
        at: daysAgo(13 - (i % 13)),
      });
      i += 1;
    }
  });

  const results: TestResult[] = [
    { id: 'seed-r1', subjectId: 'phy', chapterId: 'phy-2', label: 'Kinematics, timed test', score: 15, total: 20, xp: 150, mode: 'exam', at: daysAgo(5), attemptIds: [] },
    { id: 'seed-r2', subjectId: 'phy', chapterId: 'phy-3', label: 'Dynamics, practice', score: 16, total: 20, xp: 168, mode: 'practice', at: daysAgo(2), attemptIds: [] },
    { id: 'seed-r3', subjectId: 'chem', chapterId: 'chem-2', label: 'Structure of Atoms, practice', score: 12, total: 15, xp: 120, mode: 'practice', at: daysAgo(1), attemptIds: [] },
  ];

  const notifications: Notification[] = [
    { id: 'n1', kind: 'streak', title: 'Streak alive, shabash!', body: 'Keep it going: one lesson today counts.', at: Date.now() - 2 * 36e5, target: 'progress', read: false },
    { id: 'n2', kind: 'reminder', title: 'Study reminder', body: '10 MCQs on Dynamics are waiting.', at: Date.now() - 5 * 36e5, target: 'session-setup', read: false },
    { id: 'n3', kind: 'report', title: 'Your report card is ready', body: 'View it and share with your parents.', at: daysAgo(3), target: 'report', read: true },
  ];

  return {
    attempts,
    results,
    notifications,
    activeDays: [0, 1, 2, 4, 5, 7, 8, 9, 11, 13].map((n) => new Date(daysAgo(n)).toISOString().slice(0, 10)),
    readSections: ['phy-3-s1', 'phy-3-s2', 'phy-3-s3', 'chem-2-s1'],
    lastChapterId: 'phy-3',
    lastSectionIndex: 3,
    xp: 2840,
    downloads: ['phy-2', 'phy-3'],
    cardsKnown: ['phy3-f1', 'phy3-f2', 'phy3-f4'],
  };
}
