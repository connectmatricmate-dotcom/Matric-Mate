/**
 * The client half of the real tutor.
 *
 * Both apps talk to the same server route on the website, which holds the
 * Anthropic key, injects the student's context, and enforces the plan check,
 * the daily quota and the rate limit. This file is just the typed doorway:
 * configure it once at startup with where the server lives and how to get
 * the caller's access token, then askTutor() from anywhere.
 */

export type TutorQuota = { limit: number; used: number; remaining: number; resetAt: string };

export type TutorProfile = {
  name?: string;
  medium?: string;
  language?: string;
  subjects?: string[];
  weakTopics?: string[];
};

export type TutorReply =
  | { ok: true; text: string; threadId: string; quota: TutorQuota }
  | { ok: false; reason: 'offline' | 'quota' | 'rate' | 'plan' | 'refused' | 'error'; quota?: TutorQuota };

type TutorConfig = {
  /** Where the web app lives, e.g. https://matricmate.vercel.app. Empty string means same-origin. */
  siteUrl: string;
  /** Returns the caller's Supabase access token, or null on the web where cookies carry auth. */
  getToken: () => Promise<string | null>;
};

let config: TutorConfig | null = null;

export function configureTutor(next: TutorConfig): void {
  config = next;
}

export const tutorConfigured = (): boolean => config !== null;

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const token = config ? await config.getToken() : null;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export async function askTutorLive(input: {
  message: string;
  threadId?: string | null;
  context?: string;
  profile?: TutorProfile;
}): Promise<TutorReply> {
  if (!config) return { ok: false, reason: 'offline' };
  try {
    const res = await fetch(`${config.siteUrl}/api/ai/tutor`, {
      method: 'POST',
      headers: await headers(),
      credentials: 'include',
      body: JSON.stringify({
        message: input.message,
        threadId: input.threadId ?? undefined,
        context: input.context,
        profile: input.profile,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      text?: string;
      threadId?: string;
      quota?: TutorQuota;
      error?: string;
    };
    if (res.ok && body.text && body.threadId && body.quota) {
      return { ok: true, text: body.text, threadId: body.threadId, quota: body.quota };
    }
    if (res.status === 402) return { ok: false, reason: 'plan' };
    if (res.status === 429) return { ok: false, reason: body.error === 'rate_limited' ? 'rate' : 'quota', quota: body.quota };
    if (body.error === 'refused') return { ok: false, reason: 'refused', quota: body.quota };
    return { ok: false, reason: 'error', quota: body.quota };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

export async function fetchTutorQuota(): Promise<TutorQuota | null> {
  if (!config) return null;
  try {
    const res = await fetch(`${config.siteUrl}/api/ai/quota`, { headers: await headers(), credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as TutorQuota;
  } catch {
    return null;
  }
}
