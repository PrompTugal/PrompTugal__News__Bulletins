/* geometry.js: the modelling kit. Every presenter is built by code from these primitives, so there are no model
 * files and nothing to trace. A Kit collects coloured primitives per joint and merges them into one mesh per joint,
 * which keeps the draw calls low enough for software WebGL. */
import * as THREE from '../vendor/three.module.min.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
// Place a geometry: scale, then rotate (XYZ), then translate. Returns the same geometry so calls chain.
export function at(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  if (typeof s === 'number') s = [s, s, s];
  M.compose(V.set(p[0], p[1], p[2]), Q.setFromEuler(E.set(r[0], r[1], r[2])), S.set(s[0], s[1], s[2]));
  g.applyMatrix4(M); return g;
}
export const ball = (r, p, s, seg = 24) => at(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.66 | 0)), p, [0, 0, 0], s);
export const cyl = (r0, r1, h, seg = 24, open = false) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
export const torus = (R, r, seg = 40, tseg = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, tseg, seg, arc);
export const disc = (r, seg = 32) => new THREE.CircleGeometry(r, seg);
export const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);

// A limb: a tapered capsule hanging from the origin down -Y by len. Limbs hang from their joint, so a joint's
// rotation swings the limb the way a shoulder or a hip does.
export function limb(r0, r1, len, seg = 18) {
  const pts = [], n = 6;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([r1 * Math.sin(a), -len - r1 * Math.cos(a) * 0.9]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([r0 * Math.cos(a), r0 * Math.sin(a) * 0.9]); }
  pts[0][0] = 0.0001; pts[pts.length - 1][0] = 0.0001;
  return lathe(pts, seg);
}
// A rounded box with smooth normals at the corners, so the ink hull does not split there.
export function rbox(w, h, d, r = 0.02, seg = 5) {
  r = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2), p = g.attributes.position, nrm = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    V.fromBufferAttribute(p, i);
    // Push the grid lines towards the corners so the rounding has vertices where it bends.
    const k = (v, half, hr) => { const u = v / half, a = Math.abs(u); return Math.sign(u) * (a < 0.5 ? a * 2 * hr : hr + (a - 0.5) * 2 * (half - hr)); };
    V.set(k(V.x, w / 2, hx), k(V.y, h / 2, hy), k(V.z, d / 2, hz));
    c.set(THREE.MathUtils.clamp(V.x, -hx, hx), THREE.MathUtils.clamp(V.y, -hy, hy), THREE.MathUtils.clamp(V.z, -hz, hz));
    n.subVectors(V, c); if (n.lengthSq() < 1e-12) n.fromBufferAttribute(nrm, i); n.normalize();
    V.copy(c).addScaledVector(n, r); p.setXYZ(i, V.x, V.y, V.z); nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}
export function tube(pts, r, seg = 24, rseg = 8) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, rseg, false);
}
/* A sculpted head: a sphere pushed into a skull by a few rules (jaw taper, flat face, chin, brow, eye sockets).
 * o: w, h, d half-sizes; jaw 0..1 taper; chin; sockets (for the realistic head). The centre is the origin. */
export function head(o) {
  const g = new THREE.SphereGeometry(1, 56, 44), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i); const q = sculpt(o, V.x, V.y, V.z); p.setXYZ(i, q[0], q[1], q[2]); }
  g.computeVertexNormals(); fixSeam(g, 56, 44); return g;
}
export function sculpt(o, x, y, z) {
  const jaw = o.jaw ?? 0.3, low = Math.max(0, -y), up = Math.max(0, y);
  let sx = 1 - jaw * Math.pow(low, 1.6), sz = 1 - jaw * 0.35 * Math.pow(low, 1.6), py = y;
  if (z > 0) { sz *= 1 - (o.flat ?? 0.12) * z * (1 - 0.5 * up); }            // a flatter face than a ball
  else { sz *= 1 + (o.back ?? 0.08) * (-z) * (0.4 + up); }                   // the back of the skull
  let X = x * sx * o.w, Y = py * o.h, Z = z * sz * o.d;
  if (z > 0) {
    Z += (o.chin ?? 0.012) * Math.exp(-((y + 0.82) ** 2) / 0.03 - x * x / 0.08);             // chin
    Z += (o.brow ?? 0.004) * Math.exp(-((y - 0.22) ** 2) / 0.012) * (1 - Math.exp(-x * x / 0.02) * 0.4); // brow ridge
    const s = o.sockets ?? 0; if (s) for (const ex of [-0.4, 0.4]) Z -= s * Math.exp(-((x - ex) ** 2) / 0.035 - ((y - 0.06) ** 2) / 0.02);
    Z += (o.cheek ?? 0) * Math.exp(-((Math.abs(x) - 0.5) ** 2) / 0.05 - ((y + 0.22) ** 2) / 0.05);
  }
  return [X, Y, Z];
}
// The depth of the sculpted face at (X, Y) in head units: features sit on the surface rather than float off it.
export function faceZ(o, X, Y) {
  let lo = 0, hi = 1;                       // find z on the unit sphere whose sculpted x,y match; bisection on z
  for (let k = 0; k < 22; k++) {
    const z = (lo + hi) / 2, yy = Y / o.h, r2 = 1 - z * z - yy * yy;
    if (r2 <= 0) { hi = z; continue; }
    const x = Math.sqrt(r2), q = sculpt(o, x, yy, z);
    if (q[0] > Math.abs(X)) lo = z; else hi = z;
  }
  const z = (lo + hi) / 2, yy = Y / o.h, x = Math.sqrt(Math.max(0, 1 - z * z - yy * yy));
  return sculpt(o, Math.sign(X || 1) * x, yy, z)[2];
}
// A sphere's seam and poles get split normals after computeVertexNormals; average them so shading and hulls stay closed.
function fixSeam(g, ws, hs) {
  const n = g.attributes.normal, a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let j = 0; j <= hs; j++) {
    const i0 = j * (ws + 1), i1 = i0 + ws; a.fromBufferAttribute(n, i0); b.fromBufferAttribute(n, i1); a.add(b).normalize();
    n.setXYZ(i0, a.x, a.y, a.z); n.setXYZ(i1, a.x, a.y, a.z);
  }
  for (let i = 0; i <= ws; i++) { n.setXYZ(i, 0, 1, 0); n.setXYZ(hs * (ws + 1) + i, 0, -1, 0); }
}
// Keep only the triangles of g whose three corners pass keep(x,y,z): hair caps and beards are cut from the head.
export function cut(g, keep) {
  const s = g.toNonIndexed(), p = s.attributes.position, nn = s.attributes.normal, P = [], Nn = [];
  for (let i = 0; i < p.count; i += 3) {
    let ok = true; for (let k = 0; k < 3; k++) if (!keep(p.getX(i + k), p.getY(i + k), p.getZ(i + k))) ok = false;
    if (ok) for (let k = 0; k < 3; k++) { P.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); Nn.push(nn.getX(i + k), nn.getY(i + k), nn.getZ(i + k)); }
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); return o;
}
// Push every vertex out along its normal: a shell that sits just proud of the surface it was cut from.
export function puff(g, d) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d); return g; }
/* A decal: a polygon given as triangles in (x, y), subdivided and laid on a surface z = f(x, y). Edges stay exactly
 * straight, which keeps lapels, ties and collars crisp at any zoom. */
export function decal(tris, f, lift = 0.002, n = 10) {
  const P = [], Nn = [];
  const put = (x, y) => { const z = f(x, y), e = 0.004, nx = -(f(x + e, y) - f(x - e, y)) / (2 * e), ny = -(f(x, y + e) - f(x, y - e)) / (2 * e), l = Math.hypot(nx, ny, 1); P.push(x, y, z + lift); Nn.push(nx / l, ny / l, 1 / l); };
  for (const [A, B, C] of tris) for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
    const pt = (a, b) => [A[0] + (B[0] - A[0]) * a / n + (C[0] - A[0]) * b / n, A[1] + (B[1] - A[1]) * a / n + (C[1] - A[1]) * b / n];
    const p0 = pt(i, j), p1 = pt(i + 1, j), p2 = pt(i, j + 1); put(...p0); put(...p1); put(...p2);
    if (j < n - i - 1) { const p3 = pt(i + 1, j + 1); put(...p1); put(...p3); put(...p2); }
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); return o;
}
export const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];

export function color(hex) { return new THREE.Color(hex); }
export function shade(hex, k) { const c = new THREE.Color(hex), h = {}; c.getHSL(h); c.setHSL(h.h, h.s, THREE.MathUtils.clamp(k < 0 ? h.l * (1 + k) : h.l + (1 - h.l) * k, 0, 1)); return '#' + c.getHexString(); }

// Merge geometries (already placed) into one, with a colour per source geometry baked into the vertices. Indices
// are kept, so shared vertices are shaded once: that matters a great deal in software WebGL.
export function merge(list) {
  let n = 0, ni = 0;
  for (const [g] of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), C = new Float32Array(n * 3), I = new Uint32Array(ni); let o = 0, oi = 0;
  for (const [s, c] of list) {
    const cnt = s.attributes.position.count;
    P.set(s.attributes.position.array.subarray(0, cnt * 3), o * 3); Nn.set(s.attributes.normal.array.subarray(0, cnt * 3), o * 3);
    const col = c instanceof THREE.Color ? c : new THREE.Color(c);
    for (let i = 0; i < cnt; i++) { C[(o + i) * 3] = col.r; C[(o + i) * 3 + 1] = col.g; C[(o + i) * 3 + 2] = col.b; }
    if (s.index) { const a = s.index.array; for (let i = 0; i < a.length; i++) I[oi + i] = a[i] + o; oi += a.length; } else { for (let i = 0; i < cnt; i++) I[oi + i] = o + i; oi += cnt; }
    o += cnt;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
}

/* The Kit: bodies call kit.add(joint, geometry, colour, options). build() then makes, per joint, one mesh per
 * material slot and one ink hull. options: slot (which material of the style), ink (false to leave out of the hull). */
export class Kit {
  constructor() { this.items = []; }
  add(joint, g, col, o = {}) { this.items.push({ joint, g, col, slot: o.slot || 'fill', ink: o.ink !== false }); return this; }
  build(joints, style) {
    const groups = new Map(), meshes = [];
    for (const it of this.items) {
      // Only the realistic style needs different materials for skin, cloth and hair; the others share one fill, except
      // hatch, which keeps skin and hair apart so that faces are not hatched (bulletins.b@, 21 Nov 2026).
      const keep = style.render === 'realistic' || ['glass', 'flat', 'noink'].includes(it.slot) || (style.render === 'hatch' && (it.slot === 'skin' || it.slot === 'hair'));
      const slot = keep ? it.slot : 'fill';
      const k = it.joint + '|' + slot; if (!groups.has(k)) groups.set(k, { joint: it.joint, slot, fill: [], ink: [] });
      const G = groups.get(k); G.fill.push([it.g, it.col]); if (it.ink) G.ink.push([it.g, '#000']);
    }
    for (const G of groups.values()) {
      const J = joints[G.joint]; if (!J) throw new Error('no joint ' + G.joint);
      const m = new THREE.Mesh(merge(G.fill), style.material(G.slot)); m.frustumCulled = false; m.userData.slot = G.slot; J.add(m); meshes.push(m);
      const om = style.outline && style.outline(G.slot);
      if (om && G.ink.length) { const ig = merge(G.ink); const h = new THREE.Mesh(ig, om); h.frustumCulled = false; J.add(h); meshes.push(h);
        if (style.outline2) { const h2 = new THREE.Mesh(ig, style.outline2()); h2.frustumCulled = false; J.add(h2); meshes.push(h2); } }
    }
    return meshes;
  }
}
export { THREE };
