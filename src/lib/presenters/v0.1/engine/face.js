/* face.js: the parts of a face that act. Version 1 had an ellipse that opened with loudness and eyes that squashed
 * to blink. Here: eyeballs that turn, lids that close over them, brows, and a mouth mesh whose outline is computed
 * from four numbers (jaw, width, smile, special), so it can show the visemes A to H and X and any blend of them. */
import * as THREE from '../vendor/three.module.min.js';
import { at, merge, torus } from './geometry.js';
import { lerp, clamp, TAU } from './math.js';

const BASIC = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

/* Ball eyes for the human figures and the owl. The eyeball turns to look; the highlight does not, which is what
 * makes an eye read as wet and alive. o: x, y, z, r, iris, skin, ink, white. */
export function ballEyes(parent, style, o) {
  const eyes = [], r = o.r, flatMat = style.render === 'hologram' ? style.material('fill') : BASIC;
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * o.x, o.y, o.z); parent.add(g);
    const cap = (th, rr) => at(new THREE.SphereGeometry(rr, 28, 8, 0, TAU, 0, th), [0, 0, 0], [Math.PI / 2, 0, 0]);
    const ball = new THREE.Mesh(merge([[new THREE.SphereGeometry(r, 28, 20), o.white || '#fbfaf6'], [cap(o.irisA ? o.irisA + 0.07 : 0.69, r * 1.008), o.limb || '#1a1410'], [cap(o.irisA || 0.62, r * 1.016), o.iris || '#4a2e1a'], [cap((o.irisA || 0.62) * 0.48, r * 1.024), '#050506']]), style.render === 'realistic' ? style.material('eye') : flatMat);
    g.add(ball);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(r * 0.30, r * 0.36, r * 0.93); g.add(hl);
    const lidR = r * 1.1, lash = at(torus(lidR, r * (o.lash ?? 0.075), 28, 6), [0, 0, 0], [Math.PI / 2, 0, 0]);
    const up = new THREE.Mesh(merge([[new THREE.SphereGeometry(lidR, 28, 10, 0, TAU, 0, Math.PI / 2), o.skin], [lash, o.ink || '#1b1b1f']]), style.material(o.slot || 'fill'));
    const low = new THREE.Mesh(merge([[new THREE.SphereGeometry(lidR, 28, 10, 0, TAU, Math.PI / 2, Math.PI / 2), o.skin]]), style.material(o.slot || 'fill'));
    g.add(up); g.add(low); eyes.push({ g, ball, up, low, hl, sx });
  }
  return { eyes, update(p) {
    for (const e of eyes) {
      e.ball.rotation.set(-p.lookY * 0.42, p.lookX * 0.55, 0);
      const open = -(o.open ?? 0.60) - 0.28 * p.wide + 0.30 * p.squint + p.lookY * -0.18;
      e.up.rotation.x = lerp(open, 0.66, p.blink);
      e.low.rotation.x = lerp(0.80 - 0.42 * p.squint - 0.12 * Math.max(0, p.smile), 0.52, p.blink);
      e.hl.visible = p.blink < 0.6;
    }
  } };
}
/* Screen eyes for the box robots and the cube: flat shapes that squash to blink and slide to look. */
export function flatEyes(parent, mat, o) {
  const eyes = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * o.x, o.y, o.z); parent.add(g);
    const list = [[new THREE.CircleGeometry(o.r, 28), o.color]];
    if (o.glint) list.push([at(new THREE.CircleGeometry(o.r * 0.28, 12), [o.r * 0.3, o.r * 0.32, 0.0006]), '#ffffff']);
    const m = new THREE.Mesh(merge(list), mat || BASIC); g.add(m); eyes.push({ g, m, sx, x0: sx * o.x, y0: o.y });
  }
  return { eyes, update(p, big = 0) {
    for (const e of eyes) {
      e.g.position.x = e.x0 + p.lookX * o.r * 0.7; e.g.position.y = e.y0 + p.lookY * o.r * 0.6;
      const k = 1 + (e.sx < 0 ? big : 0);          // the eye behind the lens (held in the right hand) swells
      e.m.scale.set((1 + 0.18 * p.wide) * k, Math.max(0.07, (1 - p.blink) * (1 + 0.3 * p.wide - 0.45 * p.squint)) * k, 1);
    }
  } };
}
// Brows: two bars that rise, fall and tilt. o: x, y, z, w, t, color, tilt (rest tilt), yaw (wrap round the head).
export function brows(parent, mat, o) {
  const bs = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * o.x, o.y, o.z); g.rotation.y = sx * (o.yaw || 0); parent.add(g);
    const geo = new THREE.CapsuleGeometry(o.t, o.w, 4, 10); at(geo, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, o.flat || 0.6]);
    const m = new THREE.Mesh(merge([[geo, o.color]]), mat || BASIC); g.add(m); bs.push({ g, m, sx, y0: o.y });
  }
  return { groups: bs.map((b) => b.g), update(p) {
    for (const b of bs) {
      const lift = (b.sx < 0 ? p.browR : p.browL);   // sx < 0 is the character's right side
      b.g.position.y = b.y0 + lift * (o.travel || 0.012);
      b.m.rotation.z = b.sx * (p.browAng * 0.42 - (o.tilt || 0));   // + browAng lowers the inner ends: a frown
    }
  } };
}

/* The mouth. cols columns across; for each, an upper and a lower lip point. Strips between them make the dark
 * inside, the teeth, the tongue and the lip lines. Only vertex positions change per frame.
 * o: w (half width), h (full open height), z(x, y) surface depth, colours, lip (line thickness). */
export class Mouth {
  constructor(parent, mat, o) {
    this.o = o; const n = this.n = 17; this.strips = ['inside', 'teeth', 'tongue', 'lipU', 'lipL'];
    const cols = { inside: o.inside || '#3a0d12', teeth: o.teeth || '#ffffff', tongue: o.tongue || '#d4606a', lipU: o.lipColor, lipL: o.lipColor };
    const nv = this.strips.length * n * 2, P = new Float32Array(nv * 3), C = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), idx = [];
    this.strips.forEach((s, k) => {
      const c = new THREE.Color(cols[s]);
      for (let i = 0; i < n * 2; i++) { const v = k * n * 2 + i; C[v * 3] = c.r; C[v * 3 + 1] = c.g; C[v * 3 + 2] = c.b; Nn[v * 3 + 2] = 1; }
      for (let i = 0; i < n - 1; i++) { const a = k * n * 2 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat || BASIC); this.mesh.frustumCulled = false; this.mesh.position.set(0, o.y, 0); parent.add(this.mesh); this.P = P;
  }
  update(p) {
    const o = this.o, n = this.n, P = this.P, zf = o.z, lt = o.lip || 0.0035;
    const jaw = clamp(p.jaw, 0, 1.2), wide = clamp(p.mW, -1, 1), sm = clamp(p.smile, -1, 1);
    const hw = o.w * (1 + 0.28 * Math.max(0, wide) + 0.42 * Math.min(0, wide) + 0.16 * Math.max(0, sm));
    const open = jaw * o.h * (1 + 0.25 * Math.max(0, -wide));
    const teeth = clamp(jaw * 3 + p.mF, 0, 1), tongue = clamp(Math.max(p.mL, (jaw - 0.5) * 1.4), 0, 1);
    for (let i = 0; i < n; i++) {
      const s = (i / (n - 1)) * 2 - 1, x = s * hw, env = Math.pow(Math.max(0, 1 - s * s), 0.55 + 0.5 * Math.max(0, -wide));
      const mid = sm * o.w * 0.36 * (s * s - 0.35) - open * 0.12;
      const yu = mid + open * 0.30 * env + (p.mF > 0 ? 0 : 0), yl = mid - open * 0.70 * env + p.mF * open * 0.5 * env;
      const edge = Math.pow(Math.max(0, 1 - s * s), 0.3), l = lt * (0.35 + 0.65 * edge);
      const z = zf(x, o.y + mid), put = (k, a, b, dz) => { const v = (k * n * 2 + i * 2) * 3; P[v] = x; P[v + 1] = a; P[v + 2] = z + dz; P[v + 3] = x; P[v + 4] = b; P[v + 5] = z + dz; };
      put(0, yu, yl, 0.0000);
      put(1, yu, yu - Math.min(yu - yl, o.h * 0.26) * teeth * edge, 0.0005);
      put(2, yl + (yu - yl) * (0.34 + 0.4 * p.mL) * tongue * Math.pow(edge, 3), yl, 0.0005);
      put(3, yu + l, yu - l * 0.4, 0.0010);
      put(4, yl + l * 0.4, yl - l * (o.lowerLip || 1), 0.0010);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
