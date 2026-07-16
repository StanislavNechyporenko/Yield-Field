'use client';

import { useEffect, useRef } from 'react';

// Ambient physics background: big protocol icons drift across the whole
// screen, bounce off the viewport edges and off each other; every collision
// bursts a handful of small Monad icons that fly out and fade. Runs on a
// fixed canvas at -z-10 and never intercepts pointer events.

const PROTOCOL_ICONS = [
  'aave',
  'morpho',
  'euler',
  'curvance',
  'accountable',
  'upshift',
  'pendle',
  'shmonad',
  'kintsu',
  'magma',
].map((name) => `/icons/${name}.png`);

const MONAD_ICON = '/icons/monad.png';

const BODY_ALPHA = 0.5;
const PAIR_COOLDOWN_MS = 1500;
// ~2.8x of the original 72–114px tiles → 202–320px diameter.
const SIZE_SCALE = 5 * 0.75 * 0.75;
// An icon never outgrows this share of the smaller viewport side.
const MAX_VIEWPORT_SHARE = 0.26;

interface Body {
  img: HTMLImageElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseR: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  angle: number;
  spin: number;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function FloatingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let width = 0;
    let height = 0;
    let last = 0;

    const bodies: Body[] = [];
    const sparks: Spark[] = [];
    const lastHit = new Map<string, number>();
    let monadImg: HTMLImageElement | null = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      // clientWidth of the fixed inset-0 canvas — unlike window.innerWidth it
      // excludes the scrollbar, so physics bounds match the visible edge.
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cap = Math.min(width, height) * MAX_VIEWPORT_SHARE;
      for (const b of bodies) b.r = Math.min(b.baseR, cap);
    };
    resize();
    window.addEventListener('resize', resize);

    const burst = (x: number, y: number) => {
      const count = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const dir = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 90;
        const maxLife = 0.9 + Math.random() * 0.5;
        sparks.push({
          x,
          y,
          vx: Math.cos(dir) * speed,
          vy: Math.sin(dir) * speed,
          life: maxLife,
          maxLife,
          size: 14 + Math.random() * 10,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 4,
        });
      }
    };

    const step = (dt: number) => {
      for (const b of bodies) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // Icons may slide over the edge by 60% of their radius before turning
        // back, so they visibly reach every border of the screen.
        const over = b.r * 0.6;
        if (b.x - b.r < -over) {
          b.x = b.r - over;
          b.vx = Math.abs(b.vx);
        }
        if (b.x + b.r > width + over) {
          b.x = width + over - b.r;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y - b.r < -over) {
          b.y = b.r - over;
          b.vy = Math.abs(b.vy);
        }
        if (b.y + b.r > height + over) {
          b.y = height + over - b.r;
          b.vy = -Math.abs(b.vy);
        }
      }

      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minDist = a.r + b.r;
          const distSq = dx * dx + dy * dy;
          if (distSq >= minDist * minDist) continue;

          const dist = Math.max(Math.sqrt(distSq), 0.01);
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = (minDist - dist) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          // Equal-mass elastic bounce: swap velocity components along the
          // collision normal, but only when the bodies are approaching.
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            a.vx += rel * nx;
            a.vy += rel * ny;
            b.vx -= rel * nx;
            b.vy -= rel * ny;

            const key = `${i}-${j}`;
            const now = performance.now();
            if ((lastHit.get(key) ?? 0) + PAIR_COOLDOWN_MS < now) {
              lastHit.set(key, now);
              burst(a.x + nx * a.r, a.y + ny * a.r);
            }
          }
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.985;
        s.vy *= 0.985;
        s.angle += s.spin * dt;
      }
    };

    const drawRound = (
      img: HTMLImageElement,
      x: number,
      y: number,
      r: number,
      alpha: number
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    };

    const tick = (now: number) => {
      if (disposed) return;
      // Self-heal if the canvas was measured before layout settled (or the
      // window changed without a resize event, e.g. dev hot-reload).
      if (
        Math.abs(canvas.clientWidth - width) > 1 ||
        Math.abs(canvas.clientHeight - height) > 1
      ) {
        resize();
      }

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt);

      ctx.clearRect(0, 0, width, height);
      for (const b of bodies) drawRound(b.img, b.x, b.y, b.r, BODY_ALPHA);
      if (monadImg) {
        for (const s of sparks) {
          ctx.save();
          ctx.globalAlpha = 0.9 * (s.life / s.maxLife);
          ctx.translate(s.x, s.y);
          ctx.rotate(s.angle);
          ctx.beginPath();
          ctx.arc(0, 0, s.size / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(monadImg, -s.size / 2, -s.size / 2, s.size, s.size);
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(tick);
    };

    Promise.all([...PROTOCOL_ICONS, MONAD_ICON].map(loadImage)).then((images) => {
      if (disposed) return;
      // Layout has definitely settled by now — re-measure before seeding.
      resize();

      monadImg = images[images.length - 1];
      const icons = images.slice(0, -1).filter((img): img is HTMLImageElement => img !== null);

      // Jittered grid start so the icons begin spread out, not stacked.
      const cols = Math.ceil(Math.sqrt(icons.length));
      const rows = Math.ceil(icons.length / cols);
      const cap = Math.min(width, height) * MAX_VIEWPORT_SHARE;
      icons.forEach((img, i) => {
        const baseR = (36 + (i % 4) * 7) * SIZE_SCALE;
        const r = Math.min(baseR, cap);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = ((col + 0.5) / cols) * width + (Math.random() - 0.5) * 60;
        const y = ((row + 0.5) / rows) * height + (Math.random() - 0.5) * 60;
        const speed = 22 + Math.random() * 20;
        const dir = Math.random() * Math.PI * 2;
        bodies.push({
          img,
          baseR,
          r,
          x: Math.min(Math.max(x, r), width - r),
          y: Math.min(Math.max(y, r), height - r),
          vx: Math.cos(dir) * speed,
          vy: Math.sin(dir) * speed,
        });
      });

      last = performance.now();
      raf = requestAnimationFrame(tick);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    // Explicit w/h-full: canvas is a replaced element, inset-0 alone does not
    // stretch it — without these it stays at its intrinsic 300×150.
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
