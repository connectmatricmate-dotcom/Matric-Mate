/**
 * Domain logic. XP, streaks, progress, weak topics, quotas.
 * Pure functions so the same rules run on device, on web and (later) on the server.
 */
import { Attempt, Chapter, Confidence, Medium, PlanTask, TestResult } from './types';
import { chapterById, chapterName, chaptersFor, contentFor } from './content';
import { translate, type Language } from './i18n';

/**
 * Whether a chapter has anything to actually study.
 *
 * Five chapters correctly carry zero sections, zero MCQs and zero flashcards:
 * three Maths chapters NCP 2022-23 dropped from Class 9 (Matrices, Congruent
 * Triangles, Sides and Angles of a Triangle), and Urdu listening and speaking,
 * which the board assesses in class and never on the annual paper. Both apps
 * read this off the chapter's own counts, populated from the database, rather
 * than a hardcoded id, so a chapter earns its "nothing to revise" treatment by
 * actually having nothing, not by matching a list that has to be kept in sync.
 */
/**
 * The recording to play for a student, given what was actually published.
 *
 * Falls back to English when their medium has not been recorded yet, because a
 * lesson in the other language beats no lesson at all. Returns null when the
 * chapter has nothing, and the caller must then show no audio option at all.
 */
export const pickAudioTrack = <T extends { medium: Medium }>(tracks: T[], medium: Medium): T | null =>
  tracks.find((t) => t.medium === medium) ?? tracks.find((t) => t.medium === 'en') ?? tracks[0] ?? null;

/**
 * Spacing around the chosen word in a fill-in-the-blank sentence.
 *
 * The sentence halves in the data are inconsistent about surrounding
 * whitespace, and both apps concatenated them raw, so the picked word fused
 * with its neighbours: "an example ofneutralequilibrium, because". Normalised
 * here once for both apps: the word gets a space on each side, except after an
 * opening bracket or quote and before closing punctuation.
 */
export const blankHalves = (before: string, after: string): [string, string] => {
  const b = before.replace(/\s+$/u, '');
  const a = after.replace(/^\s+/u, '');
  return [
    b ? (/[([{\u2018\u201C"']$/u.test(b) ? b : `${b} `) : '',
    a ? (/^[,.;:!?%)\]}\u2019\u201D]/u.test(a) ? a : ` ${a}`) : '',
  ];
};

export const hasStudyMaterial = (chapter: Pick<Chapter, 'sectionCount' | 'mcqCount' | 'flashcardCount'>): boolean =>
  chapter.sectionCount > 0 || chapter.mcqCount > 0 || chapter.flashcardCount > 0;

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

/**
 * Total XP implied by a set of attempts and known cards, recomputed rather
 * than read off a running counter.
 *
 * Every screen that awards XP does it incrementally, `xp + XP.forAnswer(...)`
 * on the moment of the answer, which is right for a device that saw every
 * answer happen. It is wrong the moment a sync hydration merges in attempts a
 * server had and this device did not: the counter never saw those, so it
 * would stay short by exactly their XP. This recomputes the total from
 * history instead, so it is correct regardless of which device recorded what.
 * Only used right after a hydration merge; every other update stays
 * incremental, because walking the full attempt list on every answer would
 * cost more than it is worth.
 */
export function totalXp(attempts: Attempt[], cardsKnown: string[]): number {
  return attempts.reduce((sum, a) => sum + xpForAttempt(a), 0) + cardsKnown.length * XP.card;
}

/**
 * What one recorded answer is worth, doubling for an exam.
 *
 * The multiplier lives here rather than at the two places that award XP,
 * because it used to live at only one of them. The result screen credited an
 * exam answer twice, as advertised, and then the next hydration recomputed the
 * total with a formula that had never heard of `mode` and quietly took the
 * bonus back. Any sync, any foreground, any cold start: the doubled XP a
 * student was shown never survived the minute.
 */
export function xpForAttempt(a: Pick<Attempt, 'correct' | 'confidence' | 'mode'>): number {
  return XP.forAnswer(a.correct, a.confidence) * (a.mode === 'exam' ? XP.examMultiplier : 1);
}

/**
 * The calendar day where the students are, not where the device thinks it is.
 *
 * This was UTC, so a student in Pakistan working after midnight had the whole
 * session credited to the previous day: their streak broke a day early and
 * "today's plan" turned over five hours late. The server counts AI quota in
 * Asia/Karachi for the same reason.
 */
const dayKey = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(ms));

/** Consecutive days with activity, counting back from today. */
export function streakFrom(activeDays: string[]): number {
  if (!activeDays.length) return 0;
  const set = new Set(activeDays);
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = dayKey(d.getTime());
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
    return set.has(dayKey(d.getTime()));
  });
}

export const accuracy = (attempts: Attempt[]) =>
  attempts.length ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : 0;

/** Accuracy per confidence level, the Pakka-meter payoff shown in analytics. */
/**
 * How often each confidence level turned out to be right.
 *
 * Deliberately over every attempt ever, not a window. The question this
 * answers is "does this student know when they know", which is a habit that
 * takes months to show and would be noise over seven days. It also keeps the
 * dashboard card and its Details view saying the same thing: the range picker
 * on that screen governs the trend chart, not this.
 *
 * No label here any more. It used to return 'Pakka ✓', 'Thora pakka' and
 * 'Tukka 🎲', hardcoded Roman Urdu inside a domain function, which no screen
 * rendered but which would have shown Roman to an Urdu student the first time
 * anyone used it. Screens read session.conf0/1/2 from the dictionary.
 */
export function confidenceBreakdown(attempts: Attempt[]) {
  return ([2, 1, 0] as Confidence[]).map((c) => {
    const set = attempts.filter((a) => a.confidence === c);
    return { confidence: c, said: set.length, accuracy: accuracy(set) };
  });
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

/**
 * Per-chapter progress = read sections + practised questions.
 *
 * Counts against the chapter's own totals, not against the bundled sample.
 * Real sections are ids like `phy-1-en-s1` and the bundle's are not, so
 * matching read markers against bundled section ids found nothing and progress
 * sat at zero however much a student read. Ownership is by id prefix, which is
 * unambiguous because `chem-1-` cannot match `chem-10-en-s1`.
 */
export function chapterPct(chapterId: string, readSections: string[], attempts: Attempt[]): number {
  const chapter = chapterById(chapterId);
  const content = contentFor(chapterId);
  const totalSections = chapter?.sectionCount || content.sections.length || 1;
  const readCount = readSections.filter((id) => id === chapterId || id.startsWith(`${chapterId}-`)).length;
  const answered = new Set(attempts.filter((a) => a.chapterId === chapterId).map((a) => a.mcqId)).size;
  const qTarget = Math.min(chapter?.mcqCount || content.mcqs.length || 1, 10);
  const readPart = (Math.min(readCount, totalSections) / totalSections) * 70;
  const practicePart = (Math.min(answered, qTarget) / qTarget) * 30;
  // Clamped: when a chapter's counts are unknown the divisor falls back to 1,
  // and five read sections turned into "350% complete" on the shelf and in
  // the syllabus-covered average.
  return Math.min(100, Math.round(readPart + practicePart));
}

export function subjectPct(subjectId: string, readSections: string[], attempts: Attempt[]): number {
  const chapters = chaptersFor(subjectId);
  if (!chapters.length) return 0;
  const sum = chapters.reduce((n, c) => n + chapterPct(c.id, readSections, attempts), 0);
  return Math.round(sum / chapters.length);
}

export function overallPct(subjectIds: string[], readSections: string[], attempts: Attempt[]): number {
  if (!subjectIds.length) return 0;
  return Math.round(subjectIds.reduce((n, s) => n + subjectPct(s, readSections, attempts), 0) / subjectIds.length);
}

/**
 * The chapter today's plan is about.
 *
 * Where they left off, and failing that the first chapter of their own class
 * that has something in it. It used to be composed as `${subjectIds[0]}-1`,
 * which is the Class 9 id shape: a Class 10 student's plan opened on Class 9
 * chapter one, wore its real Class 9 title because the bundled catalogue could
 * answer for it, and dead-ended the moment it was tapped, because the server
 * serves that account only its own class.
 *
 * So nothing is composed here. Every candidate comes from the catalogue and has
 * to say it belongs to this student's class. Returning nothing is a valid
 * answer: no plan is better than a plan pointing at another class's syllabus.
 *
 * A stored `lastChapterId` is trusted unless the catalogue knows the chapter
 * and says it is the wrong class. Not knowing it is normal offline, where the
 * live index has not primed, and is not evidence of anything.
 */
export function planChapterId(
  subjectIds: string[],
  grade: number,
  lastChapterId?: string,
  readSections: string[] = [],
): string | undefined {
  /**
   * Whether every section of a chapter has been read.
   *
   * Needs the counts, so it is false for the bundled catalogue, which carries
   * zeroes. That is the right answer there: without counts we cannot say a
   * chapter is finished, and guessing would move the plan off a chapter the
   * student is still working through.
   */
  const finished = (c: Chapter) =>
    c.sectionCount > 0 && readSections.filter((id) => id.startsWith(`${c.id}-`)).length >= c.sectionCount;

  if (lastChapterId) {
    const known = chapterById(lastChapterId);
    // Unknown means offline, not wrong: trust it. Known and the other class,
    // or known and finished, and the plan should move on.
    if (!known) return lastChapterId;
    if (known.grade === grade && !finished(known)) return lastChapterId;
  }
  for (const subjectId of subjectIds) {
    const chapters = chaptersFor(subjectId).filter((c) => c.grade === grade);
    // Something to study, and something still to do in it. A chapter whose
    // counts have not loaded yet still beats no plan at all.
    const pick = chapters.find((c) => hasStudyMaterial(c) && !finished(c)) ?? chapters.find(hasStudyMaterial) ?? chapters[0];
    if (pick) return pick.id;
  }
  return lastChapterId;
}

/**
 * "Today's plan", three tasks: finish the chapter you're on, practise it,
 * and revise your weakest topic. Deterministic per day so it doesn't reshuffle.
 * M9 replaces this with the AI planner; the shape stays identical.
 */
export function buildPlan(opts: {
  subjectIds: string[];
  /** The student's class. Required: see planChapterId. */
  grade: number;
  lastChapterId?: string;
  attempts: Attempt[];
  /** Ticked by hand, from any device. */
  doneIds: string[];
  readSections: string[];
  cardsKnown: string[];
}): PlanTask[] {
  const chId = planChapterId(opts.subjectIds, opts.grade, opts.lastChapterId, opts.readSections);
  if (!chId) return [];
  const ch = chapterById(chId);
  /* The id carries its own subject, which matters offline: the catalogue may not
     know a Class 10 chapter yet, and defaulting the chip to Physics would put
     the wrong subject on a Chemistry task. */
  const subjectId = ch?.subjectId ?? chId.split('-')[0];
  const weak = weakTopics(opts.attempts)[0];
  const weakCh = weak ? chapterById(weak.chapterId) : undefined;
  /**
   * Today's date is part of every task id, which is what makes this "today's"
   * plan. Without it the ticks were permanent: a student who finished the
   * plan once saw "3/3 done", struck through, every morning after.
   */
  const day = todayKey();
  const tasks: Omit<PlanTask, 'done'>[] = [
    { id: `plan-read-${chId}-${day}`, subjectId, chapterId: chId, kind: 'read' },
    { id: `plan-mcq-${chId}-${day}`, subjectId, chapterId: chId, kind: 'mcq' },
    weak && weakCh
      ? {
          id: `plan-weak-${weak.topic}-${day}`,
          subjectId: weak.subjectId,
          chapterId: weak.chapterId,
          kind: 'cards',
          weakTopic: weak.topic,
          weakAccuracy: weak.accuracy,
        }
      : { id: `plan-cards-default-${day}`, subjectId, chapterId: chId, kind: 'cards' },
  ];
  /*
   * Done means done, whether the student said so or simply did it.
   *
   * The automatic half is derived from work that already syncs (sections read,
   * answers given, cards known), so it needs no storage of its own and cannot
   * disagree between a phone and a laptop. The manual half is the plan_done
   * table. A task is finished if either says so.
   */
  const withDone = tasks.map((task) => ({ ...task, done: opts.doneIds.includes(task.id) }));
  const auto = planAutoDone(withDone, {
    attempts: opts.attempts,
    readSections: opts.readSections,
    cardsKnown: opts.cardsKnown,
  });
  return withDone.map((task) => (task.done ? task : { ...task, done: auto.includes(task.id) }));
}

/**
 * Which of today's tasks the student's actual work has already finished.
 *
 * Reading and cards are counted over all time, not just today, and that is
 * deliberate now that the plan moves on: a chapter the student finished last
 * week is not offered again, so a ticked read task means they finished it,
 * and it can only be today's chapter if there was still work in it this
 * morning. Answering is scoped to today because "practise ten questions" is a
 * thing you do again, not a thing you finish.
 *
 * The plan used to be three checkboxes you ticked yourself, which made it a
 * to-do list the app wrote and then took your word for. A student could read
 * the whole chapter and still look at an empty box, or tick all three without
 * opening anything.
 *
 * So completion is read from the work instead. Every signal here is something
 * already recorded for another reason, which is what makes it trustworthy:
 * sections read, answers given, cards marked known. Nothing new is stored and
 * nothing is inferred from time spent on a screen.
 *
 * Manual ticking still works and still wins. This only ever adds: a student
 * who wants a task off their list can say so, and a student who genuinely did
 * the work does not have to.
 */
export function planAutoDone(
  plan: PlanTask[],
  data: { attempts: Attempt[]; readSections: string[]; cardsKnown: string[] },
): string[] {
  const since = startOfTodayMs();
  const todays = data.attempts.filter((a) => a.at >= since);
  const done: string[] = [];

  for (const task of plan) {
    const ch = chapterById(task.chapterId);
    const forChapter = (id: string) => id === task.chapterId || id.startsWith(`${task.chapterId}-`);

    if (task.kind === 'read') {
      // The whole chapter, not one section: the task says "read {chapter}".
      const total = ch?.sectionCount || contentFor(task.chapterId).sections.length || 0;
      const read = data.readSections.filter(forChapter).length;
      if (total > 0 && read >= total) done.push(task.id);
      continue;
    }

    if (task.kind === 'mcq') {
      // Ten distinct questions today, which is what the task asks for. Distinct
      // so re-answering the same question ten times does not count.
      const answered = new Set(todays.filter((a) => a.chapterId === task.chapterId).map((a) => a.mcqId));
      if (answered.size >= PLAN_MCQ_TARGET) done.push(task.id);
      continue;
    }

    // Cards. A weak-topic task is really "practise this topic", so answering
    // it counts as well as reviewing the cards.
    if (task.weakTopic) {
      const onTopic = todays.filter((a) => a.topic === task.weakTopic);
      if (onTopic.length >= PLAN_WEAK_TARGET) done.push(task.id);
      continue;
    }
    const known = data.cardsKnown.filter(forChapter).length;
    if (known >= PLAN_CARDS_TARGET) done.push(task.id);
  }

  return done;
}

/** Midnight in Pakistan, as a timestamp, so "today" means the student's today. */
function startOfTodayMs(): number {
  const key = todayKey();
  // todayKey is already the Asia/Karachi date; PKT is UTC+5 with no DST.
  return Date.parse(`${key}T00:00:00+05:00`);
}

/** What each planned task asks for. The copy in the plan quotes these. */
export const PLAN_MCQ_TARGET = 10;
export const PLAN_CARDS_TARGET = 10;
export const PLAN_WEAK_TARGET = 5;

/** Daily AI message quota (D7, confirm with client). */
/**
 * The tutor is the most expensive thing in the product, roughly Rs 1 a
 * question, so it is subscriber-only. A free account can read the sample
 * chapter but cannot spend our money asking questions.
 */
/**
 * 50, not 20: high enough that an honest student never meets it on an exam
 * night, so the tutor feels unlimited. The real abuse wall is the server's
 * per-minute rate limit, not this ceiling. One constant, enforced in the
 * tutor route; changing it is an edit here and a deploy, no app update.
 */
export const AI_QUOTA = { premium: 50, free: 0 };

/**
 * Class 10 exists in the schema and the UI, but stays un-pickable until its
 * content has actually shipped. Switching class wipes progress and starts a
 * seven day cooldown, so offering an empty class would be a trap, not a
 * feature.
 *
 * Flipped 15 Aug 2026: the full SSC-II catalogue is published, all 70
 * chapters in both mediums (140 chapter-media, validated against the
 * board's own outcome codes).
 */
export const GRADE_10_READY = true;

export const GRADES = [
  { grade: 9 as const, ready: true },
  { grade: 10 as const, ready: GRADE_10_READY },
];

export const grade = (pct: number) =>
  pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';

/**
 * True when a string is written in Arabic script (Urdu titles and blurbs).
 * Any text this matches must render through the Urdu type treatment
 * (Nastaliq face, RTL, extra leading); in the Latin body font it degrades
 * into the broken glyph soup the client screenshotted.
 */
export const isUrduScript = (s: string) => /[؀-ۿ]/.test(s);

/**
 * One language at a time: the app language picks which version of a
 * bilingual name shows. Showing both at once was the client's complaint,
 * the UI read as clutter. Falls back to the English name when no Urdu one
 * exists (and vice versa there is no case: English names always exist).
 */
export function localName(language: 'en' | 'ur', en: string, ur?: string | null): { text: string; urdu: boolean } {
  if (language === 'ur' && ur) return { text: ur, urdu: true };
  return { text: en, urdu: false };
}


export const todayKey = () => dayKey(Date.now());

export function testsThisMonth(results: TestResult[]) {
  const m = new Date().getMonth();
  return results.filter((r) => new Date(r.at).getMonth() === m);
}

/* ------------------------------------------------------------ next action */

/**
 * The one thing to do next, chosen from what the app already knows.
 *
 * The coach card describes the week and stops, which leaves the student to
 * work out what to do about it. This picks the single obvious next step so the
 * card can end in a button instead of a decision.
 *
 * One, deliberately. Three buttons put the decision back.
 *
 * Pure, and here rather than in either app, so the phone and the browser
 * choose the same thing for the same student and it can be reasoned about
 * without a device.
 */
export type NextAction =
  /** Mid-chapter: pick up where the reading stopped. */
  | { kind: 'continue'; chapterId: string; sectionIndex: number }
  /** A topic they keep getting wrong, with enough answers to mean it. */
  | { kind: 'fix'; topic: string; chapterId: string; accuracy: number }
  /** Today's plan, when there is a reason to reach for it. */
  | { kind: 'task'; task: PlanTask }
  /** No history at all: begin. */
  | { kind: 'start'; chapterId: string }
  | null;

export function nextAction(opts: {
  subjectIds: string[];
  grade: number;
  lastChapterId?: string;
  lastSectionIndex: number;
  readSections: string[];
  attempts: Attempt[];
  activeDays: string[];
  plan: PlanTask[];
}): NextAction {
  const forChapter = (id: string, chapterId: string) => id.startsWith(`${chapterId}-`);

  /* 1. Half way through a chapter. The most concrete thing there is: they know
        the chapter, they know where they were, and it is already open work. */
  const current = opts.lastChapterId ? chapterById(opts.lastChapterId) : undefined;
  if (opts.lastChapterId && current && current.sectionCount > 0) {
    const read = opts.readSections.filter((id) => forChapter(id, current.id)).length;
    if (read > 0 && read < current.sectionCount) {
      return {
        kind: 'continue',
        chapterId: current.id,
        sectionIndex: Math.min(Math.max(opts.lastSectionIndex, 0), current.sectionCount - 1),
      };
    }
  }

  /* 2. A weak topic. weakTopics already demands three answers and under 75%,
        which is the "enough evidence" part: one bad guess is not a weakness. */
  const weak = weakTopics(opts.attempts)[0];
  if (weak) {
    return { kind: 'fix', topic: weak.topic, chapterId: weak.chapterId, accuracy: weak.accuracy };
  }

  /* 3. Nothing behind them at all. Before the plan, because the plan would say
        "Read chapter one, 15 min" and "Start Physical Quantities" is the same
        instruction in the words a first morning deserves. */
  if (!opts.readSections.length && !opts.attempts.length) {
    const first = planChapterId(opts.subjectIds, opts.grade, opts.lastChapterId, opts.readSections);
    if (first) return { kind: 'start', chapterId: first };
  }

  /* 4. Today's plan. Shortest first, because the student this is aimed at has
        not started today and the point is to get them started at all: ten
        cards is a smaller ask than a chapter. */
  const undone = opts.plan.filter((task) => !task.done);
  const shortest =
    undone.find((task) => task.kind === 'cards') ??
    undone.find((task) => task.kind === 'mcq') ??
    undone.find((task) => task.kind === 'read');
  const studiedToday = opts.activeDays.includes(todayKey());
  if (shortest && !studiedToday) return { kind: 'task', task: shortest };

  /* 5. Something from the plan, or nothing: a student who has studied today
        and has no weak topic is allowed to be finished. */
  return shortest ? { kind: 'task', task: shortest } : null;
}

/**
 * The same choice, dressed for a button: what it says and where it goes.
 *
 * Here rather than in either dashboard because the two apps share their routes
 * and their copy keys, and a CTA that says one thing on the phone and another
 * in the browser is the kind of drift that makes a product feel like two
 * products. `translate` rather than each app's hook: this is pure, so the
 * language is an argument.
 */
export function nextStep(action: NextAction, lang: Language): { label: string; href: string } | null {
  if (!action) return null;

  /* A chapter we cannot name. Offline on a Class 10 account the catalogue may
     not have been primed yet, and "Carry on with {chapter}" would show the
     brace. The destination is still right, so keep the button and let it say
     the plainer thing. */
  const named = (id: string, key: 'dash.nextContinue' | 'dash.nextRead' | 'dash.nextPractise' | 'dash.nextStart', href: string) => {
    const name = chapterName(chapterById(id), lang);
    return { label: name ? translate(lang, key, { chapter: name }) : translate(lang, 'dash.continueLearning'), href };
  };

  switch (action.kind) {
    case 'continue':
      /* Straight back to the section they stopped at, not the top of the
         chapter: "carry on" has to mean carry on. */
      return named(action.chapterId, 'dash.nextContinue', `/learn/reader/${action.chapterId}?section=${action.sectionIndex}`);
    case 'fix':
      /* Practice from the chapter the topic belongs to, which is what the weak
         topics screen already does with its Practise button. Deliberately not
         the AI test: a dashboard button should not spend a student's questions
         for them. */
      return { label: translate(lang, 'dash.nextFix', { topic: action.topic }), href: `/session/setup?chapter=${action.chapterId}` };
    case 'task':
      if (action.task.kind === 'read') return named(action.task.chapterId, 'dash.nextRead', `/learn/reader/${action.task.chapterId}`);
      if (action.task.kind === 'mcq') return named(action.task.chapterId, 'dash.nextPractise', `/session/setup?chapter=${action.task.chapterId}`);
      return { label: translate(lang, 'dash.taskCards'), href: `/session/flashcards?chapter=${action.task.chapterId}` };
    case 'start':
      return named(action.chapterId, 'dash.nextStart', `/learn/reader/${action.chapterId}`);
  }
}

/**
 * A Pakistani mobile in the shape the database takes: +92 then ten digits.
 *
 * Students type 03001234567, `profiles.phone` has required '^\+92\d{10}$'
 * since migration 0003, and Safepay needs something it can parse to create the
 * payer record that fills its checkout form in. One conversion, shared by both
 * apps, rather than three opinions about what a phone number is.
 *
 * Returns null for anything that is not a number we recognise. Callers drop it
 * rather than refusing the signup: a mistyped mobile should cost a prefill, not
 * an account.
 */
export function normaliseMobile(v: string): string | null {
  const digits = v.replace(/\D/g, '');
  const local = digits.replace(/^92/, '').replace(/^0/, '');
  return /^3\d{9}$/.test(local) ? `+92${local}` : null;
}
