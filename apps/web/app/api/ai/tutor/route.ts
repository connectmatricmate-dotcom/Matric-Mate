import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_QUOTA, BOARD_LABEL, SUBJECTS, asBoard, subjectMedium, translate, type Board } from '@matricmate/core';
import { planIsActive } from '@/lib/entitlement';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { addUsage, chapterGrounding, type Grounding } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';
import { TUTOR_TOOLS, runTutorTool } from '@/lib/ai/tutor-tools';

/**
 * The tutor, for real. One route serves both apps: the website calls it with
 * its session cookies, the Android app with a Supabase access token in the
 * Authorization header. The Anthropic key exists only here, server-side;
 * nothing shippable ever carries it.
 *
 * Every wall a student can hit is enforced HERE, not in the apps, because a
 * client-side counter is a suggestion and this is a bill:
 *  - no active plan: 402
 *  - 50 questions per day (Asia/Karachi days, because that is where every
 *    student lives): 429 with the reset time
 *  - 5 questions per minute, the actual abuse wall: 429 with retry hint
 *
 * Those walls answer as plain JSON before any model call. Once the model
 * starts, the answer streams back as NDJSON lines so the student watches it
 * being written instead of staring at a spinner:
 *   {"t":"delta","text":"..."}   repeated, then exactly one of
 *   {"t":"done","threadId":...,"quota":{...}} | {"t":"err","reason":...}
 *
 * A question can also carry a photo (base64) and the model reads it: snap
 * the homework, get the steps. Images are answered but not persisted; the
 * thread keeps a text marker instead, because chat history is text.
 *
 * The model choice is one constant. claude-sonnet-5 because a tutor for
 * fourteen-year-olds must be genuinely good in both English and Urdu and
 * still answer in a few seconds; at roughly two rupees an answer against a
 * thousand-rupee subscription the economics hold. If quality ever needs a
 * step up, claude-opus-5 is a one-word change here and a deploy.
 */
const TUTOR_MODEL = 'claude-sonnet-5';
// Sonnet 5 thinks adaptively by default and max_tokens caps thinking PLUS the
// visible answer, so this needs headroom or a hard numerical would truncate
// mid-solution. The answers themselves stay short; the prompt sees to that.
const MAX_ANSWER_TOKENS = 6000;
/** Messages of history the model sees: the latest ones, never the first. */
const HISTORY_TURNS = 12;
const RATE_LIMIT_PER_MINUTE = 5;
const TIMEZONE = 'Asia/Karachi';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** ~5 MB of base64: generous for a downscaled phone photo, a wall for abuse. */
const IMAGE_MAX_CHARS = 7_000_000;

export const maxDuration = 300;

const anthropic = new Anthropic();

/** Today's date key where the students are, not where the server is. */
function dayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

/** Next midnight in Pakistan, as an ISO instant the apps can render. */
function resetAt(): string {
  const now = new Date();
  const pkNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const pkMidnight = new Date(pkNow);
  pkMidnight.setHours(24, 0, 0, 0);
  return new Date(now.getTime() + (pkMidnight.getTime() - pkNow.getTime())).toISOString();
}

/**
 * Who is calling. Cookies for the website, a bearer token for the app.
 */
async function authenticate(req: NextRequest): Promise<string | null> {
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearer.slice(7));
    if (!error && data.user) return data.user.id;
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

type QuotaState = { limit: number; used: number; remaining: number; resetAt: string };

/**
 * The teacher's standing knowledge: persona plus the board's own weighting
 * of every chapter, so "is this chapter important?" gets the real number.
 *
 * Deliberately identical bytes on every request, and marked as a cache
 * breakpoint: Anthropic then serves it from prompt cache at a tenth of the
 * price. The per-student block goes AFTER this, never inside it.
 */
const weightageDigest = new Map<string, string>();
/** Chapter titles by id, per board and class, filled with the digest above. */
const chapterTitles = new Map<string, Map<string, string>>();

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Chapter ids written into an answer's text, turned back into titles.
 *
 * The ids are handed to the model for its action tags, and it copied them into
 * its prose: "start with phy-3 (Dynamics, 22%)", "math-4, math-5". Students
 * have never seen an id. The prompt now forbids it; this catches what slips
 * through. Ids inside a tag (`[[read:phy-3]]`) are left alone, since the colon
 * in front is how the tag is read, and longer ids go first so phy-10-1 is
 * never read as phy-1 followed by "0-1".
 */
function nameChapters(text: string, titles: Map<string, string> | undefined, bareOnly = false): string {
  if (!titles?.size) return text;
  let out = text;
  for (const id of [...titles.keys()].sort((a, b) => b.length - a.length)) {
    if (!out.includes(id)) continue;
    const title = titles.get(id)!;
    const bare = `(?<![\\w:-])${escapeRe(id)}(?![\\w-])`;
    // "phy-3 (Dynamics, 22%)" reads "Dynamics (22%)", not "Dynamics (Dynamics,
    // 22%)". Left out while streaming (bareOnly), where it depends on text not
    // yet written; the finished answer, sent with the last line, has it.
    if (!bareOnly) {
      out = out
        .replace(new RegExp(`${bare} \\(${escapeRe(title)}, `, 'g'), () => `${title} (`)
        .replace(new RegExp(`${bare} \\(${escapeRe(title)}\\)`, 'g'), () => title);
    }
    out = out.replace(new RegExp(bare, 'g'), () => title);
  }
  return out;
}

async function buildStandingContext(admin: ReturnType<typeof createAdminClient>, grade: number, board: Board): Promise<string> {
  const key = `${board}:${grade}`;
  const cached = weightageDigest.get(key);
  if (cached) return cached;
  const { data, error } = await admin
    .from('chapters')
    .select('id,subject_id,number,title,exam_share,exam_marks')
    .eq('review_status', 'published')
    .eq('grade', grade)
    // The admin client skips RLS: without this a Punjab student's tutor would
    // be handed FBISE's chapter list as their syllabus, and the other way round.
    .eq('board', board)
    .order('subject_id')
    .order('number');
  /*
   * A failed read answers without the syllabus this once, and is not cached.
   * Cached, one gateway timeout left every answer from that server without
   * the chapter list, the weightings or a single chapter id, until it was
   * recycled.
   */
  if (error) {
    console.error('[tutor] weightage read failed', error.message);
    return '';
  }
  const bySubject = new Map<string, string[]>();
  chapterTitles.set(key, new Map((data ?? []).map((c) => [c.id, c.title])));
  for (const c of data ?? []) {
    /*
     * The id goes in, not just the number and title. It is what lets an answer
     * end with a button that opens the chapter: see parseTutorActions in core.
     * The model can only cite ids it has seen, and the client throws away any
     * it does not recognise, so the two together make a wrong link unlikely
     * rather than merely rare.
     */
    const line = `${c.id} · ${c.number}. ${c.title}${c.exam_share ? ` (${c.exam_share}% of the paper${c.exam_marks ? `, ~${c.exam_marks} marks` : ''})` : ''}`;
    const list = bySubject.get(c.subject_id) ?? [];
    list.push(line);
    bySubject.set(c.subject_id, list);
  }
  const parts: string[] = [];
  for (const s of SUBJECTS) {
    const lines = bySubject.get(s.id);
    if (lines?.length) parts.push(`${s.name}:\n${lines.join('\n')}`);
  }
  const digest = parts.join('\n\n');
  weightageDigest.set(key, digest);
  return digest;
}

/**
 * The two clauses of the persona that are about the board. FBISE's are the
 * original wording, unchanged. Punjab chapters carry no weightings until the
 * pairing scheme is read, so the tutor is told not to make any up.
 */
const SYLLABUS: Record<Board, { framework: string; grounding: string; site: string }> = {
  fbise: {
    framework: 'the 2022-23 National Curriculum assessment framework',
    site: 'fbise.edu.pk',
    grounding:
      "- Ground answers in the FBISE syllabus and the chapter weightings provided below. When a student asks what matters for the exam, use the board's real percentages.",
  },
  punjab: {
    framework: 'the Punjab textbooks, 2023 edition',
    site: "their own BISE board's website",
    grounding:
      '- Ground answers in the Punjab Board syllabus and the chapters provided below. Where a chapter shows its share of the paper, use it; where none is shown, do not invent one.',
  },
};

const personaFor = (grade: number, board: Board) => `You are the MatricMate tutor: a warm, patient teacher for ${BOARD_LABEL[board]} Class ${grade} students in Pakistan (SSC Part ${grade === 10 ? 'Two' : 'One'}, ${SYLLABUS[board].framework}).

How you teach:
- Answer like a good teacher at a whiteboard: short direct answer first, then the steps that get there. Numbered steps for numericals and derivations.
- Answer in the account's language, given below, whatever script the student typed in. Keep technical terms in English either way, the way Pakistani classrooms do.
${SYLLABUS[board].grounding}
- Exam craft counts: point out what examiners award marks for, common mistakes, and how many marks a question of this kind usually carries.
- Keep answers tight. A focused answer a student finishes beats a lecture they abandon. No filler, no repeated caveats.
- If a question is outside Class ${grade} study (other classes are fine to touch briefly when they help), gently steer back to the syllabus. You are a study tutor, not a general assistant: politely decline requests unrelated to studying.
- When a photo is attached, read it carefully first. If it shows a question, solve it step by step; if it shows notes or a diagram, explain it. If the photo is unreadable, say so and ask for a clearer one.
- Use web search only when the question genuinely needs current information (board dates, notifications, recent changes); the syllabus itself you already know.
- Never invent board policies, dates or marks distributions. If unsure, say so and suggest checking ${SYLLABUS[board].site}.
- Write in plain text: short paragraphs and numbered lists only. No markdown headings, no asterisks or bold markers, no tables, no LaTeX. Write fractions with / and powers with ^, the way they are typed in class notes.
- Never use an em dash. Use a comma, a colon, or a new sentence instead.

What you can look up about them:
- You can see this student's real progress with the tools you have been given: get_progress, get_weak_topics, get_recent_results, get_chapter_progress and get_today. They read the same database the app does.
- Use one when the answer depends on how they are actually doing, and when they ask about themselves. "What should I revise?", "how did I do?", "am I ready for the test?", "what should I do now?" all deserve a look rather than a guess.
- Do not use one for a plain question about the syllabus. "What is inertia" needs no lookup, and adding one only makes them wait.
- Never say that you are checking, or narrate the lookup. Answer as a teacher who already knows them.
- The numbers are theirs and are often small. Say what they mean plainly and never invent a figure you were not given. If a tool says they have barely practised, that IS the answer to "what should I revise": start.

Sending them to the right part of the app:
- The student is inside an app that holds, for every chapter below, the notes, an audio lesson, flashcards, a one-page revision sheet, and practice in four formats. When one of those is the honest next step, end your answer with an action tag on its own line and the app turns it into a button:
    [[read:<id>]]        the chapter notes
    [[audio:<id>]]       the audio lesson
    [[sheet:<id>]]       the one-page revision sheet
    [[flashcards:<id>]]  the flashcards
    [[practice:<id>]]    a practice set
    [[shortq:<id>]]      short questions
    [[blanks:<id>]]      fill in the blanks
- Use only an id that appears in the list below, exactly as written. Never invent one, and never guess at one for a chapter you cannot find: an answer with no tag is completely fine.
- Ids exist only for these tags. Students never see them and do not know them, so in your own words always call a chapter by its title: write "Dynamics", never "phy-3", and "chapters 4 to 7" rather than "math-4 to math-7".
- At most two, and only when they genuinely help. Most answers need none. A tag on every answer is nagging.
- Never mention the tag, describe it, or write "click below". It becomes a button they can see.

Chapter weightage from the board's assessment frameworks (share of the annual paper), each line starting with the chapter id (for tags only, never for your text):

`;

export async function POST(req: NextRequest) {
  /*
   * Read the body before anything that touches the network. It is free, and
   * having the question in hand means every database read below can be
   * started at once rather than discovered one at a time.
   */
  let body: {
    message?: string;
    threadId?: string;
    context?: string;
    /** Set when the question was asked from inside a chapter, so the answer
     *  can be grounded in the very notes the student is reading. */
    chapterId?: string;
    image?: { data?: string; mediaType?: string };
    profile?: { name?: string; medium?: string; language?: string; subjects?: string[]; weakTopics?: string[] };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const message = (body.message ?? '').trim().slice(0, 4000);

  let image: { data: string; media_type: (typeof IMAGE_TYPES)[number] } | null = null;
  if (body.image?.data) {
    const mediaType = IMAGE_TYPES.find((m) => m === body.image?.mediaType);
    if (!mediaType || body.image.data.length > IMAGE_MAX_CHARS) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    image = { data: body.image.data, media_type: mediaType };
  }
  if (!message && !image) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const userId = await authenticate(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // When the question was asked, which is when the student's message is dated.
  // The answer is dated when it lands, so the pair never shares a timestamp.
  const askedAt = new Date().toISOString();
  const admin = createAdminClient();
  const profile = body.profile ?? {};
  const askedFrom = (body.chapterId ?? '').slice(0, 40);

  /*
   * Everything the walls need, in one round trip instead of four.
   *
   * These used to run one after another, each waiting on the last, and with
   * the database in Mumbai and the function elsewhere that was most of a
   * second per read. A student watched five to six seconds of nothing before
   * the first word of an answer appeared, which is long enough that the
   * streaming we do have was invisible: the reply looked like it arrived in
   * one piece. None of these four reads depends on any of the others.
   */
  const [{ data: ent, error: entError }, { data: prof, error: profError }, usage, { count: lastMinute }, owned] = await Promise.all([
    admin.from('entitlements').select('active,valid_till').eq('user_id', userId).maybeSingle(),
    admin.from('profiles').select('grade,role,board,onboarding').eq('id', userId).maybeSingle(),
    admin.from('ai_usage').select('used').eq('user_id', userId).eq('day', dayKey()).maybeSingle(),
    // The abuse wall: a human student cannot ask five thoughtful questions in
    // a minute; a script can. Counted from persisted messages, so it cannot be
    // reset by reinstalling the app.
    admin
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('at', new Date(Date.now() - 60_000).toISOString()),
    // Speculative: only meaningful if they named a thread, and cheap enough to
    // ask for alongside the rest rather than in a round trip of its own.
    body.threadId
      ? admin.from('chat_threads').select('id').eq('id', body.threadId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // A read that failed is not a "no". Treated as one, a slow database told a
  // paying student they had no plan, or handed them a fresh day's allowance.
  if (entError || profError || usage.error) {
    console.error('[tutor] read failed', (entError ?? profError ?? usage.error)?.message);
    return NextResponse.json({ error: 'server_error' }, { status: 503 });
  }

  // Students only. This route does its own authentication rather than going
  // through guardAi, so it needs its own copy of the rule: a teacher's token
  // is a valid token, and a route handler has no page guard in front of it.
  if (prof?.role && prof.role !== 'student') {
    return NextResponse.json({ error: 'not_a_student' }, { status: 403 });
  }

  // Paid-only: the same wall RLS enforces on content, applied to the tutor.
  if (!planIsActive(ent)) return NextResponse.json({ error: 'plan_required' }, { status: 402 });
  // The tutor teaches the student's own class: persona, weightage and all.
  const grade = prof?.grade === 10 ? 10 : 9;
  const board = asBoard(prof?.board);

  /*
   * The student's medium and language: what the app sent, else what the
   * account has saved. The Ask AI button in the reader sends no profile at
   * all, and without this fallback every Urdu-medium student asking from
   * their notes was answered in English.
   */
  const saved = (prof?.onboarding as { medium?: string } | null)?.medium;
  const pick = (v: unknown): 'en' | 'ur' | null => (v === 'ur' || v === 'en' ? v : null);
  const medium = pick(profile.medium) ?? pick(saved) ?? 'en';
  const language = pick(profile.language) ?? pick(saved) ?? medium;
  /*
   * Asked from a chapter of a language subject, the answer is in that
   * subject's language: Urdu is taught in Urdu and English in English,
   * whatever medium the student reads in. Everything else follows the
   * account.
   */
  const answerIn = askedFrom ? subjectMedium(askedFrom, board, language) : language;

  const used = usage.data?.used ?? 0;
  const quota: QuotaState = {
    limit: AI_QUOTA.premium,
    used,
    remaining: Math.max(0, AI_QUOTA.premium - used),
    resetAt: resetAt(),
  };
  if (quota.remaining <= 0) {
    return NextResponse.json({ error: 'quota_exhausted', quota }, { status: 429 });
  }
  if ((lastMinute ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ error: 'rate_limited', quota }, { status: 429 });
  }

  // What the thread remembers about this turn. Photos are answered live but
  // not stored, so the saved history says one was here, in the student's own
  // language: it becomes the thread's title and the bubble in their history.
  const photoLabel = translate(language, 'tutor.photoQuestion');
  const persistedQuestion = message || photoLabel;
  const savedUserText = image && message ? `${photoLabel}: ${message}` : persistedQuestion;

  /*
   * The second and last round trip before the model.
   *
   * A thread the student already owns has history to read; a new one has none
   * by definition, so its row is created here instead. Either way that runs
   * beside the chapter notes and the board's weightage table rather than
   * after them.
   *
   * chapterGrounding rejects a chapter from the other class, so this cannot
   * leak Class 9 material into a Class 10 answer.
   */
  const existing = (owned as { data: { id: string } | null }).data?.id ?? null;
  const [threadResult, historyRows, grounding, standing] = await Promise.all([
    existing
      ? Promise.resolve({ id: existing })
      : admin
          .from('chat_threads')
          .insert({
            user_id: userId,
            title: persistedQuestion.length > 42 ? `${persistedQuestion.slice(0, 42)}…` : persistedQuestion,
            context_label: body.context?.slice(0, 120) ?? null,
          })
          .select('id')
          .single()
          .then(({ data, error }) => {
            if (error) console.error('[tutor] could not start a thread', error.message);
            return data;
          }),
    /*
     * The LATEST messages, newest first and then turned the right way round.
     * Ascending with a limit gave the model the first six exchanges forever,
     * so from the seventh on "simpler please" simplified an answer from the
     * start of the thread. Role breaks a tie for pairs saved before the two
     * sides were dated apart: newest first, the answer comes before its
     * question.
     */
    existing
      ? admin
          .from('chat_messages')
          .select('role,content')
          .eq('thread_id', existing)
          .order('at', { ascending: false })
          .order('role', { ascending: true })
          .limit(HISTORY_TURNS)
          .then(({ data }) => (data ?? []).reverse())
      : Promise.resolve([] as { role: string; content: string }[]),
    /*
     * When the student asks from a chapter (the Ask AI buttons on MCQs, short
     * questions, blanks and the reader all pass its id), the tutor reads that
     * chapter's own published notes before answering. Same wording as the
     * screen they came from, instead of a generic recital of the topic.
     */
    askedFrom
      ? chapterGrounding(admin, askedFrom, subjectMedium(askedFrom, board, medium), 12_000, grade, board).catch((e): Grounding | null => {
          // Answer without the notes rather than not at all.
          console.error('[tutor] grounding failed', e instanceof Error ? e.message : e);
          return null;
        })
      : null,
    buildStandingContext(admin, grade, board),
  ]);

  const thread = threadResult?.id ?? null;
  if (!thread) return NextResponse.json({ error: 'server_error' }, { status: 500 });
  const newThread = !existing;

  /*
   * A thread made for this question but never answered is deleted again.
   * Left behind, every failed first question put an empty chat in Recent
   * chats, and every retry added another. The id never reached the student,
   * so nothing on their screen points at it.
   */
  const dropEmptyThread = async () => {
    if (!newThread) return;
    const { error } = await admin.from('chat_threads').delete().eq('id', thread).eq('user_id', userId);
    if (error) console.error('[tutor] could not remove an unanswered thread', error.message);
  };

  const studentBlock = [
    'About this student:',
    profile.name ? `- Name: ${profile.name}` : null,
    `- Study medium: ${medium === 'ur' ? 'Urdu' : 'English'}`,
    `- Answer them in this language: ${languageRule(answerIn, grade, board)}`,
    profile.subjects?.length ? `- Their subjects: ${profile.subjects.join(', ')}` : null,
    /* Their weak topics used to be listed here, three of them, chosen by the
       client and pushed into every question whether it needed them or not.
       get_weak_topics answers the same thing on demand, from the whole record
       rather than the top three, and freshly rather than from whatever the app
       had computed when the screen last rendered. */
    body.context ? `- They are asking from: ${body.context.slice(0, 300)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  /*
   * A chapter with no notes of ours still names what they are studying. The
   * tutor knows the syllabus; withholding the chapter title just because we
   * have no text for it would make the answer vaguer than it needs to be.
   */
  const groundingBlock = !grounding
    ? ''
    : grounding.grounded
      ? `\n\nTHE CHAPTER THEY ARE STUDYING (${grounding.title}). Answer from this text where it applies, and use its wording and symbols so the answer matches their notes:\n${grounding.text}`
      : `\n\nTHE CHAPTER THEY ARE STUDYING: ${grounding.title}. We have no notes on file for it, so answer from the ${BOARD_LABEL[board]} Class ${grade} syllabus for that chapter and stay inside its scope.`;

  const userContent: Anthropic.ContentBlockParam[] = [];
  if (image) userContent.push({ type: 'image', source: { type: 'base64', ...image } });
  userContent.push({ type: 'text', text: message || 'Solve or explain what is in this photo, step by step.' });

  // The window can open on an answer whose question fell outside it, and a
  // conversation sent to the model has to start with the student.
  const history = [...(historyRows ?? [])];
  while (history.length && history[0].role !== 'user') history.shift();
  const turns: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userContent },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (line: object) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      try {
        let text = '';
        /*
         * The turn can come back unfinished for two reasons, and both resume
         * the same way: by appending what the model produced and asking again.
         *
         * A server-side web search pauses it. A tool call ends it with
         * stop_reason 'tool_use', and the answer only continues once the
         * results go back as a user turn. Bounded at five rounds so a model
         * that keeps calling tools cannot spin the route forever; in practice
         * an answer needs none or one.
         */
        let stopReason: string | null = null;
        /*
         * What the student watches arrive, with chapter ids already turned
         * into titles. The prompt forbids ids in prose and the model still
         * writes one now and then, which showed as "math-4" for the seconds
         * the answer took. Each delta sends the cleaned text so far, less the
         * word still being written (an id can arrive in two pieces), and the
         * rest goes out when the model stops. Swapping a bare id is local to
         * that word, so what has been sent never changes afterwards.
         */
        const titles = chapterTitles.get(`${board}:${grade}`);
        let sent = 0;
        const streamClean = (flush = false) => {
          const hold = flush ? 0 : (text.match(/[\w-]*$/)?.[0].length ?? 0);
          const clean = nameChapters(text.slice(0, text.length - hold), titles, true);
          if (clean.length > sent) {
            emit({ t: 'delta', text: clean.slice(sent) });
            sent = clean.length;
          }
        };
        for (let round = 0; round < 5; round++) {
          const s = anthropic.messages.stream({
            model: TUTOR_MODEL,
            max_tokens: MAX_ANSWER_TOKENS,
            output_config: { effort: 'low' },
            system: [
              // Stable bytes first with the cache breakpoint, volatile
              // student block after it, so the big block caches across
              // every student.
              { type: 'text', text: personaFor(grade, board) + standing, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: studentBlock + groundingBlock },
            ],
            tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }, ...TUTOR_TOOLS],
            messages: turns,
          });
          s.on('text', (delta) => {
            text += delta;
            streamClean();
          });
          const final = await s.finalMessage();
          stopReason = final.stop_reason;

          if (stopReason === 'tool_use') {
            /*
             * Run every tool the model asked for, in parallel: they are
             * independent reads and a student is waiting. The user id comes
             * from the session this route already authenticated and is never
             * taken from the model's arguments, which is the whole security of
             * these tools.
             */
            const calls = final.content.filter((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
            const results = await Promise.all(
              calls.map(async (c) => ({
                type: 'tool_result' as const,
                tool_use_id: c.id,
                content: JSON.stringify(await runTutorTool(c.name, c.input, userId)),
              })),
            );
            turns.push({ role: 'assistant', content: final.content });
            turns.push({ role: 'user', content: results });
            continue;
          }

          if (stopReason !== 'pause_turn') break;
          turns.push({ role: 'assistant', content: final.content });
        }

        streamClean(true);

        if (stopReason === 'refusal') {
          await dropEmptyThread();
          emit({ t: 'err', reason: 'refused', quota });
          controller.close();
          return;
        }
        const answer = nameChapters(text.trim(), chapterTitles.get(`${board}:${grade}`));
        if (!answer) {
          await dropEmptyThread();
          emit({ t: 'err', reason: 'error', quota });
          controller.close();
          return;
        }

        // Persist both sides, bump the thread, charge the quota. Charged
        // only after a delivered answer: a failed request must not cost a
        // question.
        /*
         * The assistant row's id comes back, and it matters.
         *
         * Both apps let a student rate an answer, and both refuse to write a
         * rating for a message id the server never minted, which is right: the
         * table has a foreign key. But a freshly streamed answer only had the
         * client's own local id, so the thumbs latched, the toast said noted,
         * and tutor_feedback stayed empty across every account. The only
         * ratable answers were ones reopened from history, which is not how
         * anybody rates anything.
         */
        /*
         * The answer is already on the student's screen, so a write that
         * fails here is logged rather than turned into an error they would
         * read as "your question failed". It still costs the question: it was
         * answered.
         */
        const answeredAt = new Date().toISOString();
        const { data: savedRows, error: saveError } = await admin
          .from('chat_messages')
          .insert([
            { thread_id: thread, user_id: userId, role: 'user', content: savedUserText, at: askedAt },
            { thread_id: thread, user_id: userId, role: 'assistant', content: answer, at: answeredAt },
          ])
          .select('id,role');
        if (saveError) console.error('[tutor] could not save the exchange', saveError.message);
        const messageId = savedRows?.find((m) => m.role === 'assistant')?.id ?? null;
        const { error: bumpError } = await admin.from('chat_threads').update({ updated_at: answeredAt }).eq('id', thread);
        if (bumpError) console.error('[tutor] could not bump the thread', bumpError.message);
        const usedNow = (await addUsage(admin, userId, 1)) ?? quota.used + 1;

        emit({
          t: 'done',
          // The finished answer, which can differ from the streamed pieces:
          // see nameChapters. Both apps show this in place of what streamed.
          text: answer,
          threadId: thread,
          messageId,
          quota: { ...quota, used: usedNow, remaining: Math.max(0, quota.limit - usedNow) },
        });
        controller.close();
      } catch (e) {
        console.error('[tutor]', e instanceof Error ? e.message : e);
        await dropEmptyThread();
        try {
          emit({ t: 'err', reason: 'error', quota });
          controller.close();
        } catch {
          controller.error(e);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      // Vercel and some proxies buffer unless told not to.
      'x-accel-buffering': 'no',
    },
  });
}
