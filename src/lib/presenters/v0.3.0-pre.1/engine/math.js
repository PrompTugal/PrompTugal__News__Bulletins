/* math.js: small pure helpers. Nothing here reads a clock or Math.random, so everything built on it is a function of
 * its arguments alone. That is what keeps "frame = f(t)" true. */
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const sat = (x) => clamp(x, 0, 1);
export const smooth = (x) => { x = sat(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = sat(x); return x * x * x * (x * (x * 6 - 15) + 10); };
// A window: rises over [a,b], holds, falls over [c,d].
export const win = (x, a, b, c, d) => smooth((x - a) / Math.max(1e-6, b - a)) * (1 - smooth((x - c) / Math.max(1e-6, d - c)));
// One hump on 0..1 (version 1's "bump").
export const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));

/* Easing curves, named so that moves.json can ask for them. The "back" and "elastic" curves are the animation
 * principles in number form: anticipation is easeInBack, overshoot and settle is easeOutBack or easeOutElastic. */
export const EASE = {
  linear: (x) => sat(x),
  in: (x) => { x = sat(x); return x * x * x; },
  out: (x) => { x = sat(x); return 1 - Math.pow(1 - x, 3); },
  inOut: smooth,
  inOut5: smoother,
  outBack: (x) => { x = sat(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  inBack: (x) => { x = sat(x); const c = 1.9; return (c + 1) * x * x * x - c * x * x; },
  outElastic: (x) => { x = sat(x); return x === 0 || x === 1 ? x : Math.pow(2, -9 * x) * Math.sin((x * 8 - 0.75) * (TAU / 3)) + 1; },
  outBounce: (x) => { x = sat(x); const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; } if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; } x -= 2.625 / d; return n * x * x + 0.984375; },
};
export const ease = (name, x) => (EASE[name] || EASE.inOut)(x);

// Seeded generator (the same recipe as version 1's rng): a string seed gives the same sequence on every run.
export function rng(seed) {
  let s = 2166136261 >>> 0;
  for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
// A hash of a number to 0..1, for flicker and jitter that must be the same at the same t.
export function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
// Smooth value noise in one dimension, built from hash1: used for look-around and micro-motion.
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i; return lerp(hash1(i + seed * 57.3), hash1(i + 1 + seed * 57.3), smooth(f)) * 2 - 1; }
export const deg = (d) => d * Math.PI / 180;
