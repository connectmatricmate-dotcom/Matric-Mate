import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_COST, AI_MODEL, chargeQuota, guardAi, weekKey } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';

/**
 * The weekly coach: one short, personal report per student per week. The
 * client sends a compact digest of the week (accuracy by topic, streak, xp)
 * because the phone already computes all of it for the progress screens;
 * the server writes the report once and caches it in coach_reports, so the
 * dashboard card costs one model call a week, not one per visit. A cached
 * week is free and does not touch the quota.
 */
export const maxDuration = 120;

const anthropic = new Anthropic();

const REPORT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    weak: {
      type: 'array',
      items: {
        type: 'object',
        properties: { topic: { type: 'string' }, why: { type: 'string' } },
        required: ['topic', 'why'],
        additionalProperties: false,
      },
    },
    actions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'weak', 'actions'],
  additionalProperties: false,
};

/**
 * The card reads through here and never generates.
 *
 * Generation moved to the nightly cron (/api/cron/coach), because having the
 * dashboard trigger it meant whoever opened it first waited on a model call to
 * see their own home screen. Reading is free, costs no quota, and returns null
 * rather than an error when there is no report yet: a student with no history
 * has nothing to report on, and the card says something welcoming instead.
 */
export async function GET(req: NextRequest) {
  const g = await guardAi(req, 0);
  if (g instanceof NextResponse) return g;
  const { data } = await g.admin
    .from('coach_reports')
    .select('body,period')
    .eq('user_id', g.userId)
    .order('period', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ report: data?.body ?? null, period: data?.period ?? null, quota: g.quota });
}

export async function POST(req: NextRequest) {
  const g = await guardAi(req, AI_COST.coach);
  if (g instanceof NextResponse) return g;

  const week = weekKey();
  const { data: cached } = await g.admin
    .from('coach_reports')
    .select('body')
    .eq('user_id', g.userId)
    .eq('period', week)
    .maybeSingle();
  if (cached) return NextResponse.json({ report: cached.body, cached: true, quota: g.quota });

  let body: {
    digest?: {
      streak?: number;
      xp?: number;
      attemptsThisWeek?: number;
      accuracyPct?: number;
      topics?: { topic: string; pct: number; tries: number }[];
      subjects?: string[];
      language?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const d = body.digest ?? {};
  const topics = (d.topics ?? []).slice(0, 20).map((t) => ({
    topic: String(t.topic).slice(0, 120),
    pct: Math.round(Number(t.pct) || 0),
    tries: Math.round(Number(t.tries) || 0),
  }));

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1200,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: REPORT_SCHEMA } },
      system:
        `You are a study coach for an FBISE Class ${g.grade} (SSC-${g.grade === 10 ? 'II' : 'I'}) student in Pakistan. From their week of practice data, write: summary (2 warm, specific sentences about the week; if they did nothing, a kind nudge, never a scolding), weak (their 2 weakest topics with one plain-words sentence each on why it matters for the board paper), actions (exactly 3 short, concrete things to do this week, each doable in one sitting). Plain text only: no markdown headings, no asterisks or bold markers, no tables, no code fences. Never use an em dash; use a comma, a colon, or a new sentence. ` +
        languageRule(d.language),
      messages: [
        {
          role: 'user',
          content: `This week: ${d.attemptsThisWeek ?? 0} questions attempted, ${d.accuracyPct ?? 0}% correct overall, streak ${d.streak ?? 0} days, total XP ${d.xp ?? 0}. Subjects: ${(d.subjects ?? []).join(', ') || 'unknown'}.\n\nAccuracy by topic (worst first):\n${topics.map((t) => `- ${t.topic}: ${t.pct}% over ${t.tries} tries`).join('\n') || '(no topic data yet)'}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'refused', quota: g.quota }, { status: 200 });
    }
    const block = response.content.find((b) => b.type === 'text');
    if (!block) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    const report = JSON.parse(block.text);

    await g.admin.from('coach_reports').upsert({ user_id: g.userId, period: week, body: report }, { onConflict: 'user_id,period' });
    const quota = await chargeQuota(g, AI_COST.coach);
    return NextResponse.json({ report, cached: false, quota });
  } catch (e) {
    console.error('[coach]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }
}
