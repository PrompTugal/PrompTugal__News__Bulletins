/* moves.js: the move set's evaluator. moves.json says what each move is called, how long it lasts, which parts it
 * drives and its parameters. Three kinds of move:
 *   pose: pure data. Go to a pose (with anticipation and overshoot), hold, come back.
 *   keys: pure data. Keyframes of poses over the move's length.
 *   fn:   one function here, for moves that need arithmetic (a walk cycle, a parabola, aiming at a point).
 * Every function has the same shape: (u, tl, a, c) -> { channel: value }, where u is 0..1 through the move, tl is
 * seconds since it began, a is the action (a.p holds its parameters) and c is the character's context. Nothing here
 * keeps state between calls: that is what makes any t reachable by a seek. */
import { TAU, clamp, lerp, sat, smooth, smoother, win, bump, ease, noise1, hash1, deg } from './math.js';
import { mirror } from './channels.js';

const PI = Math.PI, sin = Math.sin, cos = Math.cos;
export const KIND = { humanoid: { elastic: 0.7, gait: 'biped' }, boxbot: { elastic: 0.35, gait: 'biped', stiff: 1 }, owl: { elastic: 1.0, gait: 'waddle' }, cube3d: { elastic: 1.7, gait: 'roll' }, mosaic: { elastic: 0.2, gait: 'biped', stiff: 1 } };
// Which side a one-armed move uses: 'free' is the hand that holds no prop, 'prop' the one that does.
const sideOf = (a, c) => { const s = a.p.side || 'free', free = c.spec.free || 'R'; return s === 'free' ? free : s === 'prop' ? (free === 'R' ? 'L' : 'R') : s; };
const onSide = (pose, side) => (side === 'L' ? mirror(pose) : pose);
const OPEN = { aR_f0: -0.2, aR_f1: -0.25, aR_f2: -0.25, aR_f3: -0.25, aR_f4: -0.25 }, FIST = { aR_f0: 0.6, aR_f1: 0.85, aR_f2: 0.85, aR_f3: 0.85, aR_f4: 0.85 };
// Aim the upper arm along a direction given in the character's own frame (see channels.js for the angles).
function aim(side, dx, dy, dz) { const l = Math.hypot(dx, dy, dz) || 1, sx = side === 'L' ? 1 : -1; return { out: Math.asin(clamp(sx * dx / l, -1, 1)), sw: Math.atan2(dz / l, -dy / l) }; }
// A stage point in the character's frame, measured from a body height (a fraction of its height).
function local(c, pos, target, hFrac) { const dx = target[0] - pos.x, dy = (target[1] ?? 1.4) - (c.baseY + c.d.height * hFrac), dz = (target[2] ?? pos.z + 3) - pos.z, cy = cos(-pos.yaw), sy = sin(-pos.yaw); return [dx * cy + dz * sy, dy, -dx * sy + dz * cy]; }
const here = (a) => a.at || { x: 0, z: 0, yaw: 0 };

/* The envelope of a pose move: anticipation (a small move the wrong way), then the move with overshoot, a hold, and
 * an eased return. Its value multiplies the pose, so it may dip below 0 and rise above 1. */
export function poseEnv(tl, dur, m, p) {
  const tin = p.in ?? m.in ?? 0.35, tout = p.out ?? m.out ?? 0.35, ant = p.anticipate ?? m.anticipate ?? 0.08;
  if (tl < 0 || tl > dur) return 0;
  if (tin <= 0 && tout <= 0) return 1;
  if (tl < tin) { const x = tl / tin; return x < 0.2 ? -ant * sin(PI * x / 0.2) : ease(m.ease || 'outBack', (x - 0.2) / 0.8); }
  if (tl > dur - tout) return 1 - smoother((tl - (dur - tout)) / tout);
  return 1;
}

export const FN = {
  /* ----- version 1's six, with the same meaning ----- */
  speak(u, tl, a, c) { // visemes if the action names a track, loudness otherwise (as version 1 did)
    const tr = a.p.track && c.tracks && c.tracks[a.p.track];
    if (!tr) { const amp = a.p.amp ?? (0.35 + 0.35 * noise1(tl * 9, 3) + 0.2 * sin(tl * 21)); return { jaw: clamp(amp, 0, 1) * win(u, 0, 0.05, 0.95, 1), mW: 0.1, mF: 0, mL: 0 }; }
    const ts = tl + (a.p.offset || 0), V = c.visemes, cues = tr.mouthCues; let i = a._i || 0;
    if (i >= cues.length || cues[i].start > ts) i = 0; while (i < cues.length - 1 && cues[i].end <= ts) i++; a._i = i;   // a cache only: the answer does not depend on it
    const cur = V[cues[i].value] || V.X, prev = V[(cues[i - 1] || { value: 'X' }).value] || V.X, k = smooth((ts - cues[i].start) / 0.07);
    const o = { jaw: lerp(prev.jaw, cur.jaw, k), mW: lerp(prev.mW, cur.mW, k), mF: lerp(prev.mF, cur.mF, k), mL: lerp(prev.mL, cur.mL, k) };
    o.add = { h_pitch: o.jaw * 0.05, browL: o.jaw * 0.12, browR: o.jaw * 0.12 }; return o;
  },
  blink(u) { return { blink: bump(u) }; },
  nod(u, tl, a) { const k = a.p.amount ?? 1, n = a.p.times ?? 1; return { add: { h_pitch: k * (0.30 * sin(u * PI * (2 * n - 1)) * bump(u) + (-0.06) * bump(sat(u * 5))) } }; },
  look(u, tl, a) { const to = a.p.dir === 'content' ? -(a.p.amount ?? 0.85) : a.p.dir === 'away' ? 0.85 : 0, f = a.from?.lookX ?? 0; const k = ease('out', u); return { lookX: lerp(f, to, k), add: { h_yaw: (to - f) * 0.25 * bump(u) } }; },
  point(u, tl, a, c) { // version 1: raise the arm towards the story (stage left) and bring it back
    const s = sideOf(a, c), e = poseEnv(tl, a.dur, { in: 0.3, out: 0.35, ease: 'outBack' }, a.p), t = a.p.target || [here(a).x - 3.2, c.baseY + c.d.height * 0.95, here(a).z + 1.5];
    return FN.pointAt(u, tl, { ...a, p: { ...a.p, target: t, side: s } }, c, e);
  },
  emote(u, tl, a, c) { return FN.expression(u, tl, { ...a, p: { ...a.p, name: a.p.mood || a.p.name || 'smile' } }, c); },

  /* ----- idle ----- */
  breathe(u, tl, a, c) { const r = c.kind.stiff ? 0.3 : 1, w = 1.25 + 0.3 * hash1(c.n), b = sin(tl * w + c.n); return { add: { ch_x: -0.018 * b * r, sp_x: 0.008 * b * r, aL_sh: 0.25 * b * r, aR_sh: 0.25 * b * r, h_pitch: 0.012 * b, aL_out: 0.012 * b, aR_out: 0.012 * b } }; },
  weightShift(u, tl, a, c) { // slow drift of the weight from foot to foot, with the spine and head countering it
    const r = c.kind.stiff ? 0.45 : 1, s = noise1(tl * 0.16 + c.n * 3.1, c.n) * r, q = noise1(tl * 0.23 + 9, c.n + 4) * r;
    if (c.kind.gait === 'roll') return { add: { r_roll: 0, h_roll: 0.05 * s, h_yaw: 0.14 * q, r_sy: 0.012 * sin(tl * 2.2 + c.n) } };
    return { add: { hp_z: 0.05 * s, sp_z: -0.035 * s, ch_z: -0.02 * s, h_roll: 0.025 * s + 0.02 * q, ch_y: 0.05 * q, h_yaw: 0.07 * q, lL_out: 0.03 * s, lR_out: -0.03 * s, aL_sw: 0.04 * q, aR_sw: -0.04 * q, lookX: 0.12 * noise1(tl * 0.5, c.n + 7), lookY: 0.06 * noise1(tl * 0.4, c.n + 8) } };
  },
  lookAround(u, tl, a, c) { const k = win(u, 0, 0.15, 0.85, 1), x = noise1(tl * (a.p.speed ?? 0.7) + c.n, c.n + 11), y = noise1(tl * 0.5 + c.n, c.n + 12); return { lookX: x * 0.9 * k, lookY: y * 0.4 * k, add: { h_yaw: x * 0.45 * k, h_pitch: -y * 0.12 * k, ch_y: x * 0.1 * k } }; },
  fidget(u, tl, a, c) { // each character has its own small habit; characters.json names it
    const e = poseEnv(tl, a.dur, { in: 0.4, out: 0.45, ease: 'outBack' }, a.p), f = a.p.kind || c.spec.fidget, s = c.spec.free || 'R', w = sin(tl * 9) * e;
    const P = {
      tie: () => onSide({ aR_sw: 0.72, aR_out: -0.16, aR_el: 2.15, aR_tw: 0.9, aR_wz: 0.25 * w, h_pitch: -0.1, smile: 0.4, ...FIST, aR_f0: 0.2 }, s),
      glasses: () => onSide({ aR_sw: 1.12, aR_out: 0.02, aR_el: 2.42, aR_tw: 0.5, h_pitch: 0.12, aR_f1: -0.2, aR_f2: 0.7, aR_f3: 0.8, aR_f4: 0.8, browL: 0.5, browR: 0.5 }, s),
      tablet: () => ({ h_pitch: 0.42, h_yaw: 0.3, lookY: -0.6, lookX: 0.4, aL_sw: 0.3, aL_el: 0.25, browL: 0.3, browR: 0.3 }),
      weight: () => ({ hp_z: 0.09, sp_z: -0.07, h_roll: 0.06, aR_sw: -0.25, aR_el: 0.5, aL_sw: -0.25, aL_el: 0.5, ch_x: -0.06 }),
      antenna: () => ({ h_roll: 0.22 * sin(tl * 7), h_pitch: -0.08, wide: 0.5, browL: 0.6, browR: 0.6 }),
      clock: () => ({ h_roll: 0.12, lookX: 0.8 * sin(tl * 3), browL: 0.5 * sin(tl * 3), browR: -0.5 * sin(tl * 3) }),
      peer: () => ({ aR_sw: 0.9, aR_el: 0.9, aR_tw: 0.3, sp_x: 0.2, h_pitch: 0.1, squint: 0.5, fx1: 0.5 }),
      keys: () => ({ aR_sw: 0.5, aR_wz: 0.5 * w, fx1: 0.6 * w, h_roll: -0.1, smile: 0.5 }),
      feathers: () => ({ fx1: 1, aL_out: 0.3 + 0.12 * w, aR_out: 0.3 + 0.12 * w, r_sy: 0.05, h_roll: 0.15 * w, blink: 0.5 + 0.5 * w }),
      wobble: () => ({ h_roll: 0.22 * sin(tl * 6), r_sy: 0.07 * sin(tl * 12), smile: 0.6 }),
      flicker: () => ({ fx1: 0.35 * (0.5 + 0.5 * sin(tl * 17)), h_roll: 0.05 }),
      blocks: () => ({ h_roll: 0.18 * Math.sign(sin(tl * 5)), aR_out: 0.6, aL_out: 0.6 }),
    }[f] || (() => ({ h_roll: 0.1 }));
    const o = P(); for (const k in o) o[k] *= e; return o;
  },

  /* ----- locomotion ----- */
  place(u, tl, a) { const t = a.to; return { r_x: t.x, r_z: t.z, r_yaw: t.yaw }; },
  walk(u, tl, a, c) { return gait(u, tl, a, c, 1); },
  run(u, tl, a, c) { return gait(u, tl, a, c, 2); },
  turn(u, tl, a, c) { // turn on the spot: the head leads, the body follows, a small dip marks the weight change
    const f = a.from.yaw, t = a.to.yaw, k = ease('inOut5', u), d = t - f; return { r_yaw: lerp(f, t, k), add: { h_yaw: d * 0.22 * (smooth(u * 2.2) - k), r_y: -0.02 * bump(u), lL_sw: 0.12 * bump(u) * Math.sign(d), lR_sw: -0.12 * bump(u) * Math.sign(d), hp_z: 0.04 * sin(u * TAU) } };
  },
  spin(u, tl, a, c) { // wind up the wrong way, whip round, settle
    const n = a.p.turns ?? 1, f = a.from.yaw, wind = -0.35 * sin(PI * sat(u / 0.18)) * (u < 0.18 ? 1 : 0), k = ease('inOut5', sat((u - 0.16) / 0.72)), sp = bump(sat((u - 0.16) / 0.72));
    const o = { r_yaw: f + wind + k * TAU * n, r_y: 0.05 * sp * c.kind.elastic, r_sy: 0.06 * sp * c.kind.elastic - 0.05 * bump(sat(u / 0.18)), aL_out: 0.25 * sp, aR_out: 0.25 * sp, aL_el: 1.5 * sp, aR_el: 1.5 * sp, aL_tw: 0.9 * sp, aR_tw: 0.9 * sp, aL_sw: 0.3 * sp, aR_sw: 0.3 * sp };
    o.add = { r_roll: 0.05 * sin(u * TAU) * sp, h_roll: -0.08 * sp }; if (u >= 1) return { r_yaw: f }; return o;
  },
  jump(u, tl, a, c) { return leap(u, a, c, a.p.height ?? 0.55, 1); },
  hop(u, tl, a, c) { return leap(u, a, c, a.p.height ?? 0.2, 0.45); },
  bounce(u, tl, a, c) { // Cubo's special, but any body can do it: three bounces, each lower, squashing on every landing
    const n = a.p.times ?? 3, h = a.p.height ?? 0.7, x = u * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, top = h * Math.pow(0.52, i), y = top * 4 * f * (1 - f), land = Math.exp(-f * 9) + Math.exp(-(1 - f) * 9), E = c.kind.elastic;
    return { r_y: y, r_sy: clamp((y / (top + 0.01)) * 0.16 - land * 0.2 * (top / h + 0.25), -0.4, 0.3) * E, wide: 0.5, smile: 0.8, aL_sw: 0.5 * (1 - land), aR_sw: 0.5 * (1 - land), aL_out: 0.5, aR_out: 0.5 };
  },

  /* ----- gestures that need arithmetic ----- */
  wave(u, tl, a, c) { // the upper arm goes out to the side, the forearm stands up and swings; the hand trails the forearm
    const s = sideOf(a, c), e = poseEnv(tl, a.dur, { in: 0.32, out: 0.36, ease: 'outBack' }, a.p), n = a.p.waves ?? 3, ph = tl * TAU * n / Math.max(0.5, a.dur - 0.5), big = a.p.big ?? 1;
    const o = onSide({ aR_out: 1.35 * big, aR_sw: 0.25, aR_tw: -1.45, aR_el: 1.55 + 0.42 * sin(ph), aR_wz: -0.3 * sin(ph - 0.9), aR_sh: 0.6, ...OPEN, h_roll: -0.1, ch_z: -0.05, smile: 0.8, browL: 0.3, browR: 0.3 }, s);
    for (const k in o) o[k] *= e; return o;
  },
  pointAt(u, tl, a, c, e0) { // aim the arm, the index finger and the eyes at a stage point [x, y, z]
    const s = sideOf(a, c), e = e0 ?? poseEnv(tl, a.dur, { in: 0.3, out: 0.35, ease: 'outBack' }, a.p), pos = here(a), sx = s === 'L' ? 1 : -1;
    const T = a.p.target || [pos.x - 3, 1.6, pos.z + 1], v = local(c, { x: pos.x, z: pos.z, yaw: pos.yaw }, T, 0.78), q = aim(s, v[0] - sx * c.d.shX, v[1], v[2]), hy = Math.atan2(v[0], Math.max(0.2, v[2]));
    const o = onSide({ aR_el: -0.1, aR_tw: -0.6, aR_f0: 0.5, aR_f1: -0.3, aR_f2: 0.85, aR_f3: 0.85, aR_f4: 0.85 }, s);
    o['a' + s + '_sw'] = q.sw; o['a' + s + '_out'] = q.out; o.h_yaw = clamp(hy * 0.55, -0.9, 0.9); o.lookX = clamp(hy * 1.4, -1, 1); o.ch_y = clamp(hy * 0.2, -0.3, 0.3);
    for (const k in o) o[k] *= e; return o;
  },
  count(u, tl, a, c) { // fingers come up one at a time, each with a small pump of the forearm
    const s = sideOf(a, c), n = a.p.n ?? 3, e = poseEnv(tl, a.dur, { in: 0.3, out: 0.3, ease: 'outBack' }, a.p), x = sat((tl - 0.3) / Math.max(0.1, a.dur - 0.7)) * n, i = Math.floor(x), f = x - i;
    const o = { aR_sw: 0.95, aR_out: 0.12, aR_el: 1.75 - 0.22 * bump(sat(f * 2.2)), aR_tw: -0.9, h_pitch: 0.06, lookX: -0.3, lookY: -0.1, browL: 0.4, browR: 0.4 };
    for (let k = 0; k < 5; k++) { const fi = k + 1 <= 4 ? k + 1 : 0, up = k < i ? 1 : k === i ? ease('outBack', f * 3) : 0; o['aR_f' + fi] = lerp(0.85, -0.3, k < n ? up : 0); }
    if (n < 5) o.aR_f0 = 0.6; const r = onSide(o, s); for (const k in r) r[k] *= e; return r;
  },
  lookAt(u, tl, a, c) { // the eyes go first, then the head, then the chest: the order in which a living thing turns
    const pos = here(a), T = a.p.target || [0, 1.5, 6], v = local(c, pos, T, 0.9), yaw = Math.atan2(v[0], Math.max(0.2, v[2])), pit = -Math.atan2(v[1], Math.hypot(v[0], v[2])), lim = c.B && c.B.headTurn ? 2.6 : 1.1;
    const out = 1 - smoother((u - 0.8) / 0.2), eye = ease('out', u / 0.12) * out, hd = ease('outBack', (u - 0.06) / 0.3) * out, ch = ease('inOut', (u - 0.14) / 0.42) * out;
    const hy = clamp(yaw * 0.7, -lim, lim) * hd;
    return { lookX: clamp(yaw * 1.6 * eye - hy * 0.9, -1, 1), lookY: clamp(-pit * 1.5 * eye, -1, 1), h_yaw: hy, h_pitch: clamp(pit * 0.6, -0.5, 0.5) * hd, ch_y: clamp(yaw * 0.25, -0.4, 0.4) * ch, sp_y: clamp(yaw * 0.1, -0.2, 0.2) * ch };
  },
  shake(u, tl, a) { const n = a.p.times ?? 2.5, k = a.p.amount ?? 1; return { add: { h_yaw: 0.42 * k * sin(u * TAU * n) * bump(u), h_pitch: 0.05 * bump(u) } }; },
  tilt(u, tl, a) { const k = (a.p.amount ?? 1) * (a.p.dir === 'left' ? -1 : 1); return { add: { h_roll: 0.3 * k * poseEnv(tl, a.dur, { in: 0.3, out: 0.3, ease: 'outBack' }, a.p) } }; },
  doubleTake(u, tl, a) { // look away, come back, then snap back to it with wide eyes: a classic of cartoon acting
    const d = a.p.dir === 'left' ? -1 : 1, away = win(u, 0.0, 0.14, 0.26, 0.38), snap = ease('outElastic', (u - 0.52) / 0.2) * (1 - smoother((u - 0.84) / 0.16)), dip = bump(sat((u - 0.44) / 0.1));
    return { h_yaw: d * (0.55 * away + 0.75 * snap), h_pitch: 0.12 * dip - 0.1 * snap, lookX: d * (0.6 * away + 0.9 * snap), wide: snap, browL: snap, browR: snap, jaw: 0.25 * snap, ch_y: d * 0.22 * snap, sp_x: -0.05 * snap, blink: bump(sat((u - 0.4) / 0.1)) };
  },
  expression(u, tl, a, c) { const x = (c.expressions && c.expressions[a.p.name]) || {}, e = poseEnv(tl, a.dur, { in: 0.22, out: 0.3, ease: 'out', anticipate: 0 }, a.p), o = {}; for (const k in x) o[k] = x[k] * e; return o; },
  viseme(u, tl, a, c) { const v = c.visemes[a.p.shape] || c.visemes.X; return { jaw: v.jaw, mW: v.mW, mF: v.mF, mL: v.mL }; },
  brows(u, tl, a) { const e = poseEnv(tl, a.dur, { in: 0.14, out: 0.2, ease: 'outBack', anticipate: 0 }, a.p), k = a.p.amount ?? 1; return { browL: (a.p.left ?? 1) * k * e, browR: (a.p.right ?? 1) * k * e, wide: 0.3 * k * e }; },

  /* ----- reactions ----- */
  celebrate(u, tl, a, c) { // two little jumps with both arms pumping overhead
    const e = poseEnv(tl, a.dur, { in: 0.25, out: 0.35, ease: 'outBack' }, a.p), ph = sat((u - 0.12) / 0.76) * 2, f = ph - Math.floor(Math.min(ph, 1.999)), y = 0.26 * 4 * f * (1 - f) * (u > 0.12 && u < 0.88 ? 1 : 0), E = c.kind.elastic, pump = sin(tl * 13);
    return { r_y: y, r_sy: (y * 0.3 - 0.1 * Math.exp(-f * 10) * (u > 0.12 ? 1 : 0)) * E, aL_sw: (2.7 + 0.15 * pump) * e, aR_sw: (2.7 - 0.15 * pump) * e, aL_out: 0.4 * e, aR_out: 0.4 * e, aL_el: (0.5 + 0.3 * pump) * e, aR_el: (0.5 - 0.3 * pump) * e, ...scale({ ...FIST, ...mirror(FIST) }, e), smile: e, wide: 0.5 * e, jaw: 0.6 * e, browL: 0.8 * e, browR: 0.8 * e, h_pitch: -0.18 * e, crouch: 0.25 * bump(sat(u / 0.14)) };
  },
  flinch(u, tl, a) { // fast in, slow out
    const e = ease('out', u / 0.1) * (1 - smoother((u - 0.45) / 0.55)), d = a.p.dir === 'left' ? -1 : 1;
    return { r_pitch: -0.14 * e, sp_x: -0.16 * e, h_yaw: 0.5 * d * e, h_pitch: 0.2 * e, aL_sw: 1.0 * e, aR_sw: 1.15 * e, aL_el: 2.0 * e, aR_el: 2.0 * e, aL_tw: 0.9 * e, aR_tw: 0.9 * e, aL_sh: e, aR_sh: e, squint: e, blink: 0.8 * e, smile: -0.5 * e, browAng: -0.6 * e, crouch: 0.25 * e, r_sy: -0.05 * e };
  },
  laugh(u, tl, a, c) { const e = win(u, 0, 0.14, 0.78, 1), sh = sin(tl * 26) * e, r = c.kind.stiff ? 0.5 : 1; return { h_pitch: (-0.28 + 0.05 * sh) * e, ch_x: (-0.08 + 0.035 * sh) * r, sp_x: -0.05 * e * r, r_y: 0.012 * sh, aL_sh: 0.7 * sh, aR_sh: 0.7 * sh, jaw: (0.62 + 0.2 * sh) * e, mW: 0.4 * e, smile: e, squint: 0.9 * e, browL: 0.5 * e, browR: 0.5 * e, r_sy: 0.03 * sh * c.kind.elastic }; },
  tada(u, tl, a, c) { // gather in, then burst open and hold: "ta-da"
    const g = bump(sat(u / 0.24)), o = ease('outElastic', (u - 0.22) / 0.3) * (1 - smoother((u - 0.82) / 0.18)), E = c.kind.elastic;
    return { crouch: 0.45 * g, r_sy: (-0.1 * g + 0.08 * o) * E, sp_x: 0.2 * g - 0.08 * o, aL_sw: 0.5 * g + 0.5 * o, aR_sw: 0.5 * g + 0.5 * o, aL_el: 1.9 * g + 0.15 * o, aR_el: 1.9 * g + 0.15 * o, aL_out: 1.25 * o, aR_out: 1.25 * o, aL_tw: -1.3 * o + 0.8 * g, aR_tw: -1.3 * o + 0.8 * g, ...scale({ ...OPEN, ...mirror(OPEN) }, o), smile: o, wide: 0.6 * o, jaw: 0.5 * o, browL: o, browR: o, h_pitch: 0.2 * g - 0.12 * o, r_y: 0.04 * o };
  },

  /* ----- off stage ----- */
  hide() { return { hide: 1 }; },
  dissolved() { return { fx2: 1 }; },      // Tejo before he is switched on: only the projector shows
  blank() { return { fx1: 1 }; },          // The Guide before he is drawn; Ceefax as an empty page

  /* ----- specials ----- */
  glitch(u, tl, a) { const e = win(u, 0, 0.1, 0.8, 1), b = hash1(Math.floor(tl * 14)) > 0.45 ? 1 : 0.25; return { fx1: e * b, add: { h_roll: 0.12 * e * (hash1(Math.floor(tl * 9) + 2) - 0.5), r_x: 0.04 * e * (hash1(Math.floor(tl * 11)) - 0.5) } }; },
  rematerialise(u) { return { fx2: win(u, 0.0, 0.34, 0.5, 0.96), fx1: 0.5 * bump(sat((u - 0.5) / 0.5)) }; },
  materialise(u) { return { fx2: 1 - ease('inOut', u), fx1: 0.6 * bump(u) }; },
  scanSweep(u, tl, a) { const n = a.p.times ?? 2, x = u * n; return { fx3: 0.001 + (x - Math.floor(Math.min(x, n - 1e-6))) * 0.999 * (u < 1 ? 1 : 0) }; },
  pageFlip(u, tl, a) { return { fx1: u < 0.12 ? ease('in', u / 0.12) : 1 - ease('linear', (u - 0.16) / 0.8), add: { h_roll: 0 } }; },
  pageIn(u) { return { fx1: 1 - sat(u) }; },
  colourCycle(u, tl, a) { const n = a.p.steps ?? 14; return { fx2: Math.floor(u * n) / 7, aL_out: 0.9 * bump(u), aR_out: 0.9 * bump(u), smile: bump(u) }; },
  clockSpin(u, tl, a) { // the hands race round, the head follows them a little, and it ends slightly dizzy
    const n = a.p.turns ?? 2, k = ease('inOut5', sat(u / 0.7)), dz = bump(sat((u - 0.66) / 0.34));
    return { fx1: k * n, h_roll: 0.12 * sin(k * TAU * n) * (1 - k) * 2 + 0.16 * dz * sin(tl * 8), h_yaw: 0.1 * dz * cos(tl * 8), aL_out: 0.5 * bump(u), jaw: 0.4 * dz };
  },
  magnify(u, tl, a) { const e = poseEnv(tl, a.dur, { in: 0.4, out: 0.4, ease: 'outBack' }, a.p); return scale({ aR_sw: 1.4, aR_out: -0.25, aR_el: 1.58, aR_tw: 0.1, sp_x: 0.12, h_pitch: -0.08, h_roll: -0.08, fx1: 1, squint: 0.3, browR: 0.8, browL: -0.3, lookX: 0.25 * sin(tl * 2.2), jaw: 0.15 }, e); },
  keyJingle(u, tl, a) { const e = win(u, 0, 0.18, 0.75, 1), w = sin(tl * 15); return { aR_sw: 1.15 * e, aR_el: 1.25 * e, aR_out: 0.3 * e, aR_tw: -0.3 * e, aR_wz: 0.55 * w * e, aR_wx: 0.3 * cos(tl * 15) * e, fx1: 0.9 * w * e, h_roll: -0.14 * e, h_yaw: -0.2 * e, lookX: -0.5 * e, smile: e, browL: 0.5 * e, browR: 0.5 * e }; },
  headTurn270(u, tl, a) { // only the owl's neck allows it; other bodies clamp it in rig.js through their own necks
    const k = win(u, 0.05, 0.42, 0.62, 0.95), d = a.p.dir === 'left' ? -1 : 1; return { h_yaw: d * deg(a.p.degrees ?? 270) * k, blink: bump(sat((u - 0.5) / 0.08)), wide: 0.5 * k, h_pitch: -0.05 * k };
  },
  wingFlap(u, tl, a, c) { const n = a.p.times ?? 4, e = win(u, 0, 0.12, 0.85, 1), f = sin(u * TAU * n), up = 0.5 + 0.5 * f; return { aL_out: (0.7 + 0.85 * f) * e, aR_out: (0.7 + 0.85 * f) * e, aL_el: 0.25 * (1 - up) * e, aR_el: 0.25 * (1 - up) * e, aL_tw: -0.4 * e, aR_tw: -0.4 * e, ...scale({ aL_f0: -0.3, aL_f1: -0.3, aL_f2: -0.3, aR_f0: -0.3, aR_f1: -0.3, aR_f2: -0.3 }, e), r_y: (0.16 - 0.1 * f) * e, r_sy: 0.05 * f * e, fx1: 0.6 * e, wide: 0.4 * e, h_pitch: -0.1 * e }; },
  rollEdge(u, tl, a, c) { // tip up on to an edge, hang there, fall over it on to the next face; then come back the same way
    const s = c.d.cube || c.d.height * 0.5, n = a.p.steps ?? 1, d = a.p.dir === 'left' ? -1 : 1, x = u < 0.5 ? u * 2 : (1 - u) * 2, q = sat(x) * n, i = Math.min(n - 1, Math.floor(q)), f = q - i;
    const tip = f < 0.5 ? ease('out', f / 0.5) * 0.5 : 0.5 + ease('in', (f - 0.5) / 0.5) * 0.5, ang = (i + tip) * PI / 2, la = tip * PI / 2, r = s / Math.SQRT2;
    return { r_x: here(a).x + d * (i * s + s / 2 - r * cos(PI / 4 + la)), r_y: r * sin(PI / 4 + la) - s / 2, r_roll: -d * ang, wide: 0.6 * bump(f), jaw: 0.3 * bump(f) };
  },
  antennaSpark(u, tl, a) { const e = win(u, 0.1, 0.2, 0.7, 1), z = hash1(Math.floor(tl * 20)); return { fx1: e * (0.6 + 0.4 * z), wide: e, browL: e, browR: e, jaw: 0.3 * e, h_pitch: -0.1 * e, add: { h_roll: 0.06 * e * (z - 0.5), r_y: 0.03 * bump(sat(u / 0.2)) } }; },
  sketchOn(u) { return { fx1: 1 - sat(u) }; },
  sketchOff(u) { return { fx1: sat(u) }; },
  dematerialise(u) { return { fx2: ease('inOut', u), fx1: 0.6 * bump(u) }; },
  pageOut(u) { return { fx1: ease('in', u) }; },
  flyIn(u, tl, a, c) { // down from above the frame on beating wings, and a soft landing
    const h = a.p.height ?? 3.4, k = 1 - ease('inOut', sat(u / 0.78)), land = bump(sat((u - 0.78) / 0.22)), f = sin(tl * 17), e = 1 - smooth((u - 0.72) / 0.2);
    return { r_y: h * k, aL_out: (0.95 + 0.6 * f) * e, aR_out: (0.95 + 0.6 * f) * e, aL_tw: -0.4 * e, aR_tw: -0.4 * e, r_sy: -0.14 * land * c.kind.elastic, crouch: 0.4 * land, lL_sw: 0.35 * e, lR_sw: 0.35 * e, wide: 0.4 * e, fx1: 0.5 * e, h_pitch: 0.15 * e };
  },
  flyOut(u, tl, a, c) { return FN.flyIn(1 - u, tl, a, c); },
  straightenTie(u, tl, a, c) { const s = sideOf(a, c), e = poseEnv(tl, a.dur, { in: 0.4, out: 0.4, ease: 'outBack' }, a.p), w = sin(tl * 10) * win(u, 0.3, 0.4, 0.6, 0.7); return scale(onSide({ aR_sw: 0.74, aR_out: -0.17, aR_el: 2.18, aR_tw: 0.9, aR_wz: 0.3 * w, ...FIST, aR_f0: 0.2, h_pitch: -0.14, h_roll: 0.06 * w, smile: 0.7, browL: 0.4, browR: 0.4, ch_x: -0.05 }, s), e); },
  microExpression(u, tl, a) { // small, quick, asymmetric: a thought crossing a face
    const A = win(u, 0.02, 0.1, 0.2, 0.3), B = win(u, 0.3, 0.4, 0.52, 0.62), C = win(u, 0.62, 0.72, 0.88, 1);
    return { browL: 0.8 * A - 0.2 * B + 0.3 * C, browR: 0.2 * A - 0.3 * B + 0.3 * C, browAng: 0.5 * B, squint: 0.5 * B + 0.4 * C, smile: -0.2 * B + 0.75 * C, lookX: 0.5 * A - 0.4 * B, lookY: 0.3 * A, h_roll: 0.06 * A - 0.05 * C, h_yaw: 0.1 * A - 0.08 * B, h_pitch: 0.05 * B, mW: 0.2 * C, blink: bump(sat((u - 0.27) / 0.06)) + bump(sat((u - 0.6) / 0.06)) };
  },
  cartoonTake(u, tl, a, c) { // squash down in disbelief, then stretch up with everything open, and vibrate
    const g = bump(sat(u / 0.26)), o = ease('outElastic', (u - 0.24) / 0.26) * (1 - smoother((u - 0.8) / 0.2)), v = sin(tl * 40) * o;
    return { crouch: 0.5 * g, r_sy: -0.2 * g + 0.2 * o + 0.012 * v, sp_x: 0.25 * g - 0.12 * o, h_pitch: 0.3 * g - 0.2 * o, wide: o, squint: g, jaw: 0.95 * o, browL: 1.2 * o - 0.5 * g, browR: 1.2 * o - 0.5 * g, aL_out: 1.0 * o, aR_out: 1.0 * o, aL_sw: 0.4 * o, aR_sw: 0.4 * o, aL_el: 1.2 * g + 0.4 * o, aR_el: 1.2 * g + 0.4 * o, aL_tw: -1 * o, aR_tw: -1 * o, ...scale({ ...OPEN, ...mirror(OPEN) }, o), add: { r_x: 0.006 * v } };
  },
};
function scale(o, e) { const r = {}; for (const k in o) if (o[k] !== undefined) r[k] = o[k] * e; return r; }

/* A leap: anticipation (crouch and squash), launch (stretch), flight (a parabola), landing (squash), settle.
 * The body's "elastic" number scales the squash, so a robot barely deforms and Cubo deforms a lot. */
function leap(u, a, c, h, depth) {
  const E = c.kind.elastic, A = 0.26, Lq = 0.34, T = 0.74, S = 0.86;
  const ant = u < A ? ease('inOut', u / A) : u < Lq ? 1 - ease('in', (u - A) / (Lq - A)) : 0;
  const fl = sat((u - Lq) / (T - Lq)), air = u > Lq && u < T ? 1 : 0, y = air * h * 4 * fl * (1 - fl);
  const land = u >= T ? (u < S ? ease('out', (u - T) / (S - T)) : 1 - ease('outBack', (u - S) / (1 - S))) : 0;
  const str = air * (1 - Math.abs(fl - 0.5) * 2 < 0.4 ? 1 : 0.6) * bump(fl), down = Math.max(ant, land);
  return { r_y: y, crouch: depth * (0.6 * ant + 0.5 * land) + air * 0.22 * bump(fl), r_sy: E * (-0.16 * ant - 0.2 * land + 0.16 * str * (1 - bump(fl) * 0.5)), sp_x: 0.22 * down * depth - 0.08 * air,
    aL_sw: -0.6 * ant * depth + air * 2.3 * bump(fl) + 0.3 * land, aR_sw: -0.6 * ant * depth + air * 2.3 * bump(fl) + 0.3 * land, aL_out: 0.2 * air + 0.25 * land, aR_out: 0.2 * air + 0.25 * land, aL_el: 0.5 * ant + 0.2 * air, aR_el: 0.5 * ant + 0.2 * air,
    h_pitch: 0.18 * ant - 0.15 * air + 0.2 * land, lL_out: 0.08 * air, lR_out: 0.08 * air, wide: 0.4 * air, smile: 0.5 * air, browL: 0.5 * air, browR: 0.5 * air };
}
/* Gaits. One function moves any body from a.from to a.to; how it moves depends on the body's gait:
 * biped (a walk cycle), waddle (the owl rocks from foot to foot), roll (the cube tumbles over its edges) and
 * glide (the hologram's projector slides and the figure leans into it). */
function gait(u, tl, a, c, pace) {
  const f = a.from, t = a.to, dx = t.x - f.x, dz = t.z - f.z, dist = Math.hypot(dx, dz), g = c.spec.gait || c.kind.gait;
  if (u >= 1) return { r_x: t.x, r_z: t.z, r_yaw: t.yaw };
  if (dist < 1e-4) return { r_x: t.x, r_z: t.z, r_yaw: lerp(f.yaw, t.yaw, smooth(u)) };
  const k = ease('inOut', u) * 0.35 + u * 0.65, x = f.x + dx * k, z = f.z + dz * k, head = Math.atan2(dx, dz), go = win(u, 0, 0.12, 0.88, 1);
  // Face the way of travel during the walk, then turn to the facing the action asks for.
  const yaw = lerp(lerp(f.yaw, head, smooth(u / 0.14)), t.yaw, smooth((u - 0.84) / 0.16));
  if (g === 'roll') {
    const s = c.d.cube, n = Math.max(1, Math.round(Math.abs(dx) / s)), q = sat(u) * n, i = Math.min(n - 1, Math.floor(q)), fr = q - i, tip = fr < 0.55 ? ease('out', fr / 0.55) * 0.5 : 0.5 + ease('in', (fr - 0.55) / 0.45) * 0.5, la = tip * PI / 2, r = s / Math.SQRT2, d = Math.sign(dx) || 1, step = Math.abs(dx) / n;
    return { r_x: f.x + d * (i * step + step / 2 - r * cos(PI / 4 + la) * step / s), r_z: f.z + dz * u, r_y: r * sin(PI / 4 + la) - s / 2, r_roll: -d * (i + tip) * PI / 2, r_yaw: t.yaw, r_sy: -0.07 * Math.exp(-fr * 12) * (i > 0 ? 1 : 0), wide: 0.3, smile: 0.5 };
  }
  if (g === 'glide') return { r_x: x, r_z: z, r_yaw: lerp(f.yaw, t.yaw, smooth(u)), r_roll: -0.12 * go * Math.sign(dx) * sin(u * PI), r_pitch: 0.05 * go, fx1: 0.3 * go, aL_out: 0.15 * go, aR_out: 0.15 * go };
  const stride = (c.d.thigh + c.d.shin) * (g === 'waddle' ? 0.9 : 0.82) * (pace > 1 ? 1.5 : 1), ph = k * dist / stride * PI, sw = sin(ph), cw = cos(ph), R = pace > 1 ? 1.6 : 1, st = c.kind.stiff ? 0.7 : 1;
  if (g === 'waddle') return { r_x: x, r_z: z, r_yaw: yaw, r_roll: 0.16 * sw * go, r_y: 0.03 * Math.abs(cw) * go, lL_sw: 0.5 * sw * go, lR_sw: -0.5 * sw * go, aL_out: (0.25 + 0.15 * sw) * go, aR_out: (0.25 - 0.15 * sw) * go, h_roll: -0.12 * sw * go, hp_y: 0.1 * sw * go };
  return { r_x: x, r_z: z, r_yaw: yaw, r_y: (pace > 1 ? 0.06 : 0.025) * Math.abs(sw) * go, r_pitch: (pace > 1 ? 0.2 : 0.04) * go,
    lL_sw: 0.52 * R * sw * go, lR_sw: -0.52 * R * sw * go, lL_kn: (0.25 + 0.75 * R * Math.max(0, -cw) * (sw > -0.3 ? 1 : 0.4)) * go * 0.9, lR_kn: (0.25 + 0.75 * R * Math.max(0, cw) * (sw < 0.3 ? 1 : 0.4)) * go * 0.9, lL_an: -0.15 * sw * go, lR_an: 0.15 * sw * go,
    aL_sw: -0.5 * R * sw * go * st, aR_sw: 0.5 * R * sw * go * st, aL_el: (pace > 1 ? 1.4 : 0.35 + 0.2 * Math.max(0, -sw)) * go, aR_el: (pace > 1 ? 1.4 : 0.35 + 0.2 * Math.max(0, sw)) * go,
    hp_y: 0.12 * sw * go * st, ch_y: -0.14 * sw * go * st, hp_z: 0.04 * cw * go, sp_z: -0.03 * cw * go, add: { h_yaw: (0 - (yaw - t.yaw)) * 0.0 } };
}

/* Evaluate keyframes: keys are [u, pose, ease]. Channels missing from a key count as 0. */
export function evalKeys(keys, u) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const A = keys[i], B = keys[i + 1] || A, k = ease(B[2] || 'inOut', (u - A[0]) / Math.max(1e-6, B[0] - A[0])), o = {};
  for (const n in A[1]) o[n] = lerp(A[1][n], B[1][n] ?? 0, k); for (const n in B[1]) if (!(n in o)) o[n] = lerp(0, B[1][n], k);
  return o;
}
