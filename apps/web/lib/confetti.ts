/**
 * A one-shot confetti burst on a full-screen canvas.
 *
 * Hand-rolled for the same reasons as the mobile one in
 * apps/mobile/src/components/celebration.tsx: no dependency, no licensing on
 * a client deliverable, and small enough to read in a minute. The canvas is
 * created on demand, layered over everything, ignores pointer events and
 * removes itself when the last piece lands.
 *
 * Respects prefers-reduced-motion by doing nothing at all.
 */

const COLORS = ['#0E7490', '#FF8A00', '#2E9E5B', '#F7C948', '#C9E4EE', '#D9480F'];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  w: number;
  h: number;
  color: string;
  delay: number;
};

export function fireConfetti(count = 90): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const W = window.innerWidth;
  const pieces: Piece[] = Array.from({ length: count }, (_, i) => ({
    x: ((i + 0.5) / count) * W + (Math.random() - 0.5) * 60,
    y: -20 - Math.random() * 40,
    vx: (Math.random() - 0.5) * 90,
    vy: 160 + Math.random() * 160,
    spin: (Math.random() - 0.5) * 8,
    angle: Math.random() * Math.PI,
    w: 7 + Math.random() * 5,
    h: 11 + Math.random() * 7,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.35,
  }));

  const started = performance.now();
  let last = started;

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const elapsed = (now - started) / 1000;
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of pieces) {
      if (elapsed < p.delay) {
        alive++;
        continue;
      }
      p.vy += 220 * dt; // gravity
      p.x += p.vx * dt + Math.sin(elapsed * 6 + p.angle) * 26 * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.y < window.innerHeight + 30) {
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        // Fade the tail end so the landing never looks like a hard cut.
        ctx.globalAlpha = Math.max(0, Math.min(1, 2.6 - elapsed));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }
    if (alive > 0 && elapsed < 3.2) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
