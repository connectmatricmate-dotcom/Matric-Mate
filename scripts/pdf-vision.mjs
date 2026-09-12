/**
 * Reading scanned textbooks with a vision model: the parts the Punjab scripts
 * share.
 *
 * The board's books are scans, so there is no text layer to parse. Pages are
 * rendered with pdftoppm (poppler) and, where a whole book has to be looked at
 * at once, tiled into labelled grids with ImageMagick's montage. The model call
 * is plain fetch, streamed, the same shape as generate-content.mjs.
 */

import { spawn } from 'node:child_process';
import dns from 'node:dns';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This network advertises IPv6 it cannot route. Large uploads over it fail
// with a bare "fetch failed", so connect over IPv4 only.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Two models, each where it earns its price.
 *
 * Reading a page rendered at full size is transcription, and Sonnet does it
 * for a fraction of Opus's cost. Picking chapter openings out of a grid of
 * thumbnails is harder: on Physics 10 Sonnet put three of twelve openings one
 * page out, where Opus had all twelve right. The gap check caught it, but a
 * book that fails its check is a book not read, so locating stays on Opus.
 * It is one call per book.
 */
export const VISION_MODEL = 'claude-sonnet-5';
export const STRONG_MODEL = 'claude-opus-5';

export const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

export async function loadEnv() {
  const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const run = (cmd, argv) =>
  new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}: ${err.slice(0, 200)}`))));
  });

/** How many pages a PDF has. */
export async function pageCount(pdf) {
  const out = await new Promise((ok, fail) => {
    const p = spawn('pdfinfo', [pdf]);
    let s = '';
    p.stdout.on('data', (d) => (s += d));
    p.on('close', (code) => (code === 0 ? ok(s) : fail(new Error(`pdfinfo exited ${code}`))));
  });
  return Number(out.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
}

/**
 * Pages first to last (1-based, inclusive) as greyscale JPEGs, base64.
 *
 * Sized by the long side in pixels, not by dpi: scans come at odd page sizes,
 * and the API refuses any image over 2000 px once a request carries more than
 * twenty. 1560 is the most it will use; 850 still shows a heading.
 *
 * Every call gets its own temporary directory. Books are read in parallel,
 * and a shared one hands one book's pages to another's request.
 */
export async function renderPages(pdf, { first = 1, last, px = 1300 }) {
  const dir = await mkdtemp(join(tmpdir(), 'pj-pages-'));
  try {
    await run('pdftoppm', ['-f', String(first), '-l', String(last), '-scale-to', String(px), '-gray', '-jpeg', '-jpegopt', 'quality=80', pdf, join(dir, 'p')]);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).sort();
    return await Promise.all(files.map(async (f) => (await readFile(join(dir, f))).toString('base64')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * A whole book as grids of thumbnails, each cell labelled with its PDF page
 * number, so a model can look over every page in one request and answer in
 * page numbers that need no arithmetic to trust.
 */
export async function renderGrids(pdf, { pages, cols = 4, rows = 3 }) {
  const dir = await mkdtemp(join(tmpdir(), 'pj-grid-'));
  try {
    await run('pdftoppm', ['-scale-to', '480', '-gray', '-jpeg', '-jpegopt', 'quality=75', pdf, join(dir, 'p')]);
    const files = (await readdir(dir)).filter((f) => /^p-\d+\.jpg$/.test(f)).sort();
    const perGrid = cols * rows;
    const grids = [];
    for (let i = 0; i < Math.min(files.length, pages); i += perGrid) {
      const argv = [];
      files.slice(i, i + perGrid).forEach((f, j) => argv.push('-label', `page ${i + j + 1}`, join(dir, f)));
      const out = join(dir, `grid-${String(grids.length).padStart(3, '0')}.jpg`);
      await run('montage', [
        ...argv,
        '-tile', `${cols}x${rows}`,
        '-geometry', '340x480+8+8',
        '-pointsize', '30',
        '-quality', '80',
        out,
      ]);
      grids.push((await readFile(out)).toString('base64'));
    }
    return grids;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * One streamed call, returning the parsed JSON reply. Streamed so a slow reply
 * cannot trip Node's body timeout. Retries rate limits, server errors, network
 * drops and a reply that is not JSON.
 */
export async function askJson(env, { system, images = [], prompt, maxTokens = 32000, effort = 'medium', model = VISION_MODEL }, attempt = 1) {
  const content = [
    ...images.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
    { type: 'text', text: prompt },
  ];
  const again = () => askJson(env, { system, images, prompt, maxTokens, effort, model }, attempt + 1);

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        system,
        output_config: { effort },
        messages: [{ role: 'user', content }],
      }),
    });
  } catch (e) {
    if (attempt > 4) throw new Error(`${e.message}${e.cause ? ` (${e.cause.code ?? e.cause.message})` : ''}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
    return again();
  }

  if (res.status === 429 || res.status >= 500) {
    if (attempt > 4) throw new Error(`API ${res.status} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, 3000 * 2 ** (attempt - 1)));
    return again();
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  let text = '';
  let stopReason = null;
  let usage = {};
  let buffer = '';
  // One streaming decoder, never a chunk decoded on its own: a two-byte Urdu
  // letter split across two network chunks otherwise comes out as two U+FFFD
  // marks, which is how a Punjab outcome lost the ب of "صحابہ کرام".
  const decoder = new TextDecoder('utf-8');
  try {
    for await (const piece of res.body) {
      buffer += decoder.decode(piece, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (event.type === 'message_start') usage = { ...usage, ...event.message?.usage };
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') text += event.delta.text;
        if (event.type === 'message_delta') {
          if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
          usage = { ...usage, ...event.usage };
        }
        if (event.type === 'error') throw new Error(`stream error: ${event.error?.message ?? 'unknown'}`);
      }
    }
  } catch (e) {
    // A connection cut mid-stream is the same weather as one refused up front.
    if (attempt > 4 || String(e.message).startsWith('stream error')) throw e;
    await new Promise((r) => setTimeout(r, 5000 * attempt));
    return again();
  }

  if (stopReason === 'refusal') throw new Error('the model declined this request');
  if (stopReason === 'max_tokens') throw new Error('reply hit the token ceiling');

  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const json = JSON.parse(cleaned);
    tally.input += usage.input_tokens ?? 0;
    tally.output += usage.output_tokens ?? 0;
    return json;
  } catch {
    if (attempt > 2) throw new Error(`reply was not JSON: ${cleaned.slice(0, 160)}`);
    return again();
  }
}

/** Tokens spent by this process, for the closing line of a run. */
export const tally = { input: 0, output: 0 };

/**
 * This repo never carries an em dash (U+2014), and model output is where one
 * sneaks in, as in an English gloss of an Urdu lesson title followed by its
 * author. Swapped for a middot at the point it enters, so no file downstream
 * has to remember.
 */
export function scrubDashes(value) {
  if (typeof value === 'string') return value.replace(/\s*\u2014\s*/g, ' · ');
  if (Array.isArray(value)) return value.map(scrubDashes);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDashes(v)]));
  return value;
}
