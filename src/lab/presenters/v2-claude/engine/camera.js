/* camera.js: cinematic camera cues (presenters 0.3.0, bulletins.d@PrompTugal.dinis, 24 Nov 2026), for c.studio's
 * bigger scenes. A cue: { t, do: 'camera', move, to, dt, ease }.
 *   dolly-in   move towards what the camera looks at; to = the fraction of the distance (default 0.4; negative backs out)
 *   orbit      circle round what it looks at; to = degrees (default 60; negative goes the other way)
 *   crane-up   rise; to = metres (default 2; negative goes down); the look point rises a quarter as much
 *   push-to    travel to a target and frame it; to = [x, y, z], a presenter id, or a scene anchor ('sun:2', 'agent:17')
 *   reset      go back to the base shot
 * The shot at t: start from the base shot (the mount's camera track), then apply every cue that has begun, in order,
 * each by its eased progress. Nothing is kept between frames, so any t can be asked for in any order. */
import { ease, clamp, lerp } from './math.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1e-9, mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const MOVES = ['dolly-in', 'orbit', 'crane-up', 'push-to', 'reset'];

/* cues: the camera cues (t already in seconds). base(t): the base shot { pos, look, fov }. target(to, t): { p, r }. */
export function cameraCues(cues, base, target) {
  const list = cues.slice().sort((a, b) => a.t - b.t);
  for (const c of list) if (!MOVES.includes(c.move)) throw new Error(`camera cue at ${c.t}: unknown move "${c.move}" (known: ${MOVES.join(', ')})`);
  return function at(t) {
    const b = base(t); let s = { pos: b.pos.slice(), look: b.look.slice(), fov: b.fov || 28 };
    for (const c of list) {
      if (c.t > t) break;
      const k = ease(c.ease || 'inOut', clamp((t - c.t) / Math.max(1e-3, c.dt ?? 2), 0, 1));
      if (c.move === 'dolly-in') { const f = (c.to ?? c.by ?? 0.4) * k; s.pos = add(s.pos, mul(sub(s.look, s.pos), f)); }
      else if (c.move === 'orbit') { const a = (c.to ?? 60) * Math.PI / 180 * k, d = sub(s.pos, s.look), ca = Math.cos(a), sa = Math.sin(a); s.pos = add(s.look, [d[0] * ca + d[2] * sa, d[1], -d[0] * sa + d[2] * ca]); }
      else if (c.move === 'crane-up') { const h = (c.to ?? 2) * k; s.pos = add(s.pos, [0, h, 0]); s.look = add(s.look, [0, h * 0.25, 0]); }
      else if (c.move === 'push-to') {
        const tg = target(c.to, t), dir = sub(s.pos, s.look), u = mul(dir, 1 / len(dir)), d = c.dist ?? tg.r;
        s.look = mix(s.look, tg.p, k); s.pos = mix(s.pos, add(tg.p, mul(u, d)), k); if (c.fov) s.fov = lerp(s.fov, c.fov, k);
      } else if (c.move === 'reset') { s.pos = mix(s.pos, b.pos, k); s.look = mix(s.look, b.look, k); s.fov = lerp(s.fov, b.fov || 28, k); }
    }
    return s;
  };
}
