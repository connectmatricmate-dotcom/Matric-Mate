import { quotaUser, setQuota } from './quota';
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
  /** `messageId` is the row the server saved the answer as. Null on the
   *  non-streaming path. It is what makes an answer ratable: see the note in
   *  the tutor route about tutor_feedback sitting empty. */
  | { ok: true; text: string; threadId: string; messageId: string | null; quota: TutorQuota }
  | { ok: false; reason: 'offline' | 'quota' | 'rate' | 'plan' | 'refused' | 'syllabus' | 'error'; quota?: TutorQuota };

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

/**
 * `who` is the account the request went out for (quotaUser at the start), so
 * a reply that lands after a sign-out cannot write its count over the next
 * student's. See setQuota.
 */
function failFrom(status: number, body: { error?: string; quota?: TutorQuota }, who?: string | null): TutorReply {
  // A refusal still spent the student's allowance, and the server says so.
  setQuota(body.quota, who);
  if (body.error === 'refused') return { ok: false, reason: 'refused', quota: body.quota };
  if (status === 402) return { ok: false, reason: 'plan' };
  // A chapter from outside the student's class or board: another try cannot
  // help, so it gets its own reason and its own words.
  if (body.error === 'not_in_syllabus') return { ok: false, reason: 'syllabus' };
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
  const who = quotaUser();
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
      return failFrom(res.status, body, who);
    }

    // The walls answer as plain JSON; only a live model turn streams NDJSON.
    if (!(res.headers.get('content-type') ?? '').includes('ndjson')) {
      const body = (await res.json().catch(() => ({}))) as {
        text?: string;
        threadId?: string;
        quota?: TutorQuota;
        error?: string;
      };
      if (!body.error && body.text && body.threadId && body.quota) {
        setQuota(body.quota, who);
        return { ok: true, text: body.text, threadId: body.threadId, messageId: null, quota: body.quota };
      }
      return failFrom(res.status, body, who);
    }

    let text = '';
    let finale: TutorReply | null = null;
    const handleLine = (line: string) => {
      if (!line.trim()) return;
      let msg: { t?: string; text?: string; threadId?: string; messageId?: string | null; quota?: TutorQuota; reason?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.t === 'delta' && msg.text) {
        text += msg.text;
        onDelta?.(text);
      } else if (msg.t === 'done' && msg.threadId && msg.quota) {
        setQuota(msg.quota, who);
        // The server's finished text when it sends one: it tidies the answer
        // after streaming (chapter ids back into titles), and the tidy copy
        // is the one saved to history.
        const final = typeof msg.text === 'string' && msg.text.trim() ? msg.text.trim() : text.trim();
        finale = { ok: true, text: final, threadId: msg.threadId, messageId: msg.messageId ?? null, quota: msg.quota };
      } else if (msg.t === 'err') {
        setQuota(msg.quota, who);
        finale = { ok: false, reason: msg.reason === 'refused' ? 'refused' : 'error', quota: msg.quota };
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
  const who = quotaUser();
  try {
    const res = await doFetch(`${config.siteUrl}/api/ai/quota`, { headers: await headers(), credentials: 'include' });
    if (!res.ok) return null;
    const quota = (await res.json()) as TutorQuota;
    setQuota(quota, who);
    return quota;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- AI actions */

export type AiFail = { ok: false; reason: 'offline' | 'quota' | 'rate' | 'plan' | 'refused' | 'syllabus' | 'error'; quota?: TutorQuota };

/**
 * How long one of these may hang before the client stops waiting.
 *
 * Nothing bounded these. The routes allow themselves five minutes and a
 * dropped connection on a phone can leave a fetch pending for longer than
 * that, so a student who tapped "Make my set" on bad signal met a full screen
 * with no cancel, no timeout and no way back: force-stopping the app was the
 * only way out. A set takes twenty to forty seconds of real work, so ninety is
 * generous enough not to cut off an honest answer and short enough that
 * nobody is stuck.
 *
 * Aborting here does not stop the server, which is the right trade: it
 * finishes and saves the set, so the work is waiting on the sets shelf rather
 * than lost.
 */
const AI_DEADLINE_MS = 90_000;

/**
 * Runs a request with that deadline, and with whatever the caller wants to
 * cancel it early (a back press, a Cancel button).
 */
async function withDeadline(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  const timer = setTimeout(stop, AI_DEADLINE_MS);
  signal?.addEventListener('abort', stop);
  try {
    return await doFetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/**
 * A reply as the screens should see it. An `error` in the body is a failure
 * whatever the status: the routes send a model's refusal as a 200 carrying
 * `{error:'refused'}`, and treating that as success handed screens a body with
 * no set, no paper and no verdict in it. The short-question screen crashed on
 * `verdict.missed`, an MCQ build threw inside its click handler, and a mock
 * paper opened `?id=undefined`.
 */
function settle<T>(res: Response, body: T & { error?: string; quota?: TutorQuota }, who: string | null | undefined): { ok: true; data: T } | AiFail {
  if (res.ok && !body.error) {
    // The server's count rides on success too, and nothing else recorded it:
    // the number only moved when the realtime broadcast happened to arrive.
    setQuota(body.quota, who);
    return { ok: true, data: body };
  }
  const fail = failFrom(res.status, body, who);
  return { ok: false, reason: fail.ok ? 'error' : fail.reason, quota: fail.ok ? undefined : fail.quota };
}

/**
 * Shared POST for the non-chat AI routes (session builder, answer checker,
 * mock paper, coach, cheat sheet). They all answer plain JSON and share the
 * same failure vocabulary as the tutor.
 */
export async function aiPost<T>(
  path: string,
  payload: object,
  /** Aborts the wait early. The screen's cancel, not the server's. */
  signal?: AbortSignal,
): Promise<{ ok: true; data: T } | AiFail> {
  if (!config) return { ok: false, reason: 'offline' };
  const who = quotaUser();
  try {
    const res = await withDeadline(
      `${config.siteUrl}${path}`,
      {
        method: 'POST',
        headers: await headers(),
        credentials: 'include',
        body: JSON.stringify(payload),
      },
      signal,
    );
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; quota?: TutorQuota };
    return settle(res, body, who);
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

/** GET twin of aiPost, for the AI reads that cost nothing. */
export async function aiGet<T>(path: string): Promise<{ ok: true; data: T } | AiFail> {
  if (!config) return { ok: false, reason: 'offline' };
  const who = quotaUser();
  try {
    const res = await withDeadline(`${config.siteUrl}${path}`, { headers: await headers(), credentials: 'include' });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; quota?: TutorQuota };
    return settle(res, body, who);
  } catch {
    return { ok: false, reason: 'offline' };
  }
}
