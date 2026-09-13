'use client';

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { Btn } from '@/components/ui/controls';

/**
 * The teacher's link as a QR code, for showing in class.
 *
 * Teachers recruit in a classroom, and "go to matricmate.co/r/MMG72UJ9" read
 * off a board loses half the room. A code on a phone screen, or printed on a
 * notice, is scanned with the camera and lands on the same signup, counted as
 * theirs.
 *
 * Drawn from the module grid as plain SVG rectangles rather than a markup
 * string, and saved as a PNG drawn from the same grid, so the file works in
 * WhatsApp and in a print shop alike.
 *
 * The colours are fixed, not theme tokens, on purpose: a scanner needs dark
 * modules on a light ground, and in dark mode the tokens would invert them.
 */

const QUIET = 4; // modules of white margin the QR standard asks for
const INK = '#0B2E3A';

export function ShareQr({ link, code }: { link: string; code: string }) {
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

  const save = () => {
    const cell = 16;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = INK;
    for (let r = 0; r < grid.n; r++) for (let c = 0; c < grid.n; c++) if (grid.dark(r, c)) ctx.fillRect((c + QUIET) * cell, (r + QUIET) * cell, cell, cell);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `matricmate-${code}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-[16px] border border-line bg-card px-4 py-5 text-center sm:flex-row sm:items-center sm:text-start">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${link}`}
        className="h-44 w-44 shrink-0 rounded-[10px]"
      >
        <rect width={size} height={size} fill="#ffffff" />
        <path d={path} fill={INK} />
      </svg>
      <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-teal">Your QR code</p>
        <p className="text-[13px] leading-[1.55] text-ink2">
          Show it in class or print it on a notice. Students scan it with their phone camera and land on your signup page, counted as yours.
        </p>
        <Btn title="Save QR code" icon="download" onClick={save} variant="line" sm />
      </div>
    </div>
  );
}
