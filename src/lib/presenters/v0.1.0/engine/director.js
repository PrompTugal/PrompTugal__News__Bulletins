/* director.js: layer 3, the actions. Version 1's direct(timeline) wrote speak, blink, nod, look and point from a
 * bulletin's timeline by rule. This director reads choreography.json instead: cues such as
 *   { "t": 12, "who": "front", "do": "wave", "stagger": 0.15 }
 * and turns each into one action per character. It also does what version 1's director did by itself: it places
 * blinks from a seeded generator, keeps everyone breathing, and fills quiet stretches with each character's fidget.
 * Everything it produces is a plain list of actions; state.js folds them at any t. */
import { KIND } from './moves.js';
import { prepare, fold, standAt } from './state.js';
import { Springs } from './springs.js';
import { rng, ease, lerp, deg, clamp } from './math.js';
import { newPose } from './channels.js';

const RESERVED = new Set(['t', 'who', 'do', 'dur', 'stagger']);
const PACE = { biped: 1, waddle: 0.55, roll: 0.9, glide: 1.25 };
const BUSY = new Set(['gesture', 'locomotion', 'reaction', 'special', 'head']);

export class Director {
  /* specs: characters.json's presenters. moves: moves.json. chor: choreography.json (or { cues: [] }).
   * chars: id -> built character (for its dimensions). tracks: name -> Rhubarb output, for speak. */
  constructor({ specs, moves, chor, chars, tracks = {} }) {
    this.specs = specs; this.M = moves; this.chor = chor; this.duration = chor.duration || 60; this.ctx = {}; this.ids = specs.map((s) => s.id);
    specs.forEach((spec, n) => {
      const ch = chars[spec.id];
      this.ctx[spec.id] = { id: spec.id, spec, n, kind: { ...KIND[spec.kind], gait: spec.gait || KIND[spec.kind].gait }, d: ch.d, baseY: ch.baseY, B: ch.B, tracks, visemes: moves.visemes, expressions: moves.expressions,
        start: { x: spec.slot[0], z: spec.slot[1], yaw: 0 }, loco: [], list: [], pose: newPose(), scratch: newPose(), key: NaN };
    });
    this.cues = (chor.cues || []).slice(); this.changedFrom = 0; this.build();
  }
  members(who) { const g = this.chor.groups || {}; if (Array.isArray(who)) return who.flatMap((w) => this.members(w)); if (who === 'all' || who == null) return this.ids; return g[who] || [who]; }
  build() {
    const per = Object.fromEntries(this.ids.map((id) => [id, []]));
    for (const cue of this.cues) this.members(cue.who).forEach((id, i) => {
      if (!per[id]) return; const p = {}; for (const k in cue) if (!RESERVED.has(k)) p[k] = cue[k];
      per[id].push({ who: id, name: cue.do, t: cue.t + i * (cue.stagger || 0), dur: cue.dur, p });
    });
    const auto = this.chor.auto || {};
    for (const id of this.ids) {
      const c = this.ctx[id], list = per[id].sort((a, b) => a.t - b.t), spec = c.spec, r = rng('director:' + id);
      // Locomotion: each action starts where the last one ended.
      let cur = { ...c.start }, lastLook = null; c.loco = [];
      for (const a of list) {
        const m = this.M.moves[a.name]; if (!m) throw new Error(`cue at ${a.t}: unknown move "${a.name}"`);
        if (m.loco) {
          a.from = { ...cur }; let to = { ...cur };
          if (a.name === 'turn') to.yaw = deg(a.p.yaw ?? 90);
          else if (a.name !== 'spin') {
            const tp = a.p.to, by = a.p.by; if (tp === 'slot' || tp == null && !by) { to.x = spec.slot[0]; to.z = spec.slot[1]; } else if (by) { to.x = cur.x + by[0]; to.z = cur.z + (by[1] || 0); } else { to.x = tp[0]; to.z = tp[tp.length - 1]; }
            to.yaw = deg(a.p.yaw ?? 0);
            if (a.name === 'place') a.dur = 0; else if (!(a.dur > 0)) a.dur = Math.max(0.6, Math.hypot(to.x - cur.x, to.z - cur.z) / ((a.p.speed ?? m.params.speed.default) * (PACE[c.kind.gait] || 1)));
          }
          a.to = to; cur = to; c.loco.push(a);
        }
        if (a.name === 'look') { a.from = { lookX: lastLook ? lastLook.toX : 0 }; a.toX = a.p.dir === 'content' ? -(a.p.amount ?? 0.85) : a.p.dir === 'away' ? 0.85 : 0; if (lastLook) lastLook.holdEnd = a.t; a.holdEnd = Infinity; lastLook = a; }
      }
      // The automatic layer, as version 1's director had: breathing, weight shifts, seeded blinks, fidgets in the gaps.
      const end = this.duration, extra = [];
      if (auto.idle !== false) { extra.push({ who: id, name: 'breathe', t: 0, dur: end + 1, p: {}, auto: true }, { who: id, name: 'weightShift', t: 0, dur: end + 1, p: {}, auto: true }); }
      if (auto.blink !== false) for (let t = 0.8 + r() * 1.5; t < end; t += 2.6 + r() * 1.8) { extra.push({ who: id, name: 'blink', t, dur: 0.16, p: {}, auto: true }); if (r() < 0.18) extra.push({ who: id, name: 'blink', t: t + 0.26, dur: 0.14, p: {}, auto: true }); }
      if (auto.fidget !== false) {
        const busy = list.filter((a) => BUSY.has(this.M.moves[a.name].group) || this.M.moves[a.name].loco).map((a) => [a.t - 0.4, a.t + (a.dur || this.M.moves[a.name].dur || 0) + 0.6]).sort((a, b) => a[0] - b[0]);
        let t = (auto.from ?? 0) + r() * 2; const quiet = (auto.quiet || []);
        while (t < end - 3) {
          const len = 2.2 + r() * 0.8, hit = busy.find((b) => t < b[1] && t + len > b[0]) || quiet.find((b) => t < b[1] && t + len > b[0]);
          if (hit) { t = hit[1] + 0.3 + r() * 0.8; continue; }
          extra.push(r() < 0.45 ? { who: id, name: 'fidget', t, dur: len, p: {}, auto: true } : { who: id, name: 'lookAround', t, dur: len + 0.6, p: {}, auto: true });
          t += len + 2.5 + r() * 3.5;
        }
      }
      c.list = [...list, ...extra].map((a) => prepare(a, this.M.moves, spec, this.M.blend)).sort((a, b) => a.t - b.t);
      c.key = NaN;
      // The springs read c.list afresh at every step, so they survive a rebuild; only what lies after the change is forgotten.
      if (!c.springs) c.springs = new Springs(spec.springs, (t) => fold(c.list, t, c, c.scratch)); else c.springs.reset(this.changedFrom);
    }
  }
  // Add a cue while running (the playground does this), and rebuild the lists.
  addCue(cue) { this.cues.push(cue); this.changedFrom = cue.t; this.build(); }
  clearCues(keep = () => false, from = 0) { this.cues = this.cues.filter(keep); this.changedFrom = from; this.build(); }
  actionsOf(id) { return this.ctx[id].list; }
  poseAt(id, t) { const c = this.ctx[id]; if (c.key !== t) { fold(c.list, t, c, c.pose); c.key = t; } return c.pose; }
  standAt(id, t) { return standAt(this.ctx[id], t); }
  /* Everything a renderer needs for the frame at t. */
  frame(t, ids = this.ids) {
    const poses = {}, springs = {};
    for (const id of ids) { springs[id] = this.ctx[id].springs.at(t); poses[id] = this.poseAt(id, t); }
    return { poses, springs };
  }
  // A shot: either explicit { pos, look, fov } or framed on characters { focus, dist, orbit, h, lh, fov }.
  shot(s, t) {
    if (!s.focus) return { pos: s.pos, look: s.look, fov: s.fov || 28 };
    const ids = this.members(s.focus); let x = 0, z = 0, y = 0, H = 0;
    for (const id of ids) { const c = this.ctx[id], p = standAt(c, t); x += p.x / ids.length; z += p.z / ids.length; y += c.baseY / ids.length; H = Math.max(H, c.d.height); }
    const o = deg(s.orbit || 0), dist = s.dist ?? 4.2;
    return { pos: [x + Math.sin(o) * dist + (s.dx || 0), y + H * (s.h ?? 0.62), z + Math.cos(o) * dist], look: [x + (s.dx || 0), y + H * (s.lh ?? 0.56), z], fov: s.fov || 28 };
  }
  cameraAt(t, focus = null) {
    if (focus) return this.shot({ focus, dist: 2.2 + this.ctx[focus].d.height * 1.55, h: 0.6, lh: 0.52, fov: 28 }, t);
    const S = this.chor.camera || []; if (!S.length) return { pos: [0, 2.0, 11.5], look: [0, 1.15, -1], fov: 28 };
    let i = 0; while (i < S.length - 1 && S[i + 1].t <= t) i++;
    const A = this.shot(S[i], t), nx = S[i + 1]; if (!nx || nx.cut || t <= S[i].t) return A;
    const B = this.shot(nx, t), k = ease(nx.ease || 'inOut', (t - S[i].t) / (nx.t - S[i].t)), L = (a, b) => a.map((v, j) => lerp(v, b[j], k));
    return { pos: L(A.pos, B.pos), look: L(A.look, B.look), fov: lerp(A.fov, B.fov, k) };
  }
  // A shot may name the only characters to draw ("only"): a close-up on the back row clears the front row out of its way.
  onlyAt(t, focus = null) { if (focus) return null; const S = this.chor.camera || []; let o = null; for (const s of S) { if (s.t > t) break; o = s.only ? this.members(s.only) : null; } return o; }
  beatAt(t) { const B = this.chor.beats || []; let b = null; for (const x of B) if (x.t <= t) b = x; return b; }
}
