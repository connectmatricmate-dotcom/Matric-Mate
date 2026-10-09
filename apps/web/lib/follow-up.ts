import 'server-only';
import { normaliseMobile } from '@matricmate/core';
import { accountLines } from '@/lib/manual-pay';
import { THE_PLAN, rupees } from '@/lib/plans';
import { requireAdmin } from '@/lib/roles';
import { plansLink } from '@/lib/signin-link';
import { SITE_URL } from '@/lib/site';
import { allStudents } from '@/lib/students';
import { createAdminClient } from '@/lib/supabase/admin';

const DAY = 24 * 60 * 60 * 1000;
/** Ended this recently, or ending this soon, is worth a message. */
const BACK = 14 * DAY;
const AHEAD = 3 * DAY;

const when = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });

export type FollowUp = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  ended: boolean;
  /** The plans job has already reminded them about this end date. */
  reminded: boolean;
  /** wa.me address with the message written, or null with no usable number. */
  whatsapp: string | null;
};

/**
 * Students whose free trial or plan has ended in the last two weeks or ends in
 * the next three days, most recent first, each with a WhatsApp message ready:
 * the personal follow-up the app itself may not make (core/billing.ts). The
 * link in it signs the student in on the plans page (lib/signin-link.ts).
 */
export async function followUps(): Promise<FollowUp[]> {
  const now = Date.now();
  const rows = (await allStudents())
    .filter((r) => r.plan && r.validTill)
    .map((r) => ({ ...r, till: Date.parse(r.validTill as string) }))
    .filter((r) => Number.isFinite(r.till) && r.till > now - BACK && r.till < now + AHEAD)
    .sort((a, b) => Math.abs(a.till - now) - Math.abs(b.till - now));

  const reminded = new Set<string>();
  if (rows.length) {
    const { data } = await createAdminClient()
      .from('plan_notices')
      .select('user_id, until')
      .in('user_id', rows.map((r) => r.id));
    for (const n of (data ?? []) as { user_id: string; until: string }[]) reminded.add(`${n.user_id}|${Date.parse(n.until)}`);
  }

  return rows.map((r) => {
    const ended = r.till <= now;
    const trial = r.plan === 'trial';
    const first = r.name.trim().split(/\s+/)[0] || 'there';
    const message = `Assalam o Alaikum ${first}, your MatricMate ${trial ? 'free trial' : 'plan'} ${ended ? 'ended' : 'ends'} on ${when(r.till)}. You can ${trial ? 'choose a plan' : 'renew'} here, it signs you in: ${plansLink(r.id) ?? `${SITE_URL}/login?next=/upgrade`}`;
    const phone = r.phone ? normaliseMobile(r.phone) : null;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      status: `${trial ? 'Free trial' : 'Plan'} ${ended ? 'ended' : 'ends'} ${when(r.till)}`,
      ended,
      reminded: reminded.has(`${r.id}|${r.till}`),
      whatsapp: phone ? `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}` : null,
    };
  });
}

export type PlanRequestRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  /** "15 Sep, 11:47 pm", Karachi time. */
  at: string;
  /** Minutes since the request, for "waiting 12 min". */
  waitingMin: number;
  via: 'web' | 'app';
  /** On Basic now, so Premium is an upgrade rather than a new plan. */
  onBasic: boolean;
  /** wa.me address with the payment details written, or null with no usable number. */
  whatsapp: string | null;
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' });

/**
 * Students waiting for Premium (lib/plan-requests.ts), oldest first: each was
 * promised it within 5 minutes of paying. The WhatsApp message carries the
 * payment details, because a request from the Android app has never seen them.
 */
export async function pendingPlanRequests(): Promise<PlanRequestRow[]> {
  // The service key reads every request: the admin door first (lib/roles).
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from('plan_requests')
    .select('id, user_id, created_at, via')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('follow-up: plan requests read failed', error.message);
    throw new Error('Could not load the plan requests.');
  }
  if (!data?.length) return [];

  const students = new Map((await allStudents()).map((s) => [s.id, s]));
  const now = Date.now();
  return (data as { id: string; user_id: string; created_at: string; via: string }[]).map((r) => {
    const s = students.get(r.user_id);
    const first = s?.name.trim().split(/\s+/)[0] || 'there';
    const message = `Assalam o Alaikum ${first}, thank you for choosing MatricMate Premium. Please send ${rupees(THE_PLAN.price)} to any one of these accounts:\n\n${accountLines()}\n\nThen send the screenshot of the payment here, and your Premium will be switched on within 5 minutes.`;
    const phone = s?.phone ? normaliseMobile(s.phone) : null;
    const onBasic = !!s && s.active && s.plan === 'basic' && !!s.validTill && Date.parse(s.validTill) > now;
    return {
      id: r.id,
      userId: r.user_id,
      name: s?.name || 'Unknown student',
      email: s?.email ?? '',
      phone: s?.phone ?? null,
      at: stamp(r.created_at),
      waitingMin: Math.max(0, Math.round((now - Date.parse(r.created_at)) / 60_000)),
      via: r.via === 'app' ? 'app' : 'web',
      onBasic,
      whatsapp: phone ? `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}` : null,
    };
  });
}

/** How many students are waiting for Premium, for the overview; null when it could not be read. */
export async function pendingPlanRequestCount(): Promise<number | null> {
  // The service key reads every request: the admin door first (lib/roles).
  await requireAdmin();
  const { count, error } = await createAdminClient().from('plan_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (error) {
    console.error('follow-up: plan request count failed', error.message);
    return null;
  }
  return count ?? 0;
}
