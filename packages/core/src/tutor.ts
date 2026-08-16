/**
 * The client half of the real tutor and its sibling AI routes.
 *
 * Both apps talk to the same server routes on the website, which hold the
 * Anthropic key, inject the student's context, and enforce the plan check,
 * the daily quota and the rate limit. This file is just the typed doorway:
 * configure it once at startup with where the server lives and how to get
 * the caller's access token, then call from anywhere.
 *
 * Answers STREAM. The tutor route emits NDJSON lines: {"t":"delta"} while
 * the model writes, then one {"t":"done"} or {"t":"err"}. askTutorLive reads
 * them incrementally when the runtime can (browser fetch, expo/fetch) and
 * falls back to reading the whole body when it cannot; the parsing is the
 * same either way, so no platform gets a different protocol.
 */

export type TutorQuota = { limit: number; used: number; remaining: number; resetAt: string };

export type TutorProfile = {
  name?: string;
  medium?: string;
  language?: string;
  subjects?: string[];
  weakTopics?: string[];
};

export type TutorImage = { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };

export type TutorReply =
  | { ok: true; text: string; threadId: string; quota: TutorQuota }
  | { ok: false; reason: 'offline' | 'quota' | 'rate' | 'plan' | 'refused' | 'error'; quota?: TutorQuota };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type TutorConfig = {
  /** Where the web app lives, e.g. https://matricmate.vercel.app. Empty string means same-origin. */
  siteUrl: string;
  /** Returns the caller's Supabase access token, or null on the web where cookies carry auth. */
  getToken: () => Promise<string | null>;
  /**
   * The fetch to use. React Native's built-in fetch cannot expose a response
   * body reader, so the app passes expo/fetch here and streaming works; left
   * unset, the global fetch is used and answers arrive in one piece.
   */
  fetchImpl?: FetchLike;
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

const doFetch: FetchLike = (url, init) => (config?.fetchImpl ?? fetch)(url, init);

function failFrom(status: number, body: { error?: string; quota?: TutorQuota }): TutorReply {
  if (status === 402) return { ok: false, reason: 'plan' };
  if (status === 429) return { ok: false, reason: body.error === 'rate_limited' ? 'rate' : 'quota', quota: body.quota };
  return { ok: false, reason: 'error', quota: body.quota };
}

export async function askTutorLive(
  input: {
    message: string;
    threadId?: string | null;
    context?: string;
    /** The chapter the question came from. The server reads that chapter's
     *  own notes so the answer matches what the student is looking at. */
    chapterId?: string;
    profile?: TutorProfile;
    image?: TutorImage;
  },
  /** Called with the answer-so-far as it grows. Optional; omit for one-shot. */
  onDelta?: (textSoFar: string) => void,
): Promise<TutorReply> {
  if (!config) return { ok: false, reason: 'offline' };
  try {
    const res = await doFetch(`${config.siteUrl}/api/ai/tutor`, {
      method: 'POST',
      headers: await headers(),
      credentials: 'include',
      body: JSON.stringify({
        message: input.message,
        threadId: input.threadId ?? undefined,
        context: input.context,
        chapterId: input.chapterId,
        profile: input.profile,
        image: input.image ? { data: input.image.data, mediaType: input.image.mediaType } : undefined,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; quota?: TutorQuota };
      return failFrom(res.status, body);
    }

    // The walls answer as plain JSON; only a live model turn streams NDJSON.
    if (!(res.headers.get('content-type') ?? '').includes('ndjson')) {
      const body = (await res.json().catch(() => ({}))) as {
        text?: string;
        threadId?: string;
        quota?: TutorQuota;
        error?: string;
      };
      if (body.text && body.threadId && body.quota) {
        return { ok: true, text: body.text, threadId: body.threadId, quota: body.quota };
      }
      return failFrom(res.status, body);
    }

    let text = '';
    let finale: TutorReply | null = null;
    const handleLine = (line: string) => {
      if (!line.trim()) return;
      let msg: { t?: string; text?: string; threadId?: string; quota?: TutorQuota; reason?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.t === 'delta' && msg.text) {
        text += msg.text;
        onDelta?.(text);
      } else if (msg.t === 'done' && msg.threadId && msg.quota) {
        finale = { ok: true, text: text.trim(), threadId: msg.threadId, quota: msg.quota };
      } else if (msg.t === 'err') {
        finale = { ok: false, reason: (msg.reason as 'refused' | 'error') ?? 'error', quota: msg.quota };
      }
    };

    const reader = res.body?.getReader?.();
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) handleLine(line);
      }
      handleLine(buffer);
    } else {
      // No streaming on this runtime: same protocol, read in one piece.
      for (const line of (await res.text()).split('\n')) handleLine(line);
    }

    return finale ?? { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

export async function fetchTutorQuota(): Promise<TutorQuota | null> {
  if (!config) return null;
  try {
    const res = await doFetch(`${config.siteUrl}/api/ai/quota`, { headers: await headers(), credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as TutorQuota;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- AI actions */

export type AiFail = { ok: false; reason: 'offline' | 'quota' | 'rate' | 'plan' | 'refused' | 'error'; quota?: TutorQuota };

/**
 * Shared POST for the non-chat AI routes (session builder, answer checker,
 * mock paper, coach, cheat sheet). They all answer plain JSON and share the
 * same failure vocabulary as the tutor.
 */
export async function aiPost<T>(path: string, payload: object): Promise<{ ok: true; data: T } | AiFail> {
  if (!config) return { ok: false, reason: 'offline' };
  try {
    const res = await doFetch(`${config.siteUrl}${path}`, {
      method: 'POST',
      headers: await headers(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; quota?: TutorQuota };
    if (res.ok) return { ok: true, data: body };
    if (body.error === 'refused') return { ok: false, reason: 'refused', quota: body.quota };
    const fail = failFrom(res.status, body);
    return { ok: false, reason: fail.ok ? 'error' : fail.reason, quota: fail.ok ? undefined : fail.quota };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}
