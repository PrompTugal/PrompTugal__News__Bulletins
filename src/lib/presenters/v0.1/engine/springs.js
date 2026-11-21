/* springs.js: secondary motion. A tie, a tuft of hair, an antenna or a key does not move with the body: it is
 * dragged by it, arrives late and overshoots. Each spring follows a "drive", a weighted sum of pose channels named
 * in characters.json, and what the rig uses is the lag between the two.
 *
 * Determinism: a spring has memory, so it cannot be computed from t alone the way a pose can. The contract is kept
 * by fixing the path instead: every spring is integrated with semi-implicit Euler on one fixed grid (STEP seconds)
 * that always starts at rest at t = 0. A checkpoint is kept every second. Playing forward costs one or two steps a
 * frame; a seek restores the nearest checkpoint at or before t and steps from there, which visits exactly the same
 * grid points with exactly the same arithmetic as a run from 0. The frame rate of the page never enters into it. */
import { CH } from './channels.js';

export const STEP = 1 / 120, PER_SEC = 120;

export class Springs {
  /* defs: the "springs" list of one character. poseAt(t) must be a pure function returning a pose array. */
  constructor(defs, poseAt) {
    this.defs = (defs || []).map((d) => ({ w: 2 * Math.PI * d.hz, z: d.zeta, drive: Object.entries(d.drive).map(([k, g]) => [CH[k], g]) }));
    this.n = this.defs.length; this.poseAt = poseAt; this.reset();
  }
  reset(fromT = 0) { // forget checkpoints after fromT (the playground calls this when an action is added)
    if (!this.cp || fromT <= 0) { this.cp = new Map(); this.k = -1; this.y = new Float64Array(this.n); this.v = new Float64Array(this.n); this.x = new Float64Array(this.n); this.out = new Float64Array(this.n); return; }
    const s = Math.floor(fromT); for (const key of [...this.cp.keys()]) if (key > s) this.cp.delete(key); this.k = -1;
  }
  drive(k, x) { const p = this.poseAt(k * STEP); for (let i = 0; i < this.n; i++) { let s = 0; for (const [c, g] of this.defs[i].drive) s += p[c] * g; x[i] = s; } }
  /* The lag of every spring at t. t is snapped to the grid: at 60 or 120 frames a second every frame is a grid point. */
  at(t) {
    if (!this.n) return this.out;
    const K = Math.max(0, Math.round(t * PER_SEC));
    if (this.k < 0 || K < this.k || K - this.k > PER_SEC * 2) {         // not next in line: go back to a checkpoint
      let s = Math.floor(K / PER_SEC); while (s > 0 && !this.cp.has(s)) s--;
      if (s > 0) { const c = this.cp.get(s); this.y.set(c.y); this.v.set(c.v); this.k = s * PER_SEC; }
      else { this.k = 0; this.drive(0, this.x); this.y.set(this.x); this.v.fill(0); }
    }
    while (this.k < K) {
      this.k++; this.drive(this.k, this.x);
      for (let i = 0; i < this.n; i++) { const d = this.defs[i]; this.v[i] += (d.w * d.w * (this.x[i] - this.y[i]) - 2 * d.z * d.w * this.v[i]) * STEP; this.y[i] += this.v[i] * STEP; }
      if (this.k % PER_SEC === 0 && !this.cp.has(this.k / PER_SEC)) this.cp.set(this.k / PER_SEC, { y: this.y.slice(), v: this.v.slice() });
    }
    this.drive(K, this.x); for (let i = 0; i < this.n; i++) this.out[i] = this.y[i] - this.x[i];
    return this.out;
  }
}
