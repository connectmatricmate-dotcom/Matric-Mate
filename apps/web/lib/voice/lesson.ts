import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * The premium voice (ElevenLabs) for the lessons where pronunciation has to be
 * exactly right: Islamiyat, the Urdu subject, and any other lesson with
 * Islamic content (scripts/voice-scope.mjs decides which, migration 0044).
 *
 * A lesson is made the first time a student plays it, in parts, and each part
 * is streamed to them as it is made, so the first words arrive in a couple of
 * seconds rather than after the whole ten minutes. Every part is kept; when
 * the last one is done the parts are joined into one file and the lesson's
 * track row points at it, so every later listener, on either app and on any
 * app version, plays an ordinary file and nothing is generated twice.
 */

type Admin = ReturnType<typeof createAdminClient>;
export type Medium = 'en' | 'ur';

export type VoiceSettings = {
  enabled: boolean;
  voiceUr: string | null;
  voiceEn: string | null;
  model: string;
  /** The month's allowance in ElevenLabs credits (the column's name predates the difference). */
  monthlyChars: number;
};

export type Part = { n: number; text: string; hash: string };

/** A part's audio as made, and the credits it cost. */
export type Spoken = { bytes: Uint8Array; cost: number };

export type PartRow = { part: number; text_hash: string; status: string; storage_path: string | null; bytes: number | null };

export type Lesson = {
  chapter: string;
  medium: Medium;
  voiceId: string;
  model: string;
  /** Voice and model together, short: the key every part and the final file are filed under. */
  key: string;
  parts: Part[];
  rows: Map<number, PartRow>;
  /** The track row still waits for this voice (false once the joined file is in place). */
  pending: boolean;
  /** Where the finished lesson is saved (the track row's storage_path), once it is. */
  path: string | null;
};

/**
 * 64 kbps: clearer than the current recordings (48 kbps) for a third more
 * data, where 128 would have been nearly three times the download for a
 * voice nobody could tell apart. Constant bitrate, so 8,000 bytes a second.
 */
export const OUTPUT_FORMAT = 'mp3_44100_64';
export const BYTES_PER_SEC = 8_000;
/** Until a lesson has a part to measure: how many characters a second it is read at (Alice on v3 read Urdu at 14). */
const CHARS_PER_SEC = 14;

export const BUCKET = 'audio';
/**
 * Parts in the making live in a private bucket of their own: only this
 * server ever reads them back. They sat in the public lesson bucket under
 * predictable names, so a part could be fetched by anyone who guessed it.
 */
export const PARTS_BUCKET = 'voice-parts';
const API = 'https://api.elevenlabs.io';

export async function readSettings(admin: Admin): Promise<VoiceSettings | null> {
  const { data, error } = await admin.from('voice_settings').select('enabled, voice_ur, voice_en, model, monthly_chars').maybeSingle();
  if (error || !data) return null;
  return {
    enabled: !!data.enabled,
    voiceUr: (data.voice_ur as string | null) ?? null,
    voiceEn: (data.voice_en as string | null) ?? null,
    model: String(data.model || 'eleven_v3'),
    monthlyChars: Number(data.monthly_chars) || 0,
  };
}

/** Whether the voice can be used at all: switched on, a voice chosen, and the key in this deployment. */
export function voiceReady(s: VoiceSettings | null, medium: Medium): s is VoiceSettings {
  return !!s && s.enabled && !!process.env.ELEVENLABS_API_KEY && !!(medium === 'ur' ? s.voiceUr : (s.voiceEn ?? s.voiceUr));
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * A storage or database write, tried again after a blip. A part is paid for
 * by the time it is saved, and one dropped connection used to throw it away
 * (a local run lost one this way, 15 Sep 2026).
 */
async function persist<T extends { error: { message: string } | null }>(what: string, write: () => PromiseLike<T>): Promise<T> {
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await write();
      if (!res.error) return res;
      last = res.error.message;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(`${what} failed: ${last}`);
}

/**
 * The narration cut into parts: a short first one, so the first words come
 * quickly, then about 1,400 characters each (a minute or two of speech), cut
 * between paragraphs and, inside a long paragraph, between sentences. Never
 * over 4,500, under the model's 5,000 a request. The same text always cuts
 * the same way, so a part's hash says whether its audio is still the text's.
 */
export function splitParts(body: string): Part[] {
  const FIRST = 450;
  const SIZE = 1400;
  const MAX = 4500;
  const sentences = (p: string) => p.match(/[^.!?۔؟]+[.!?۔؟]+["'”’)]*\s*|[^.!?۔؟]+$/g)?.map((s) => s) ?? [p];
  const pieces: string[] = [];
  for (const para of body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    if (para.length <= SIZE) pieces.push(para);
    else {
      let run = '';
      for (const s of sentences(para)) {
        if (run && (run + s).length > SIZE) {
          pieces.push(run.trim());
          run = '';
        }
        run += s;
      }
      if (run.trim()) pieces.push(run.trim());
    }
  }
  const out: string[] = [];
  let run = '';
  for (const piece of pieces) {
    const limit = out.length === 0 ? FIRST : SIZE;
    if (run && (run.length + piece.length + 2 > limit || run.length + piece.length + 2 > MAX)) {
      out.push(run);
      run = '';
    }
    run = run ? `${run}\n\n${piece}` : piece;
  }
  if (run) out.push(run);
  return out.map((text, n) => ({ n, text, hash: sha(text).slice(0, 16) }));
}

export const partPath = (l: Pick<Lesson, 'key' | 'chapter' | 'medium'>, n: number) => `${l.key}/${l.chapter}/${l.medium}/${n}.mp3`;
/**
 * A new, unguessable name for a finished lesson. The lesson bucket is public
 * (players and downloads fetch plain addresses), so a name anyone could work
 * out from a chapter id was a lesson anyone could fetch without a plan. The
 * name is kept on the track row, which only a student with the plan can read.
 */
export const newFinalPath = (l: Pick<Lesson, 'key' | 'chapter' | 'medium'>) =>
  `${l.chapter}/${l.medium}-${l.key}-${randomBytes(9).toString('hex')}.mp3`;

/**
 * The settings and everything about one lesson's premium voice, read in one
 * go: the website runs far from the database, and every round trip in a row
 * is time a student spends looking at a spinner after pressing play. The
 * lesson is null when the voice is off for this medium or the lesson is not
 * in scope.
 */
export async function openLesson(admin: Admin, chapter: string, medium: Medium): Promise<{ settings: VoiceSettings | null; lesson: Lesson | null }> {
  const [settings, { data: script, error: se }, { data: rows, error: re }, { data: track, error: te }] = await Promise.all([
    readSettings(admin),
    admin.from('voice_scripts').select('body').eq('chapter_id', chapter).eq('medium', medium).maybeSingle(),
    // Every voice's parts, sorted out below once the voice is known.
    admin.from('voice_parts').select('voice, part, text_hash, status, storage_path, bytes').eq('chapter_id', chapter).eq('medium', medium),
    admin.from('audio_tracks').select('voice_pending, voice, storage_path').eq('id', `${chapter}-${medium}`).maybeSingle(),
  ]);
  if (se || re || te) throw new Error(`voice lesson read failed: ${(se ?? re ?? te)?.message}`);
  if (!voiceReady(settings, medium) || !script?.body) return { settings, lesson: null };
  const voiceId = (medium === 'ur' ? settings.voiceUr : (settings.voiceEn ?? settings.voiceUr)) as string;
  const key = sha(`${settings.model}:${voiceId}`).slice(0, 10);
  const mine = ((rows ?? []) as (PartRow & { voice: string })[]).filter((r) => r.voice === key);
  return {
    settings,
    lesson: {
      chapter,
      medium,
      voiceId,
      model: settings.model,
      key,
      parts: splitParts(String(script.body)),
      rows: new Map(mine.map((r) => [r.part, r])),
      pending: !!track && track.voice !== key,
      path: track && track.voice === key ? ((track.storage_path as string | null) ?? null) : null,
    },
  };
}

/** A part whose audio is saved and still matches its text. */
export const readyRow = (l: Lesson, p: Part): PartRow | null => {
  const r = l.rows.get(p.n);
  return r && r.status === 'ready' && r.text_hash === p.hash && r.storage_path ? r : null;
};

export const remainingChars = (l: Lesson) => l.parts.filter((p) => !readyRow(l, p)).reduce((n, p) => n + p.text.length, 0);

/**
 * What text of this length will cost. The month's usage is counted in the
 * credits ElevenLabs charges (the character-cost header), which for Alice on
 * v3 is about 0.53 of the character count, so comparing plain characters
 * against credits refused lessons that would have fitted near the month's
 * end. Rounded up a little, so an estimate never overspends.
 */
export const CREDITS_PER_CHAR = 0.6;
export const creditsFor = (chars: number) => Math.ceil(chars * CREDITS_PER_CHAR);

/**
 * How long the whole lesson runs: measured for the parts that exist, and for
 * the rest estimated at the pace those parts were read at (a voice's pace is
 * its own), or the usual pace before there is anything to measure.
 */
export function estimatedSecs(l: Lesson): number {
  let secs = 0;
  let chars = 0;
  for (const p of l.parts) {
    const r = readyRow(l, p);
    if (r?.bytes) {
      secs += r.bytes / BYTES_PER_SEC;
      chars += p.text.length;
    }
  }
  const pace = chars > 200 && secs > 0 ? chars / secs : CHARS_PER_SEC;
  return Math.round(l.parts.reduce((s, p) => s + (readyRow(l, p)?.bytes ? (readyRow(l, p)!.bytes as number) / BYTES_PER_SEC : p.text.length / pace), 0));
}

/**
 * Where a stream asked to start `at` seconds in begins: the first part not
 * wholly before that point. A player that lost its stream (the connection
 * dropped, or the server's time ran out) asks again from where it got to,
 * and every part it already heard is saved, so their lengths are known.
 */
export function startPart(l: Lesson, at: number): number {
  let start = 0;
  for (let i = 0; i < l.parts.length; i++) {
    const r = readyRow(l, l.parts[i]);
    if (!r?.bytes) return i;
    const end = start + r.bytes / BYTES_PER_SEC;
    if (end > at + 0.5) return i;
    start = end;
  }
  return l.parts.length;
}

/** Characters already sent to the voice service this Karachi month. */
export async function usedThisMonth(admin: Admin): Promise<number> {
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' }).format(new Date());
  const { data, error } = await admin.from('voice_usage').select('chars').eq('month', month).maybeSingle();
  // A read that failed is not "nothing spent": counted as the whole
  // allowance, so no lesson is started blind. The old voice plays instead.
  if (error) return Number.MAX_SAFE_INTEGER;
  return Number(data?.chars) || 0;
}

/* ------------------------------------------------------------ stream token */

/**
 * A short-lived signed address for the stream, so a plain audio element (the
 * website's) or the phone's player can open it without sending a login. It
 * names the lesson, the student and when it expires; nothing else can be
 * read from or done with it.
 */
const tokenKey = () => {
  // Never a key anyone could work out: without the secret, nothing is signed
  // or accepted (signStream and verifyStream both go through here).
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is not set');
  return createHash('sha256').update(`voice-stream:${secret}`).digest();
};

export function signStream(chapter: string, medium: Medium, userId: string, ttlSecs = 30 * 60): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSecs;
  const payload = `${chapter}.${medium}.${userId}.${exp}`;
  const sig = createHmac('sha256', tokenKey()).update(payload).digest('base64url');
  return new URLSearchParams({ c: chapter, m: medium, u: userId, e: String(exp), s: sig }).toString();
}

export function verifyStream(q: URLSearchParams): { chapter: string; medium: Medium; userId: string } | null {
  const chapter = q.get('c') ?? '';
  const medium = q.get('m');
  const userId = q.get('u') ?? '';
  const exp = Number(q.get('e'));
  const sig = q.get('s') ?? '';
  if (!chapter || (medium !== 'en' && medium !== 'ur') || !userId || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  const want = createHmac('sha256', tokenKey()).update(`${chapter}.${medium}.${userId}.${exp}`).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  return { chapter, medium, userId };
}

/* ------------------------------------------------------------------ audio */

/**
 * Drops an ID3 tag from the front of a stretch of MP3. Each generated part
 * may carry one, and a tag in the middle of the joined file or the stream is
 * noise some players stumble over.
 */
export function stripId3(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return bytes;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const footer = bytes[5] & 0x10 ? 10 : 0;
  return bytes.subarray(Math.min(bytes.length, 10 + size + footer));
}

/**
 * Speech for one part, from ElevenLabs' streaming endpoint: `onChunk` gets
 * the audio as it arrives (so a listener hears it straight away), and the
 * whole part comes back at the end to be saved.
 *
 * Asked with the language named, which v3 takes and which keeps an Urdu
 * lesson from drifting into Hindi or Arabic sounds, and with the neighbouring
 * text for a smooth join on the models that accept it (v3 refuses it, tried
 * 15 Sep 2026). Asked again with less if the model refuses a setting: a
 * missing nicety is better than no lesson.
 */
export async function speak(
  l: Lesson,
  p: Part,
  onChunk: (chunk: Uint8Array) => void,
  signal?: AbortSignal,
): Promise<Spoken> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  const neighbour = (n: number) => l.parts[n]?.text.slice(0, 600) ?? undefined;
  const language_code = l.medium === 'ur' ? 'ur' : 'en';
  const bodies: object[] = [
    { text: p.text, model_id: l.model, language_code },
    { text: p.text, model_id: l.model },
  ];
  if (!l.model.startsWith('eleven_v3')) {
    bodies.unshift({ text: p.text, model_id: l.model, language_code, previous_text: p.n > 0 ? neighbour(p.n - 1) : undefined, next_text: neighbour(p.n + 1) });
  }
  let last = '';
  for (const body of bodies) {
    let res: Response | null = null;
    // Busy (too many requests at once on the plan) or a passing server fault:
    // wait a moment and ask again. Nothing has reached the listener yet.
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(l.voiceId)}/stream?output_format=${OUTPUT_FORMAT}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(body),
        signal,
      });
      if (res.status !== 429 && res.status < 500) break;
      last = `${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!res) break;
    if (res.status === 422 || res.status === 400) {
      last = `${res.status} ${(await res.text()).slice(0, 300)}`;
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`elevenlabs ${res.status} ${(await res.text().catch(() => '')).slice(0, 300) || last}`);
    const chunks: Uint8Array[] = [];
    // The first bytes held back until an ID3 tag, if any, can be measured and dropped.
    let head: Uint8Array | null = new Uint8Array(0);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      chunks.push(value);
      if (head) {
        const merged: Uint8Array = new Uint8Array(head.length + value.length);
        merged.set(head);
        merged.set(value, head.length);
        if (merged.length < 10) {
          head = merged;
          continue;
        }
        const tagged = merged[0] === 0x49 && merged[1] === 0x44 && merged[2] === 0x33;
        const skip = tagged
          ? 10 + (((merged[6] & 0x7f) << 21) | ((merged[7] & 0x7f) << 14) | ((merged[8] & 0x7f) << 7) | (merged[9] & 0x7f)) + (merged[5] & 0x10 ? 10 : 0)
          : 0;
        if (merged.length < skip) {
          head = merged;
          continue;
        }
        head = null;
        onChunk(merged.subarray(skip));
      } else onChunk(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.length;
    }
    // What the service charged, which is not the character count: 57 credits
    // for 103 Urdu characters on v3. The text's length when it does not say.
    const cost = Number(res.headers.get('character-cost'));
    return { bytes: stripId3(all), cost: Number.isFinite(cost) && cost > 0 ? cost : p.text.length };
  }
  throw new Error(`elevenlabs refused the part: ${last}`);
}

/** Saves a finished part and counts what it cost. */
export async function savePart(admin: Admin, l: Lesson, p: Part, { bytes, cost }: Spoken): Promise<PartRow> {
  const path = partPath(l, p.n);
  await persist('part upload', () => admin.storage.from(PARTS_BUCKET).upload(path, bytes, { contentType: 'audio/mpeg', upsert: true }));
  const row: PartRow = { part: p.n, text_hash: p.hash, status: 'ready', storage_path: path, bytes: bytes.length };
  await persist('part row', () =>
    admin
      .from('voice_parts')
      .update({ status: 'ready', storage_path: path, bytes: bytes.length, text_hash: p.hash, updated_at: new Date().toISOString() })
      .eq('chapter_id', l.chapter)
      .eq('medium', l.medium)
      .eq('voice', l.key)
      .eq('part', p.n),
  );
  await persist('usage', () => admin.rpc('add_voice_usage', { p_chars: Math.ceil(cost) }));
  l.rows.set(p.n, row);
  return row;
}

export async function failPart(admin: Admin, l: Lesson, p: Part) {
  // Best effort: if even this cannot be written, the claim goes stale in two
  // minutes and the part is taken again then.
  await admin
    .from('voice_parts')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('chapter_id', l.chapter)
    .eq('medium', l.medium)
    .eq('voice', l.key)
    .eq('part', p.n)
    .then(
      () => {},
      () => {},
    );
}

export async function claimPart(admin: Admin, l: Lesson, p: Part): Promise<boolean> {
  const { data, error } = await admin.rpc('claim_voice_part', { p_chapter: l.chapter, p_medium: l.medium, p_voice: l.key, p_part: p.n, p_hash: p.hash });
  if (error) throw new Error(`claim failed: ${error.message}`);
  return data === true;
}

/** A saved part's audio. */
export async function readPart(admin: Admin, row: PartRow): Promise<Uint8Array> {
  const { data, error } = await admin.storage.from(PARTS_BUCKET).download(row.storage_path as string);
  if (error || !data) throw new Error(`part download failed: ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Waits for a part another request is making; null when it has not appeared in time. */
export async function waitForPart(admin: Admin, l: Lesson, p: Part, ms: number): Promise<PartRow | null> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const { data } = await admin
      .from('voice_parts')
      .select('part, text_hash, status, storage_path, bytes')
      .eq('chapter_id', l.chapter)
      .eq('medium', l.medium)
      .eq('voice', l.key)
      .eq('part', p.n)
      .maybeSingle();
    const row = data as PartRow | null;
    if (row?.status === 'ready' && row.text_hash === p.hash && row.storage_path) {
      l.rows.set(p.n, row);
      return row;
    }
    if (row?.status === 'failed') return null;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

/** The public address of a file in the audio bucket, as both apps build it. */
export const publicUrl = (admin: Admin, path: string) => admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/**
 * Once every part is made: one file, and the track row pointing at it. From
 * here on the lesson plays like any other, on every app version, and the
 * stream is never asked for again.
 *
 * Then what it replaced goes: the recording in the old voice and the parts it
 * was joined from, since nothing plays either again (the client's call, 15
 * Sep 2026: no dead audio left in storage). A lesson not finished yet keeps
 * its old recording, which is what its students hear until it is.
 */
export async function finalize(admin: Admin, l: Lesson, have?: Map<number, Uint8Array>): Promise<boolean> {
  if (!l.parts.every((p) => readyRow(l, p))) return false;
  const pieces: Uint8Array[] = [];
  for (const p of l.parts) {
    // The request that made the parts still holds them: no need to fetch them back.
    const bytes = have?.get(p.n) ?? (await readPart(admin, readyRow(l, p) as PartRow));
    pieces.push(p.n === 0 ? bytes : stripId3(bytes));
  }
  const total = pieces.reduce((n, c) => n + c.length, 0);
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of pieces) {
    all.set(c, at);
    at += c.length;
  }
  const trackId = `${l.chapter}-${l.medium}`;
  const path = newFinalPath(l);
  await persist('final upload', () => admin.storage.from(BUCKET).upload(path, all, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' }));
  await persist('track update', () =>
    admin
      .from('audio_tracks')
      .update({ storage_path: path, bytes: total, duration_secs: Math.round(total / BYTES_PER_SEC), voice: l.key, voice_pending: false })
      .eq('id', trackId),
  );
  l.pending = false;
  l.path = path;

  // The recording this replaces stays for now: a page or phone that opened
  // the lesson a minute ago is still playing it, and deleting it cut them off
  // mid-lesson. `node scripts/voice-scope.mjs --tidy` clears old recordings.
  const { error: pe } = await admin.storage.from(PARTS_BUCKET).remove(l.parts.map((p) => partPath(l, p.n)));
  if (pe) throw new Error(`lesson finished, clearing its parts failed: ${pe.message}`);
  await admin.from('voice_parts').delete().eq('chapter_id', l.chapter).eq('medium', l.medium).eq('voice', l.key);
  return true;
}
