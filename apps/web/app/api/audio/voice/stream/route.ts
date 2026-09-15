import { after, NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BYTES_PER_SEC,
  claimPart,
  failPart,
  finalize,
  finalPath,
  loadLesson,
  publicUrl,
  readPart,
  readSettings,
  readyRow,
  savePart,
  speak,
  startPart,
  usedThisMonth,
  verifyStream,
  voiceReady,
  waitForPart,
  type Part,
} from '@/lib/voice/lesson';

/**
 * One premium-voice lesson as a single MP3 stream, made as it plays.
 *
 * Parts already made come straight from storage. The missing ones are made
 * by ElevenLabs three at a time and passed on as their audio arrives, so the
 * listener hears the first words a couple of seconds after pressing play,
 * the lesson stays ahead of them, and it finishes inside the function's time.
 * Each part is saved as it finishes and the parts become one file at the end,
 * so the next student plays an ordinary file.
 *
 * If the listener leaves, the lesson carries on being made until the time
 * runs out. If the time runs out first (a long lesson, a slow day at the
 * voice service), the stream ends at the edge of a part and the player asks
 * again from where it got to (`at`, seconds in): nothing is made twice.
 *
 * To the player it is one ordinary audio address (the website's audio
 * element, the phone's player), so the lock screen, background playback and
 * the speed control behave exactly as they do for a file.
 */
export const maxDuration = 300;
/**
 * No part is started after this much of the function's time, so none is cut
 * in half. Settable only to test the player's carrying on with a short one.
 */
const TIME_BUDGET_MS = Number(process.env.VOICE_TIME_BUDGET_MS) || 230_000;
/** How long to wait for a part another request is making. */
const WAIT_MS = 100_000;
/** Parts made ahead of the one playing: three at a time in all, inside the plan's five at once. */
const AHEAD = 2;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const who = verifyStream(q);
  if (!who) return NextResponse.json({ error: 'bad_token' }, { status: 401 });

  const admin = createAdminClient();
  const settings = await readSettings(admin);
  if (!voiceReady(settings, who.medium)) return NextResponse.json({ error: 'voice_off' }, { status: 503 });
  const lesson = await loadLesson(admin, who.chapter, who.medium, settings);
  if (!lesson) return NextResponse.json({ error: 'not_in_scope' }, { status: 404 });
  const at = Math.max(0, Number(q.get('at')) || 0);

  // Finished since this address was handed out (a player reconnecting, a
  // second tab): the saved file, from where the player is. Never made again.
  if (!lesson.pending) {
    const from = Math.floor(at * BYTES_PER_SEC);
    const file = await fetch(publicUrl(admin, finalPath(lesson)), { headers: from ? { Range: `bytes=${from}-` } : {} });
    if (!file.ok || !file.body) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return new Response(file.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  }
  const first = startPart(lesson, at);

  const started = Date.now();
  const timeLeft = () => Date.now() - started < TIME_BUDGET_MS;
  const overBudget = async (p: Part) => (await usedThisMonth(admin)) + p.text.length > settings.monthlyChars;

  /**
   * Parts in the making, by part number, several at once: the voice makes
   * speech at under twice the pace it is spoken, so one part at a time could
   * fall behind a student listening at 1.5x. Each keeps the audio it has made
   * so far, and when its turn comes it hands that over and then passes the
   * rest on as it arrives, so the listener always has everything made so far.
   */
  type Job = { chunks: Uint8Array[]; listener: ((c: Uint8Array) => void) | null; live: boolean; done: Promise<Uint8Array | null> };
  const jobs = new Map<number, Job>();
  /** Every part this request has in hand, for joining them without fetching them back. */
  const have = new Map<number, Uint8Array>();
  const startJob = (p: Part): Job => {
    const job: Job = { chunks: [], listener: null, live: false, done: Promise.resolve(null) };
    job.done = (async (): Promise<Uint8Array | null> => {
      if (await overBudget(p)) return null;
      if (!(await claimPart(admin, lesson, p))) {
        // Another listener's request is making it: take it from them when saved.
        const row = await waitForPart(admin, lesson, p, WAIT_MS);
        return row ? readPart(admin, row) : null;
      }
      job.live = true;
      try {
        const spoken = await speak(lesson, p, (c) => {
          job.chunks.push(c);
          job.listener?.(c);
        });
        await savePart(admin, lesson, p, spoken);
        have.set(p.n, spoken.bytes);
        return spoken.bytes;
      } catch (err) {
        await failPart(admin, lesson, p);
        console.error('[voice] part failed', lesson.chapter, lesson.medium, p.n, err instanceof Error ? err.message : err);
        return null;
      }
    })();
    jobs.set(p.n, job);
    return job;
  };

  let open = true;
  let settle: () => void = () => {};
  const made = new Promise<void>((resolve) => (settle = resolve));
  // Joining the parts waits for everything in the making, and runs after the
  // listener has the last byte: the stream never waits on it, and the server
  // is kept alive for it (a write after the response is otherwise lost).
  after(async () => {
    await made;
    await Promise.allSettled([...jobs.values()].map((j) => j.done));
    try {
      await finalize(admin, lesson, have);
    } catch (err) {
      console.error('[voice] finalize failed', lesson.chapter, lesson.medium, err instanceof Error ? err.message : err);
    }
  });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: Uint8Array) => {
        if (!open || !chunk.length) return;
        try {
          controller.enqueue(chunk);
        } catch {
          open = false;
        }
      };

      try {
        for (let i = first; i < lesson.parts.length; i++) {
          const p = lesson.parts[i];
          const ready = readyRow(lesson, p);
          if (ready) {
            if (open) {
              const bytes = await readPart(admin, ready);
              have.set(p.n, bytes);
              send(bytes);
            }
            continue;
          }
          // Still to be made: this one and the next few, all at once.
          for (let k = i; k <= i + AHEAD && k < lesson.parts.length && timeLeft(); k++) {
            const q = lesson.parts[k];
            if (!readyRow(lesson, q) && !jobs.has(q.n)) startJob(q);
          }
          const job = jobs.get(p.n);
          if (!job) break;
          // What it has made so far, then the rest as it comes. No await
          // between the two, so no piece can slip past in between.
          for (const c of job.chunks) send(c);
          job.listener = send;
          const bytes = await job.done;
          job.listener = null;
          if (!bytes) break;
          // A part taken from another request arrives whole, at the end.
          if (!job.live) send(bytes);
        }
      } catch (err) {
        console.error('[voice] stream failed', lesson.chapter, lesson.medium, err instanceof Error ? err.message : err);
      } finally {
        if (open) {
          try {
            controller.close();
          } catch {
            // The listener already left.
          }
        }
        settle();
      }
    },
    cancel() {
      open = false;
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
