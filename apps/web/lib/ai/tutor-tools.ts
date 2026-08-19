import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * What the tutor can look up about the student it is talking to.
 *
 * Before this, every question carried a fixed block of the student pushed into
 * the prompt: name, medium, subjects, and the top three weak topics. That block
 * cost tokens on every question whether the answer needed it or not, it was a
 * snapshot chosen by the client rather than by the model, and it could not
 * answer the questions a student actually asks a tutor: how did I do on my last
 * test, am I ready for this chapter, what should I revise first.
 *
 * Three rules hold this together and none of them is optional.
 *
 * The student id is a closure, never a tool argument. The model can be talked
 * into passing anything, so it is never asked to. Every query below is scoped
 * by the id the route authenticated, and that scoping is the access control.
 *
 * Nothing here calls into `@matricmate/core`. Its catalogue is module-global
 * and this is a server: `buildPlan` and `chapterById` read state that the last
 * request left behind, so a Class 10 student could be handed a Class 9 chapter
 * list belonging to whoever was served before them. Facts come from the
 * database, per request.
 *
 * Answers are summaries, never rows. A tool result is prompt on the next turn,
 * so a thousand attempt rows would cost more than the block this replaced. Each
 * one is capped, and paged with `.range()` where the underlying table can grow
 * past the thousand rows `select()` silently stops at.
 */

const PAGE = 1000;
const TIMEZONE = 'Asia/Karachi';

const dayKey = (d = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);

type Db = ReturnType<typeof createAdminClient>;

/** Every attempt, paged. The only read here that can grow without bound. */
async function allAttempts(admin: Db, userId: string) {
  const rows: { chapter_id: string | null; subject_id: string | null; topic: string | null; correct: boolean; at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from('attempts')
      .select('chapter_id,subject_id,topic,correct,at')
      .eq('user_id', userId)
      .order('at', { ascending: false })
      .range(from, from + PAGE - 1);
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

const pct = (right: number, total: number) => (total ? Math.round((right / total) * 100) : 0);

/**
 * Consecutive days up to today, from the days they actually studied. Counted
 * here rather than borrowed from core for the reason in the file header, and
 * it is six lines.
 */
function streakFrom(days: string[]): number {
  const set = new Set(days);
  let n = 0;
  for (let i = 0; ; i++) {
    const d = dayKey(new Date(Date.now() - i * 86_400_000));
    if (!set.has(d)) {
      // Today not being there yet is not a broken streak: it is the morning.
      if (i === 0) continue;
      break;
    }
    n++;
  }
  return n;
}

/* ------------------------------------------------------------- the tools */

export const TUTOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_progress',
    description:
      'How this student is doing overall: their streak, how many questions they have answered, their accuracy, and which subjects they are strongest and weakest in. Call this when the answer depends on how they are actually getting on, or when they ask.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_weak_topics',
    description:
      'The topics this student keeps getting wrong, worst first, with how many they have tried and their accuracy on each. Call this before recommending what to revise.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_recent_results',
    description:
      'Their last few completed tests and mock papers, with scores and dates. Call this when they ask how they did, or when judging whether they are ready for something.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_chapter_progress',
    description:
      'How far through one chapter this student is: sections read, flashcards known, and their accuracy on its questions. Call this before saying whether they are ready for a chapter or should revise it.',
    input_schema: {
      type: 'object',
      properties: { chapter_id: { type: 'string', description: 'A chapter id such as phy-3 or phy-10-1.' } },
      required: ['chapter_id'],
    },
  },
  {
    name: 'get_today',
    description:
      'What this student has done today: questions answered, sections read, flashcards reviewed, and whether they have studied at all yet. Call this when asked what to do now or next.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

/* ------------------------------------------------------------- handlers */

async function getProgress(admin: Db, userId: string) {
  const [attempts, { data: dayRows }, { data: profile }] = await Promise.all([
    allAttempts(admin, userId),
    admin.from('active_days').select('day').eq('user_id', userId).order('day', { ascending: false }).range(0, 399),
    admin.from('profiles').select('xp,grade').eq('id', userId).maybeSingle(),
  ]);

  const bySubject = new Map<string, { n: number; right: number }>();
  for (const a of attempts) {
    const k = a.subject_id ?? 'unknown';
    const s = bySubject.get(k) ?? { n: 0, right: 0 };
    s.n++;
    if (a.correct) s.right++;
    bySubject.set(k, s);
  }
  const subjects = [...bySubject.entries()]
    .filter(([, s]) => s.n >= 3)
    .map(([id, s]) => ({ subject: id, answered: s.n, accuracy_pct: pct(s.right, s.n) }))
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct);

  const days = ((dayRows ?? []) as { day: string }[]).map((d) => d.day);
  return {
    class: profile?.grade ?? 9,
    xp: profile?.xp ?? 0,
    streak_days: streakFrom(days),
    days_studied_total: days.length,
    questions_answered: attempts.length,
    overall_accuracy_pct: pct(attempts.filter((a) => a.correct).length, attempts.length),
    weakest_subjects: subjects.slice(0, 3),
    strongest_subjects: subjects.slice(-2).reverse(),
    note: attempts.length < 10 ? 'Barely any practice yet, so these numbers mean very little.' : undefined,
  };
}

async function getWeakTopics(admin: Db, userId: string) {
  const attempts = await allAttempts(admin, userId);
  const byTopic = new Map<string, { n: number; right: number }>();
  for (const a of attempts) {
    if (!a.topic) continue;
    const s = byTopic.get(a.topic) ?? { n: 0, right: 0 };
    s.n++;
    if (a.correct) s.right++;
    byTopic.set(a.topic, s);
  }
  const topics = [...byTopic.entries()]
    // Three is the floor for a topic to mean anything. One wrong answer is a
    // bad day, not a weakness, and the tutor should not build a revision plan
    // on it.
    .filter(([, s]) => s.n >= 3 && s.right / s.n < 0.7)
    .map(([topic, s]) => ({ topic, attempted: s.n, accuracy_pct: pct(s.right, s.n) }))
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct)
    .slice(0, 8);

  return topics.length ? { weak_topics: topics } : { weak_topics: [], note: 'Nothing stands out yet, or they have not practised enough for it to.' };
}

async function getRecentResults(admin: Db, userId: string) {
  const { data } = await admin
    .from('results')
    .select('label,score,total,mode,subject_id,at')
    .eq('user_id', userId)
    .order('at', { ascending: false })
    .range(0, 7);
  const rows = (data ?? []) as { label: string; score: number; total: number; mode: string; subject_id: string | null; at: string }[];
  if (!rows.length) return { results: [], note: 'They have not finished a test yet.' };
  return {
    results: rows.map((r) => ({
      what: r.label,
      subject: r.subject_id,
      kind: r.mode,
      score: `${r.score}/${r.total}`,
      percent: pct(r.score, r.total),
      on: r.at.slice(0, 10),
    })),
  };
}

async function getChapterProgress(admin: Db, userId: string, chapterId: string) {
  const id = chapterId.trim().slice(0, 40);
  if (!/^[a-z0-9-]+$/i.test(id)) return { error: 'That is not a chapter id.' };

  const [{ data: chapter }, { data: sections }, { data: read }, { data: cards }, attempts] = await Promise.all([
    admin.from('chapters').select('id,title,grade,subject_id').eq('id', id).maybeSingle(),
    admin.from('chapter_sections').select('id', { count: 'exact', head: true }).eq('chapter_id', id),
    admin.from('read_sections').select('section_id').eq('user_id', userId).eq('chapter_id', id).range(0, 199),
    admin.from('cards_known').select('card_id').eq('user_id', userId).range(0, PAGE - 1),
    allAttempts(admin, userId),
  ]);
  if (!chapter) return { error: 'No chapter with that id.' };

  const mine = attempts.filter((a) => a.chapter_id === id);
  const readCount = ((read ?? []) as unknown[]).length;
  // Sections exist per medium, so the count is doubled where a chapter has
  // been translated. Halving would be a guess; the ratio is what matters and
  // it is reported as a plain count either way.
  const total = (sections as unknown as { count?: number } | null)?.count ?? 0;

  return {
    chapter: chapter.title,
    class: chapter.grade,
    sections_read: readCount,
    sections_total: total || undefined,
    flashcards_known: ((cards ?? []) as { card_id: string }[]).filter((c) => c.card_id.startsWith(id)).length,
    questions_answered: mine.length,
    accuracy_pct: mine.length ? pct(mine.filter((a) => a.correct).length, mine.length) : undefined,
    note: mine.length === 0 && readCount === 0 ? 'They have not started this chapter.' : undefined,
  };
}

async function getToday(admin: Db, userId: string) {
  const today = dayKey();
  const since = new Date(`${today}T00:00:00+05:00`).toISOString();

  const [attempts, { data: read }, { data: done }, { data: day }] = await Promise.all([
    admin.from('attempts').select('correct,chapter_id').eq('user_id', userId).gte('at', since).range(0, 499),
    admin.from('read_sections').select('section_id').eq('user_id', userId).gte('at', since).range(0, 199),
    admin.from('plan_done').select('task_id').eq('user_id', userId).eq('day', today),
    admin.from('active_days').select('day').eq('user_id', userId).eq('day', today).maybeSingle(),
  ]);

  const rows = (attempts.data ?? []) as { correct: boolean; chapter_id: string | null }[];
  return {
    date: today,
    studied_today: !!day,
    questions_answered: rows.length,
    accuracy_pct: rows.length ? pct(rows.filter((r) => r.correct).length, rows.length) : undefined,
    sections_read: ((read ?? []) as unknown[]).length,
    plan_tasks_ticked: ((done ?? []) as { task_id: string }[]).map((r) => r.task_id).length,
    chapters_touched: [...new Set(rows.map((r) => r.chapter_id).filter(Boolean))].slice(0, 5),
  };
}

/**
 * Run one tool call. Returns whatever the model should see next turn.
 *
 * Never throws: a tool that fails tells the model so, in words, and the answer
 * carries on without that fact. A thrown error here would lose the whole
 * question and the student's place in the conversation, which is a far worse
 * outcome than an answer that had to guess.
 */
export async function runTutorTool(name: string, input: unknown, userId: string): Promise<unknown> {
  const admin = createAdminClient();
  try {
    switch (name) {
      case 'get_progress':
        return await getProgress(admin, userId);
      case 'get_weak_topics':
        return await getWeakTopics(admin, userId);
      case 'get_recent_results':
        return await getRecentResults(admin, userId);
      case 'get_chapter_progress':
        return await getChapterProgress(admin, userId, String((input as { chapter_id?: string })?.chapter_id ?? ''));
      case 'get_today':
        return await getToday(admin, userId);
      default:
        return { error: `No tool called ${name}.` };
    }
  } catch (e) {
    console.error('[tutor-tool]', name, e instanceof Error ? e.message : e);
    return { error: 'Could not look that up just now.' };
  }
}
