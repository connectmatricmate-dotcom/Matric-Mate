'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import qrcode from 'qrcode-generator';
import { colors } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { Icon } from '@/components/ui/primitives';

/**
 * A teacher's invite, as one card: the QR code and the link together, and
 * the three things anyone does with them.
 *
 * Teachers recruit two ways. In class, where a code on a notice or a phone
 * screen is scanned with the camera; and on WhatsApp, where the link is
 * pasted. Adnan does both on their behalf too, printing codes for a teacher's
 * classes. So the same card sits on the teacher's dashboard and on the
 * admin's page for that teacher, and the download is not a bare square: it is
 * a printable card that says what it is (scan to join MatricMate), carries
 * the link written out for anyone without a camera, and says whose it is.
 *
 * The QR and the printed card use fixed colours, not theme tokens: a scanner
 * needs dark modules on white, and a print must look the same whichever theme
 * the page was in when it was saved.
 */

const QUIET = 4; // modules of white margin the QR standard asks for
const QR_INK = colors.ink;

const noSubscribe = () => () => {};
const hasShareSheet = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const canCopyImage = () =>
  typeof window !== 'undefined' && typeof window.ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function';

type Flash = 'idle' | 'copied' | 'failed';

/** The font a CSS variable resolves to, for drawing on a canvas in the page's own faces. */
const cssFont = (variable: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Lines of `text` no wider than `max`, broken at spaces. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function ShareCard({
  link,
  code,
  name,
  heading,
  note,
  printNote,
}: {
  link: string;
  code: string;
  /** The teacher's name, printed on the card as who invited them. */
  name: string;
  heading: string;
  note: string;
  /** What the download is, said to whoever is looking at the card. */
  printNote: string;
}) {
  const grid = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    const n = qr.getModuleCount();
    return { n, dark: (r: number, c: number) => qr.isDark(r, c) };
  }, [link]);
  const size = grid.n + QUIET * 2;
  const path = useMemo(() => {
    let d = '';
    for (let r = 0; r < grid.n; r++) for (let c = 0; c < grid.n; c++) if (grid.dark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    return d;
  }, [grid]);

  const share = useSyncExternalStore(noSubscribe, hasShareSheet, () => false);
  const copyable = useSyncExternalStore(noSubscribe, canCopyImage, () => false);
  const [linkFlash, setLinkFlash] = useState<Flash>('idle');
  const [qrFlash, setQrFlash] = useState<Flash>('idle');
  const [busy, setBusy] = useState(false);

  // As a person types it: no scheme, no www (matricmate.co redirects there,
  // path and all). The copy and the QR keep the full address.
  const shortLink = link.replace(/^https?:\/\/(www\.)?/, '');
  const flash = (set: (f: Flash) => void) => {
    set('copied');
    setTimeout(() => set('idle'), 2200);
  };

  /**
   * The printable card, 1240 by 1754: A4's shape at 150 dots an inch, so it
   * prints edge to edge on A4 or halves cleanly onto A5.
   */
  const drawCard = async (): Promise<HTMLCanvasElement | null> => {
    await document.fonts.ready;
    const W = 1240;
    const H = 1754;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const display = cssFont('--font-baloo', 'system-ui, sans-serif');
    const body = cssFont('--font-nunito', 'system-ui, sans-serif');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // The name, as the brand writes it.
    const mark = await loadImage('/brand/wordmark.png');
    if (mark) {
      const w = 520;
      const h = (mark.height / mark.width) * w;
      ctx.drawImage(mark, (W - w) / 2, 110, w, h);
    } else {
      ctx.fillStyle = colors.teal;
      ctx.font = `700 96px ${display}`;
      ctx.fillText('MatricMate', W / 2, 190);
    }

    ctx.fillStyle = colors.ink;
    ctx.font = `700 104px ${display}`;
    ctx.fillText('Scan to join', W / 2, 390);

    ctx.fillStyle = colors.ink2;
    ctx.font = `600 40px ${body}`;
    wrap(ctx, 'Notes, MCQs, past papers and an AI tutor for FBISE and Punjab Board, Class 9 and 10.', 900).forEach((l, i) =>
      ctx.fillText(l, W / 2, 466 + i * 54),
    );

    // The code, on a white plate inside a teal frame.
    const box = 820;
    const x = (W - box) / 2;
    const y = 600;
    ctx.fillStyle = colors.teal;
    ctx.beginPath();
    ctx.roundRect(x - 18, y - 18, box + 36, box + 36, 44);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, box, box, 30);
    ctx.fill();
    const cell = Math.floor(box / size);
    const qrSize = cell * size;
    const qx = x + (box - qrSize) / 2;
    const qy = y + (box - qrSize) / 2;
    ctx.fillStyle = QR_INK;
    for (let r = 0; r < grid.n; r++) for (let c = 0; c < grid.n; c++) if (grid.dark(r, c)) ctx.fillRect(qx + (c + QUIET) * cell, qy + (r + QUIET) * cell, cell, cell);

    // For anyone without a camera: the link, written out.
    ctx.fillStyle = colors.ink2;
    ctx.font = `600 38px ${body}`;
    ctx.fillText('or open', W / 2, 1540);
    ctx.fillStyle = colors.teal;
    ctx.font = `800 56px ${body}`;
    ctx.fillText(shortLink, W / 2, 1610);

    // Whose it is, on the band that closes the card.
    ctx.fillStyle = colors.tealTint;
    ctx.fillRect(0, H - 100, W, 100);
    ctx.fillStyle = colors.ink;
    ctx.font = `700 40px ${body}`;
    ctx.fillText(`Invited by ${name}`, W / 2, H - 38);
    return canvas;
  };

  const toBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      flash(setLinkFlash);
    } catch {
      // In-app browsers and plain http refuse the clipboard; the link is on screen to select.
      setLinkFlash('failed');
    }
  };

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const canvas = await drawCard();
      if (!canvas) return;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `matricmate-invite-${code}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  const copyQr = async () => {
    try {
      // The picture as a promise, handed over inside the press: Safari only
      // allows the write while the tap is still being handled.
      const png = drawCard().then((c) => (c ? toBlob(c) : Promise.reject(new Error('no canvas'))));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      flash(setQrFlash);
    } catch {
      setQrFlash('failed');
    }
  };

  /** The phone's share sheet: the card as a picture where the phone takes files, the link where it does not. */
  const shareCard = async () => {
    try {
      const canvas = await drawCard();
      const file = canvas ? new File([await toBlob(canvas)], `matricmate-invite-${code}.png`, { type: 'image/png' }) : null;
      const text = `Join MatricMate with ${name}'s link: ${link}`;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: 'MatricMate' });
      else await navigator.share({ title: 'MatricMate', text, url: link });
    } catch {
      // Cancelled, which is not an error.
    }
  };

  return (
    <section className="rounded-[20px] border border-tealtint2 bg-card p-4 sm:p-5">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {/* The code on its own white plate and teal ring, the way it prints. */}
        <div className="shrink-0 rounded-[18px] bg-teal p-1.5">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR code for ${link}`}
            className="h-44 w-44 rounded-[13px] sm:h-40 sm:w-40"
          >
            <rect width={size} height={size} fill="#ffffff" />
            <path d={path} fill={QR_INK} />
          </svg>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <div className="text-center sm:text-start">
            <h2 className="font-display text-[20px] leading-tight text-ink">{heading}</h2>
            <p className="mt-1 text-[13px] leading-[1.55] text-ink2">{note}</p>
          </div>

          {/* The link as a field with its copy button, the pattern everyone
              already knows from sharing anything. */}
          <div className="flex min-h-12 items-center gap-2 rounded-[14px] border-[1.5px] border-line bg-paper py-1 ps-3.5 pe-1">
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-teal" title={link}>
              {shortLink}
            </span>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-teal px-3.5 text-[13px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
            >
              <Icon name={linkFlash === 'copied' ? 'check' : 'doc'} size={15} strokeWidth={2.4} />
              {linkFlash === 'copied' ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Btn title={busy ? 'Preparing…' : 'Download QR'} icon="download" onClick={() => void download()} variant="line" sm loading={busy} />
            {share ? <Btn title="Share" icon="share" onClick={() => void shareCard()} variant="line" sm /> : null}
            {copyable && !share ? (
              <Btn
                title={qrFlash === 'copied' ? 'QR copied' : 'Copy QR'}
                icon={qrFlash === 'copied' ? 'check' : 'doc'}
                onClick={() => void copyQr()}
                variant="line"
                sm
              />
            ) : null}
          </div>

          <p className="text-center text-[12px] leading-[1.5] text-ink3 sm:text-start">{printNote}</p>

          {linkFlash === 'failed' || qrFlash === 'failed' ? (
            <p role="alert" className="text-[12.5px] font-extrabold text-red">
              {linkFlash === 'failed'
                ? 'This browser would not copy the link. Select it above and copy it by hand.'
                : 'This browser would not copy the picture. Use Download QR instead.'}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
