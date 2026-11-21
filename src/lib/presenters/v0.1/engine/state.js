/* state.js: layer 4, "state at t". Version 1's stateAt(actions, t, loudness) folded six kinds of action into eight
 * numbers. fold() does the same for any number of moves and 69 channels, and adds the two things a game
 * character needs: layering (a wave over a walk) and cross-fading (no pops when one move takes over from another).
 *
 * The rule, in order:
 *   1. Where the character stands comes from its locomotion actions (walk, turn, place): the last one that began.
 *   2. Every other active action is taken in start order. Its weight w fades in and out. On the body parts it drives,
 *      and on any other channel it writes, the pose moves towards the action's value by w. A later action therefore
 *      wins, but only where it acts: the legs keep walking while an arm waves.
 *   3. Additive values (breathing, a nod, the head bob of speech) are summed on top.
 * Nothing is remembered between calls, so any t can be asked for in any order. */
import { CH, N, PARTS, newPose, mirror } from './channels.js';
import { FN, poseEnv, evalKeys } from './moves.js';
import { smooth } from './math.js';

const ABS = new Set([CH.r_x, CH.r_z, CH.r_yaw]);     // absolute stage position: never cross-faded, never zeroed
const idx = (names) => names.map((n) => CH[n]).filter((i) => i !== undefined && !ABS.has(i));
const PART_IDX = Object.fromEntries(Object.entries(PARTS).map(([p, ns]) => [p, idx(ns)]));

// Which hand a one-armed move uses: 'free' holds no prop, 'prop' holds one.
export function sideFor(p, spec) { const free = spec.free || 'R', s = (p && p.side) || 'free'; return s === 'free' ? free : s === 'prop' ? (free === 'R' ? 'L' : 'R') : s; }

/* Attach to an action everything that does not change while it runs: its move, the channels it masks, and for the
 * data moves its pose or keys with the side already chosen. */
export function prepare(a, moves, spec, blend) {
  const m = a.m = moves[a.name]; if (!m) throw new Error('unknown move: ' + a.name);
  a.p = a.p || {}; for (const k in m.params) if (a.p[k] === undefined) a.p[k] = m.params[k].default;
  if (!(a.dur > 0)) a.dur = m.dur || 0;
  const side = sideFor(a.p, spec), mask = [];
  for (const part of m.parts || []) {
    if (part === 'arm') mask.push(...PART_IDX['arm' + side]); else if (part === 'arms') mask.push(...PART_IDX.armL, ...PART_IDX.armR); else if (PART_IDX[part]) mask.push(...PART_IDX[part]);
  }
  a.mask = mask;
  const sided = (pose) => { let q = pose; if (m.sym) { q = { ...pose }; const mm = mirror(pose); for (const k in mm) if (/^[al]L_/.test(k)) q[k] = mm[k]; } else if (side === 'L' && m.params && m.params.side) q = mirror(pose); return q; };
  if (m.kind === 'pose') a.pose = sided(m.pose);
  if (m.kind === 'keys') a.keys = m.keys.map(([u, pose, e]) => [u, sided(pose), e]);
  const f = m.fade || [blend.fadeIn, blend.fadeOut]; a.fi = Math.min(f[0], a.dur / 2); a.fo = Math.min(f[1], a.dur / 2);
  return a;
}

// Where the character stands at t when no locomotion is running: the end of the last one that began.
export function standAt(c, t) {
  let s = c.start; const L = c.loco;
  for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.t > t) break; s = t >= a.t + a.dur ? a.to : a.from; }
  return s;
}

const stamp = new Uint8Array(N);
export function fold(list, t, c, pose = newPose()) {
  pose.fill(0); const add = c._add || (c._add = newPose()); add.fill(0);
  const at = standAt(c, t); pose[CH.r_x] = at.x; pose[CH.r_z] = at.z; pose[CH.r_yaw] = at.yaw;
  for (let n = 0; n < list.length; n++) {
    const a = list[n]; if (a.t > t) break;
    const m = a.m, end = a.t + a.dur, held = m.hold && t > end && t <= a.holdEnd;
    if ((t > end && !held) || a.dur <= 0) continue;
    const tl = held ? a.dur : t - a.t, u = Math.min(1, tl / a.dur);
    const w = (a.fi > 0 ? smooth(tl / a.fi) : 1) * (a.fo > 0 && !m.hold ? smooth((end - t) / a.fo) : 1);
    a.at = at;
    let o, e = 1;
    if (m.kind === 'pose') { o = a.pose; e = poseEnv(tl, a.dur, m, a.p) * (a.p.amount ?? 1); }
    else if (m.kind === 'keys') o = evalKeys(a.keys, u);
    else o = FN[m.fn || a.name](u, tl, a, c);
    stamp.fill(0);
    for (const k in o) {
      if (k === 'add') { const ad = o.add; for (const j in ad) { const i = CH[j]; if (i !== undefined && ad[j] === ad[j]) add[i] += ad[j] * w; } continue; }
      const i = CH[k], v = o[k] * e; if (i === undefined || v !== v) continue;
      if (ABS.has(i)) pose[i] = v; else { pose[i] += (v - pose[i]) * w; stamp[i] = 1; }
    }
    const mk = a.mask; for (let q = 0; q < mk.length; q++) if (!stamp[mk[q]]) pose[mk[q]] -= pose[mk[q]] * w;
  }
  for (let i = 0; i < N; i++) pose[i] += add[i];
  return pose;
}
