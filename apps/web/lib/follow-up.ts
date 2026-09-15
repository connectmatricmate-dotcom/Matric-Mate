import 'server-only';
import { normaliseMobile } from '@matricmate/core';
import { plansLink } from '@/lib/signin-link';
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
    const message = `Assalam o Alaikum ${first}, your MatricMate ${trial ? 'free trial' : 'plan'} ${ended ? 'ended' : 'ends'} on ${when(r.till)}. You can ${trial ? 'choose a plan' : 'renew'} here, it signs you in: ${plansLink(r.id)}`;
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
