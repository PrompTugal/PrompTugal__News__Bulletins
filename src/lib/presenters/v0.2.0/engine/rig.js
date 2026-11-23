/* rig.js: build(spec) turns one entry of characters.json into a live character with apply(pose, springs, t).
 * This is version 1's build()/apply(state) pair. apply() is the only place where channel numbers become joint
 * rotations, so the sign conventions of channels.js are enforced here and nowhere else. */
import * as THREE from '../vendor/three.module.min.js';
import { BODIES } from './bodies.js';
import { makeStyle } from './materials.js';
import { NAMES, N } from './channels.js';
import { clamp, smooth } from './math.js';

const RS = { sw: 0, out: 0, el: 0, tw: 0 };

export function build(spec, index = 0) {
  const style = makeStyle(spec.render, spec.looks, index * 7.3 + 1);
  const B = BODIES[spec.kind](spec, style), built = B.kit.build(B.J, style);
  // Glasses have no ink hull, so the sketch-on effect hides them with the eyes until the head is drawn.
  if (B.features) B.features.push(...built.filter((m) => m.userData.slot === 'glass' || m.userData.slot === 'noink'));
  const J = B.J, d = B.d, P = {}, rest = B.rest;
  const fingers = { L: [], R: [] }, danglers = [];
  for (const k in J) { if (k[0] === '_') continue; const m = /^f([LR])(\d)$/.exec(k); if (m) fingers[m[1]][+m[2]] = J[k]; else if (J[k].userData.restRot) danglers.push(J[k]); }
  const springJ = (spec.springs || []).map((s) => J[s.joint]);
  // A spring adds its lag to its joint (below). Joints that apply() does not set outright every frame (an antenna, a
  // tuft, a key) would otherwise keep the last frame's lag, and a frame would depend on the frames drawn before it.
  // So each spring joint goes back to its built rotation and scale first (bulletins.d@, 22 Nov 2026).
  const springBase = springJ.map((j) => j && { r: j.rotation.clone(), s: j.scale.clone() });
  const sketch = (spec.specials || []).includes('sketchOn');
  const c = { id: spec.id, spec, style, J, d, B, P, object: J.root, baseY: 0, height: d.height };
  c.apply = (pose, sp, t, env = {}) => {
    for (let i = 0; i < springJ.length; i++) if (springJ[i]) { springJ[i].rotation.copy(springBase[i].r); springJ[i].scale.copy(springBase[i].s); }
    for (let i = 0; i < N; i++) P[NAMES[i]] = pose[i];
    const p = P;
    // Crouch folds both legs by one angle: thigh forward, knee twice that, ankle back, so the foot stays under the hip.
    const th = clamp(p.crouch, 0, 1.3) * 1.05, drop = (d.thigh + d.shin) * (1 - Math.cos(th));
    J.root.position.set(p.r_x, c.baseY, p.r_z); J.root.rotation.y = p.r_yaw;
    const sy = Math.max(0.3, 1 + p.r_sy), k = 1 / Math.sqrt(sy);       // squash and stretch keeps the volume
    J.body.position.y = p.r_y; J.body.scale.set(k, sy, k);
    if (B.cube) { J.body.rotation.set(0, 0, 0); J.hips.rotation.set(p.r_pitch + p.hp_x, p.hp_y, p.r_roll + p.hp_z); }
    else { J.body.rotation.set(p.r_pitch, 0, p.r_roll); J.hips.rotation.set(p.hp_x, p.hp_y, p.hp_z); }
    J.hips.position.y = d.hip - drop;
    J.spine.rotation.set(p.sp_x, p.sp_y, p.sp_z); J.chest.rotation.set(p.ch_x, p.ch_y, p.ch_z);
    J.neck.rotation.set(p.h_pitch * 0.3, p.h_yaw * 0.35, p.h_roll * 0.3); J.head.rotation.set(p.h_pitch * 0.7, p.h_yaw * 0.65, p.h_roll * 0.7);
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1, r0 = rest[s], a = (n) => p['a' + s + '_' + n], l = (n) => p['l' + s + '_' + n];
      // The relaxed arm pose (and the way a prop is carried) fades out as a move takes the arm over, so a gesture's
      // angles mean the same on an empty hand and on one that was holding a tablet.
      const act = 1 - smooth((Math.abs(a('sw')) + Math.abs(a('out')) + 0.5 * Math.abs(a('el')) + 0.5 * Math.abs(a('tw'))) / 0.7), r = RS; r.sw = r0.sw * act; r.out = r0.out * act; r.el = r0.el * act; r.tw = r0.tw * act;
      const arm = J['arm' + s]; arm.rotation.set(-(a('sw') + r.sw), -sx * (a('tw') + r.tw), sx * (a('out') + r.out)); arm.position.y = arm.userData.rest.y + a('sh') * 0.045;
      J['el' + s].rotation.x = -Math.max(0, a('el') + r.el);
      J['wr' + s].rotation.set(-a('wx'), 0, sx * a('wz'));
      const fs = fingers[s];
      for (let i = 0; i < fs.length; i++) {
        const f = fs[i]; if (!f) continue; const rr = f.userData.restRot || [0, 0, 0], cu = clamp(a('f' + Math.min(i, 4)) + B.curl, -0.2, 1.1);
        if (f.userData.feather) f.rotation.set((1 - i) * (0.28 - cu * 0.25), 0, 0);
        else if (f.userData.thumb) f.rotation.set(rr[0] + cu * 0.55, 0, -sx * cu * 0.95);
        else f.rotation.set(rr[0], 0, -sx * cu * 1.65);
      }
      J['leg' + s].rotation.set(-(l('sw') + th), 0, sx * l('out')); J['kn' + s].rotation.x = Math.max(0, l('kn')) + 2 * th; J['an' + s].rotation.x = l('an') - th;
    }
    for (const j of danglers) { const r = j.userData.restRot; j.rotation.set(r[0], r[1], r[2]); j.scale.set(1, 1, 1); }
    if (J.jelly) { J.jelly.rotation.set(p.h_pitch * 0.5 + p.sp_x + p.ch_x, p.h_yaw * 0.6 + p.ch_y, p.h_roll * 0.6 + p.ch_z + p.sp_z); J.jelly.scale.set(1, 1, 1); J.head.rotation.set(0, 0, 0); J.neck.rotation.set(0, 0, 0); J.spine.rotation.set(0, 0, 0); J.chest.rotation.set(0, 0, 0); }
    // Secondary motion: each spring's lag turns (or stretches) the joint it hangs from.
    if (sp) for (let i = 0; i < springJ.length; i++) {
      const j = springJ[i], s = spec.springs[i], v = clamp(sp[i], -s.max, s.max); if (!j) continue;
      if (s.axis === 'sy') { const q = Math.max(0.4, 1 + v); j.scale.set(1 / Math.sqrt(q), q, 1 / Math.sqrt(q)); } else j.rotation[s.axis] += v;
    }
    B.face.update(p, t);
    if (sketch && B.features) { const on = p.fx1 < 0.9; for (const f of B.features) f.visible = on; }
    if (B.extra) B.extra(p, t, env);
    style.shared.uBaseY.value = c.baseY; style.shared.uSpanY.value = d.height * 1.04;
    style.update(t, style.render === 'hologram' ? { glitch: p.fx1, mat: p.fx2, sweep: p.fx3 > 0.001 ? p.fx3 * 1.3 - 0.15 : -1 } : { reveal: sketch ? p.fx1 : 0 });
  };
  return c;
}
