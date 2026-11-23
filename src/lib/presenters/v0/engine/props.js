/* props.js: things the presenters carry that are not part of any body (presenters 0.2.0, bulletins.d@PrompTugal.dinis,
 * 23 Nov 2026, for sherpa.d's journey stories). The first prop is a rope. A prop is directed by its own keys, not by
 * the cues: at time t the last key at or before t says what the rope is doing.
 *   { t, mode: 'coil', on: 'anchor' }                 coiled over a shoulder (on: 'id' or 'id.R' for the right one)
 *   { t, mode: 'hand', on: 'anchor.L' }               coiled and carried in one hand
 *   { t, mode: 'line', ends: [A, B], length, sway }   stretched between two ends; it sags if length is longer than the gap
 *   { t, mode: 'hang', from: [x, y, z], length }       hanging straight down from a point (a climbing rope)
 *   { t, mode: 'none' }                                 not on stage
 * An end is a stage point [x, y, z], or a grip: 'id.L', 'id.R' or 'id.hands' (between both hands).
 * Determinism: every frame is a function of t and of the poses already applied for that frame; nothing is kept
 * between frames. A character a rope needs is posed even when the camera cannot see it (stage.js asks uses()). */
import * as THREE from '../vendor/three.module.min.js';

const V = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const tmp = V(), tmp2 = V(), M = new THREE.Matrix4(), Q = new THREE.Matrix4();

export function makeRope(def, stage) {
  const keys = (def.keys || []).slice().sort((a, b) => a.t - b.t), S = 64, R = 8, radius = def.radius ?? 0.016;
  const mat = new THREE.MeshStandardMaterial({ color: def.color || '#c9a46a', roughness: 0.92, metalness: 0 });
  const twist = new THREE.MeshStandardMaterial({ color: def.stripe || '#8a6a3c', roughness: 0.92, metalness: 0 });
  // The line: a tube whose points are rewritten every frame.
  const pos = new Float32Array((S + 1) * (R + 1) * 3), idx = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const uv = new Float32Array((S + 1) * (R + 1) * 2); for (let i = 0; i <= S; i++) for (let j = 0; j <= R; j++) { uv[(i * (R + 1) + j) * 2] = i / S; uv[(i * (R + 1) + j) * 2 + 1] = j / R; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const line = new THREE.Mesh(geo, mat); line.frustumCulled = false;
  // The coil: three loops of slightly different size, as a real coil lies; the middle one darker, so the loops read apart.
  const coil = new THREE.Group();
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(1 + (i - 1) * 0.045, 0.085, 10, 48), i === 1 ? twist : mat); m.rotation.z = (i - 1) * 0.12; m.position.z = (i - 1) * 0.06; coil.add(m); }
  coil.matrixAutoUpdate = false;
  const group = new THREE.Group(); group.add(line, coil); stage.scene.add(group);
  const P = Array.from({ length: S + 1 }, V);

  const keyAt = (t) => { let k = null; for (const x of keys) { if (x.t > t) break; k = x; } return k; };
  const parse = (ref) => { if (Array.isArray(ref)) return null; const [id, s] = String(ref).split('.'); return { id, s: s || 'hands' }; };
  function uses(t) {
    const k = keyAt(t); if (!k) return [];
    if (k.mode === 'coil' || k.mode === 'hand') return [parse(k.on).id];
    if (k.mode === 'line') return k.ends.map(parse).filter(Boolean).map((r) => r.id);
    return [];
  }
  // The world point a hand grips: a little below the wrist, in the palm.
  function grip(c, s, out) { const w = c.J['wr' + s]; w.updateWorldMatrix(true, false); return out.set(0, -0.075, 0.01).applyMatrix4(w.matrixWorld); }
  function end(ref, out) {
    if (Array.isArray(ref)) return out.set(ref[0], ref[1], ref[2]);
    const r = parse(ref), c = stage.byId[r.id]; if (!c) throw new Error('rope: no presenter "' + r.id + '"');
    if (r.s === 'hands') { grip(c, 'L', out); grip(c, 'R', tmp2); return out.add(tmp2).multiplyScalar(0.5); }
    return grip(c, r.s, out);
  }
  function tube() {
    let n0 = V().crossVectors(P[1].clone().sub(P[0]), UP); if (n0.lengthSq() < 1e-8) n0.set(1, 0, 0); n0.normalize();
    const T = V(), N = n0, B = V();
    for (let i = 0; i <= S; i++) {
      T.subVectors(P[Math.min(S, i + 1)], P[Math.max(0, i - 1)]).normalize();
      B.crossVectors(T, N).normalize(); N.crossVectors(B, T).normalize();      // parallel transport: no sudden twists
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * Math.PI * 2, o = (i * (R + 1) + j) * 3, cx = Math.cos(a) * radius, cy = Math.sin(a) * radius;
        pos[o] = P[i].x + N.x * cx + B.x * cy; pos[o + 1] = P[i].y + N.y * cx + B.y * cy; pos[o + 2] = P[i].z + N.z * cx + B.z * cy;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  }
  function update(t) {
    const k = keyAt(t); line.visible = false; coil.visible = false; if (!k || k.mode === 'none') return;
    if (k.mode === 'coil' || k.mode === 'hand') {
      const r = parse(k.on), c = stage.byId[r.id]; coil.visible = true;
      if (k.mode === 'coil') { // across the body like a bandolier: over one shoulder and under the other arm
        const ch = c.J.chest; ch.updateWorldMatrix(true, false); const sx = r.s === 'R' ? -1 : 1, s = c.d.height / 1.82;
        M.compose(tmp.set(0, c.d.chest * 0.55, 0.01), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, sx * 0.72, 'ZYX')), tmp2.set(0.27 * s, 0.205 * s, 0.27 * s));
      } else { // in the hand, hanging down beside the leg
        const w = c.J['wr' + r.s]; w.updateWorldMatrix(true, false);
        M.compose(tmp.set(0, -0.2, 0.01), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), tmp2.set(0.15, 0.15, 0.15));
        coil.matrix.multiplyMatrices(w.matrixWorld, M); return;
      }
      coil.matrix.multiplyMatrices(c.J.chest.matrixWorld, M); return;
    }
    line.visible = true;
    const a = V(), b = V(), sway = k.sway ?? 0.02;
    if (k.mode === 'hang') { end(k.from, a); b.set(a.x + sway * Math.sin(t * 1.3), a.y - (k.length ?? 3), a.z + sway * Math.cos(t * 0.9)); }
    else { end(k.ends[0], a); end(k.ends[1], b); }
    const d = a.distanceTo(b), L = k.length ?? d * 1.04, sag = L > d ? Math.sqrt(3 * d * (L - d) / 8) : 0;  // a parabola of arc length L
    for (let i = 0; i <= S; i++) {
      const f = i / S, w = 4 * f * (1 - f); P[i].lerpVectors(a, b, f);
      P[i].y -= sag * w; if (k.mode === 'line') P[i].x += sway * w * Math.sin(t * 1.1 + f * 2), P[i].z += sway * w * Math.cos(t * 0.8);
    }
    tube();
  }
  return { def, uses, update, group, destroy() { stage.scene.remove(group); geo.dispose(); mat.dispose(); twist.dispose(); } };
}
