/**
 * Domain logic. XP, streaks, progress, weak topics, quotas.
 * Pure functions so the same rules run on device, on web and (later) on the server.
 */
import { Attempt, Confidence, PlanTask, TestResult } from './types';
import { CHAPTERS, chapterById, contentFor } from './content';

export const XP = {
  /** Correct answer. Honest confidence is rewarded: a lucky guess earns less than a sure answer. */
  forAnswer(correct: boolean, confidence: Confidence | null): number {
    if (!correct) return 0;
    if (confidence === 2) return 12; // Pakka
    if (confidence === 1) return 10; // Thora pakka
    if (confidence === 0) return 5; // Tukka: right, but own it
    return 10;
  },
  card: 2,
  examMultiplier: 2,
  streakDay: 20,
  perLevel: 500,
};

export const level = (xp: number) => Math.floor(xp / XP.perLevel) + 1;
export const levelProgress = (xp: number) => ((xp % XP.perLevel) / XP.perLevel) * 100;
export const xpToNextLevel = (xp: number) => XP.perLevel - (xp % XP.perLevel);

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Consecutive days with activity, counting back from today. */
export function streakFrom(activeDays: string[]): number {
  if (!activeDays.length) return 0;
  const set = new Set(activeDays);
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else if (streak === 0 && key === dayKey(Date.now())) {
      // today not active yet, a streak can still be alive from yesterday
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

/** Last 14 days as booleans for the streak strip. */
export function last14(activeDays: string[]): boolean[] {
  const set = new Set(activeDays);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return set.has(d.toISOString().slice(0, 10));
  });
}

export const accuracy = (attempts: Attempt[]) =>
  attempts.length ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : 0;

/** Accuracy per confidence level, the Pakka-meter payoff shown in analytics. */
export function confidenceBreakdown(attempts: Attempt[]) {
  return ([2, 1, 0] as Confidence[]).map((c) => {
    const set = attempts.filter((a) => a.confidence === c);
    return {
      confidence: c,
      label: c === 2 ? 'Pakka ✓' : c === 1 ? 'Thora pakka' : 'Tukka 🎲',
      said: set.length,
      accuracy: accuracy(set),
    };
  });
}

/** Coaching line derived from the breakdown, plain, specific, never preachy. */
export function confidenceInsight(rows: ReturnType<typeof confidenceBreakdown>): string | null {
  const pakka = rows.find((r) => r.confidence === 2);
  const tukka = rows.find((r) => r.confidence === 0);
  if (!pakka?.said && !tukka?.said) return null;
  if (pakka && pakka.said >= 5 && pakka.accuracy >= 85)
    return `Jab aap Pakka kehte hain, ${pakka.accuracy}% sahi hota hai. Khud par bharosa rakhein.`;
  if (pakka && pakka.said >= 5 && pakka.accuracy < 65)
    return `Pakka wale jawab sirf ${pakka.accuracy}% sahi hain. Un topics ko dobara dekh lein, confidence dhoka de raha hai.`;
  if (tukka && tukka.said > 0 && pakka)
    return `Tukka answers ${tukka.accuracy}% sahi hain vs Pakka ${pakka.accuracy}%. Tukkay kam karne ke liye practice barhayein.`;
  return 'Thori aur practice karein, phir confidence ka pattern saaf nazar aaye ga.';
}

/** Topics ranked worst-first, from at least 3 attempts each. */
export function weakTopics(attempts: Attempt[], minAttempts = 3) {
  const map = new Map<string, { topic: string; subjectId: string; chapterId: string; right: number; total: number }>();
  attempts.forEach((a) => {
    const k = `${a.subjectId}|${a.topic}`;
    const row = map.get(k) ?? { topic: a.topic, subjectId: a.subjectId, chapterId: a.chapterId, right: 0, total: 0 };
    row.total += 1;
    if (a.correct) row.right += 1;
    map.set(k, row);
  });
  return [...map.values()]
    .filter((r) => r.total >= minAttempts)
    .map((r) => ({ ...r, accuracy: Math.round((r.right / r.total) * 100) }))
    .filter((r) => r.accuracy < 75)
    .sort((a, b) => a.accuracy - b.accuracy);
}

/** Per-chapter progress = read sections + practised questions. */
export function chapterPct(chapterId: string, readSections: string[], attempts: Attempt[]): number {
  const content = contentFor(chapterId);
  const totalSections = content.sections.length || 1;
  const readCount = content.sections.filter((s) => readSections.includes(s.id)).length;
  const answered = new Set(attempts.filter((a) => a.chapterId === chapterId).map((a) => a.mcqId)).size;
  const qTarget = Math.min(content.mcqs.length || 1, 10);
  const readPart = (readCount / totalSections) * 70;
  const practicePart = (Math.min(answered, qTarget) / qTarget) * 30;
  return Math.round(readPart + practicePart);
}

export function subjectPct(subjectId: string, readSections: string[], attempts: Attempt[]): number {
  const chapters = CHAPTERS[subjectId] ?? [];
  if (!chapters.length) return 0;
  const sum = chapters.reduce((n, c) => n + chapterPct(c.id, readSections, attempts), 0);
  return Math.round(sum / chapters.length);
}

export function overallPct(subjectIds: string[], readSections: string[], attempts: Attempt[]): number {
  if (!subjectIds.length) return 0;
  return Math.round(subjectIds.reduce((n, s) => n + subjectPct(s, readSections, attempts), 0) / subjectIds.length);
}

/**
 * "Today's plan", three tasks: finish the chapter you're on, practise it,
 * and revise your weakest topic. Deterministic per day so it doesn't reshuffle.
 * M9 replaces this with the AI planner; the shape stays identical.
 */
export function buildPlan(opts: {
  subjectIds: string[];
  lastChapterId?: string;
  attempts: Attempt[];
  doneIds: string[];
}): PlanTask[] {
  const chId = opts.lastChapterId ?? (opts.subjectIds.length ? `${opts.subjectIds[0]}-1` : 'phy-1');
  const ch = chapterById(chId);
  const weak = weakTopics(opts.attempts)[0];
  const weakCh = weak ? chapterById(weak.chapterId) : undefined;
  const tasks: Omit<PlanTask, 'done'>[] = [
    { id: `plan-read-${chId}`, subjectId: ch?.subjectId ?? 'phy', chapterId: chId, kind: 'read' },
    { id: `plan-mcq-${chId}`, subjectId: ch?.subjectId ?? 'phy', chapterId: chId, kind: 'mcq' },
    weak && weakCh
      ? {
          id: `plan-weak-${weak.topic}`,
          subjectId: weak.subjectId,
          chapterId: weak.chapterId,
          kind: 'cards',
          weakTopic: weak.topic,
          weakAccuracy: weak.accuracy,
        }
      : { id: 'plan-cards-default', subjectId: ch?.subjectId ?? 'phy', chapterId: chId, kind: 'cards' },
  ];
  return tasks.map((task) => ({ ...task, done: opts.doneIds.includes(task.id) }));
}

/** Daily AI message quota (D7, confirm with client). */
/**
 * The tutor is the most expensive thing in the product, roughly Rs 1 a
 * question, so it is subscriber-only. A free account can read the sample
 * chapter but cannot spend our money asking questions.
 */
export const AI_QUOTA = { premium: 20, free: 0 };

export const grade = (pct: number) =>
  pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';

export function resultXp(score: number, total: number, mode: 'practice' | 'exam', attempts: Attempt[]) {
  const base = attempts.reduce((n, a) => n + XP.forAnswer(a.correct, a.confidence), 0);
  return mode === 'exam' ? base * XP.examMultiplier : base;
}

export const todayKey = () => dayKey(Date.now());

export function testsThisMonth(results: TestResult[]) {
  const m = new Date().getMonth();
  return results.filter((r) => new Date(r.at).getMonth() === m);
}
