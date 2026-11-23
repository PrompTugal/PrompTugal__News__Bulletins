/* bodies.js: the body plans. Version 1 had humanoid, boxbot, owl, mosaic and cube3d as functions returning
 * { parts, rig }. They are the same five here, but each returns a 3D puppet on the shared skeleton:
 *   { J (joints), d (dimensions), kit (the parts), face { update(p) }, rest (relaxed arm pose), extra(p, t) }.
 * Everything is in metres; a human figure is about 1.8 tall. Bodies read spec.looks only: no body knows a
 * character by name, so a new character is a new entry in characters.json. */
import { THREE, Kit, at, ball, cyl, torus, lathe, limb, rbox, head as headGeo, sculpt, faceZ, decal, quad, shade, merge } from './geometry.js';
import { ballEyes, flatEyes, brows, Mouth } from './face.js';
import { rng, TAU, lerp, clamp, smooth, deg } from './math.js';

const PI = Math.PI;
const BASIC = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

export function skeleton(d) {
  const J = {};
  const j = (name, parent, x, y, z, order = 'XYZ') => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); o.rotation.order = order; if (parent) J[parent].add(o); J[name] = o; o.userData.rest = o.position.clone(); return o; };
  j('root', null, 0, 0, 0, 'YXZ'); j('body', 'root', 0, 0, 0, 'YXZ');
  j('hips', 'body', 0, d.hip, 0, 'YXZ'); j('spine', 'hips', 0, d.spine, 0, 'YXZ'); j('chest', 'spine', 0, d.chest, 0, 'YXZ');
  j('neck', 'chest', 0, d.neck, 0, 'YXZ'); j('head', 'neck', 0, d.head, 0, 'YXZ');
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    j('arm' + s, 'chest', sx * d.shX, d.shY, 0, 'XZY'); j('el' + s, 'arm' + s, 0, -d.upper, 0); j('wr' + s, 'el' + s, 0, -d.fore, 0, 'XZY');
    j('leg' + s, 'hips', sx * d.legX, 0, 0, 'XZY'); j('kn' + s, 'leg' + s, 0, -d.thigh, 0); j('an' + s, 'kn' + s, 0, -d.shin, 0);
  }
  J._j = j; return J;
}
// A patch of the sculpted head between two latitude curves: hair caps and beards follow the skull exactly and
// have a smooth edge. phi is the angle round the head (0 = front); top and bot give y (in -1..1) for each phi.
function skullPatch(ho, phi0, phi1, nphi, top, bot, nlat, scale) {
  const P = [], idx = [], row = nlat + 1;
  for (let i = 0; i <= nphi; i++) {
    const phi = lerp(phi0, phi1, i / nphi), yt = top(phi), yb = bot(phi);
    for (let k = 0; k <= nlat; k++) {
      const y = clamp(lerp(yt, yb, k / nlat), -0.999, 0.999), r = Math.sqrt(1 - y * y), q = sculpt(ho, r * Math.sin(phi), y, r * Math.cos(phi));
      const edge = Math.sin((k / nlat) * PI), sc = 1 + (scale - 1) * (0.45 + 0.55 * Math.sqrt(edge));
      P.push(q[0] * sc, q[1] * sc, q[2] * sc);
    }
  }
  for (let i = 0; i < nphi; i++) for (let k = 0; k < nlat; k++) { const a = i * row + k, b = a + row; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// A barrel: a lathe with an oval section, from a smooth profile of [y, radius] pairs. Returns the geometry and
// z(x, y), the depth of its front surface, so decals (lapels, plackets) can be laid exactly on it.
function barrel(pts, zs) {
  const tab = [], n = 18, y0 = pts[0][0], y1 = pts[pts.length - 1][0];
  for (let i = 0; i <= n; i++) { const y = lerp(y0, y1, i / n); let k = 0; while (k < pts.length - 2 && y > pts[k + 1][0]) k++; tab.push([y, lerp(pts[k][1], pts[k + 1][1], smooth((y - pts[k][0]) / (pts[k + 1][0] - pts[k][0])))]); }
  const R = (y) => { const u = clamp((y - y0) / (y1 - y0), 0, 1) * n, i = Math.min(n - 1, Math.floor(u)); return lerp(tab[i][1], tab[i + 1][1], u - i); };
  const prof = [[0.0005, y0 - 0.02], ...tab.map(([y, r]) => [r, y]), [0.0005, y1 + 0.012]];
  return { g: at(lathe(prof, 40), [0, 0, 0], [0, 0, 0], [1, 1, zs]), z: (x, y) => zs * Math.sqrt(Math.max(0.0004, R(y) ** 2 - x * x)) };
}
const curve = (pts) => (phi) => { // smooth interpolation of [angle in degrees, value] pairs over |phi|
  const a = Math.abs(phi) * 180 / PI; for (let i = 0; i < pts.length - 1; i++) if (a <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], smooth((a - pts[i][0]) / (pts[i + 1][0] - pts[i][0])));
  return pts[pts.length - 1][1];
};
const HAIRLINE = { short: [[0, 0.56], [55, 0.44], [95, 0.14], [180, -0.42]], side: [[0, 0.52], [55, 0.40], [95, 0.08], [180, -0.48]], quiff: [[0, 0.54], [55, 0.42], [95, 0.10], [180, -0.45]],
  curly: [[0, 0.62], [40, 0.52], [70, 0.30], [95, 0.04], [180, -0.50]], grey: [[0, 0.80], [50, 0.56], [95, 0.14], [180, -0.40]] };

/* ---------- The human figure: Tejo, Duarte, Rui, The Guide, Rowan. ---------- */
export function humanoid(spec, style) {
  const L = spec.looks, o = L.outfit || {}, skin = L.skin, ink = L.ink || '#1b1b1f', hair = L.hair || { style: 'short', color: '#222' };
  const toon = L.toon ?? (spec.render === 'realistic' ? 0 : spec.render === 'hologram' ? 0.3 : 0.55), real = spec.render === 'realistic';
  const d = { hip: 0.94, spine: 0.10, chest: 0.17, neck: 0.27, head: 0.075, shX: 0.185, shY: 0.215, upper: 0.28, fore: 0.25, legX: 0.092, thigh: 0.44, shin: 0.42, ankle: 0.08, height: 1.82 };
  const J = skeleton(d), kit = new Kit(), trousers = L.trousers || shade(o.color, -0.3), rnd = rng(spec.id);
  const cloth = { slot: 'cloth' }, sk = { slot: 'skin' }, hr = { slot: 'hair' };
  // Trunk: three overlapping ellipsoids, one per joint, so a bend in the spine never opens a gap.
  kit.add('hips', ball(1, [0, -0.012, 0], [0.166, 0.12, 0.11], 28), trousers, cloth);
  const AB = barrel([[-0.10, 0.150], [-0.02, 0.159], [0.06, 0.157], [0.15, 0.150]], 0.67), CB = barrel([[-0.075, 0.150], [0.0, 0.160], [0.10, 0.177], [0.19, 0.186], [0.243, 0.172], [0.276, 0.128], [0.297, 0.062]], 0.62);
  kit.add('spine', AB.g, o.color, cloth); kit.add('chest', CB.g, o.color, cloth);
  const cz = CB.z;
  for (const sx of [-1, 1]) kit.add('chest', ball(0.06, [sx * d.shX * 0.96, d.shY - 0.004, 0]), o.color, cloth);
  kit.add('neck', at(cyl(0.044, 0.052, 0.13, 20), [0, 0.03, 0]), skin, sk);
  const lap = o.lapel || shade(o.color, -0.22);
  if (o.style === 'suit') {
    kit.add('chest', decal([[[-0.054, 0.264], [0.054, 0.264], [0, 0.03]]], cz, 0.002, 12), o.shirt || '#f4f4f2', { ink: false });
    for (const sx of [-1, 1]) {
      kit.add('chest', decal(quad([sx * 0.054, 0.264], [sx * 0.118, 0.212], [sx * 0.024, 0.0], [0, 0.03]), cz, 0.0045, 10), lap, { ink: false });
      kit.add('chest', decal(quad([sx * 0.016, 0.275], [sx * 0.066, 0.270], [sx * 0.048, 0.232], [sx * 0.012, 0.240]), cz, 0.006, 5), o.shirt || '#f4f4f2', { ink: false });
    }
    kit.add('chest', ball(0.008, [0, 0.0, cz(0, 0.0) + 0.004]), shade(o.color, -0.5), { ink: false });
    kit.add('hips', barrel([[-0.10, 0.172], [0.0, 0.168], [0.08, 0.160]], 0.68).g, o.color, cloth);   // the jacket's skirt
    if (o.tie) { // the tie hangs from its knot on its own joint, so a spring can swing it
      const t = J._j('tie', 'chest', 0, 0.243, cz(0, 0.243) + 0.007); t.userData.restRot = [-0.23, 0, 0];
      kit.add('tie', at(rbox(0.032, 0.028, 0.014, 0.006), [0, -0.004, 0]), shade(o.tie, -0.12));
      kit.add('tie', at(rbox(0.05, 0.17, 0.006, 0.0028), [0, -0.1, 0]), o.tie);
      kit.add('tie', at(rbox(0.036, 0.036, 0.006, 0.0028), [0, -0.185, 0], [0, 0, PI / 4]), o.tie);
    }
  } else if (o.style === 'jumper') {
    kit.add('chest', at(torus(0.058, 0.019, 28, 10), [0, 0.272, -0.002], [PI / 2, 0, 0]), shade(o.color, -0.14), cloth);
    kit.add('chest', at(torus(0.048, 0.011, 28, 8), [0, 0.288, -0.002], [PI / 2, 0, 0]), o.shirt || '#f4f4f2', cloth);
    kit.add('hips', at(torus(0.156, 0.02, 32, 8), [0, 0.04, 0], [PI / 2, 0, 0], [1, 0.69, 1]), shade(o.color, -0.14), cloth);
  } else if (o.style === 'shirt') {
    for (const sx of [-1, 1]) kit.add('chest', decal(quad([sx * 0.01, 0.276], [sx * 0.074, 0.266], [sx * 0.064, 0.218], [sx * 0.01, 0.236]), cz, 0.006, 6), shade(o.color, 0.14), { ink: false });
    kit.add('chest', decal(quad([-0.012, 0.24], [0.012, 0.24], [0.012, -0.03], [-0.012, -0.03]), cz, 0.003, 8), shade(o.color, -0.2), { ink: false });
    for (const y of [0.19, 0.11, 0.03]) kit.add('chest', ball(0.0065, [0, y, cz(0, y) + 0.005]), '#f4efe2', { ink: false });
    kit.add('chest', decal([[[-0.03, 0.266], [0.03, 0.266], [0, 0.222]]], cz, 0.002, 6), skin, { ink: false });
  }
  const rolled = o.style === 'shirt';
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    kit.add('arm' + s, limb(0.055, 0.047, d.upper), o.color, cloth);
    kit.add('el' + s, limb(0.045, 0.036, d.fore), rolled ? skin : o.color, rolled ? sk : cloth);
    if (rolled) kit.add('el' + s, at(torus(0.047, 0.012, 18, 8), [0, -0.01, 0], [PI / 2, 0, 0]), shade(o.color, 0.14), cloth);
    if (o.style === 'suit') kit.add('el' + s, at(cyl(0.039, 0.039, 0.028, 18), [0, -d.fore + 0.018, 0]), o.shirt || '#f4f4f2', cloth);
    if (o.style === 'jumper') kit.add('el' + s, at(torus(0.036, 0.011, 18, 8), [0, -d.fore + 0.02, 0], [PI / 2, 0, 0]), shade(o.color, -0.14), cloth);
    // Hand: the palm is thin from side to side, so a hanging hand faces the thigh and a raised forearm shows the thumb on top.
    kit.add('wr' + s, ball(1, [0, -0.046, 0], [0.021, 0.05, 0.04], 16), skin, sk);
    const fz = [0.028, 0.0095, -0.009, -0.027], fl = [0.064, 0.07, 0.064, 0.052];
    const th = J._j('f' + s + '0', 'wr' + s, -sx * 0.006, -0.03, 0.036); th.userData.restRot = [-0.75, 0, 0]; th.userData.sx = sx; th.userData.thumb = true;
    kit.add('f' + s + '0', limb(0.0125, 0.0105, 0.05, 10), skin, sk);
    for (let i = 0; i < 4; i++) { const f = J._j('f' + s + (i + 1), 'wr' + s, 0, -0.086, fz[i]); f.userData.sx = sx; kit.add('f' + s + (i + 1), limb(0.0108, 0.009, fl[i], 10), skin, sk); }
    kit.add('leg' + s, limb(0.08, 0.06, d.thigh), trousers, cloth);
    kit.add('kn' + s, limb(0.058, 0.045, d.shin), trousers, cloth);
    kit.add('an' + s, at(rbox(0.094, 0.078, 0.255, 0.032), [0, -0.041, 0.056]), L.shoes || '#1a1a1a', cloth);
  }
  if (L.prop === 'tablet') { // held against the left forearm, screen out
    kit.add('wrL', at(rbox(0.013, 0.2, 0.27, 0.012), [-0.03, -0.03, 0.045]), '#20242c');
    kit.add('wrL', at(rbox(0.004, 0.175, 0.245, 0.004), [-0.038, -0.03, 0.045]), '#8fd0ff', { ink: false });
  }
  if (L.prop === 'pencil') { kit.add('wrL', at(cyl(0.006, 0.006, 0.15, 8), [0, -0.06, 0.03], [1.0, 0, 0]), '#e8b23a'); kit.add('wrL', at(cyl(0.0005, 0.006, 0.02, 8), [0, -0.107, 0.103], [1.0, 0, 0]), '#3a2a1a'); }

  // Head. Cartoon figures get a bigger, rounder head and bigger eyes; the realistic one gets sockets and a jaw.
  const ho = { w: lerp(0.097, 0.114, toon), h: lerp(0.128, 0.142, toon), d: lerp(0.112, 0.124, toon), jaw: lerp(0.36, 0.22, toon), sockets: real ? 0.011 : 0.004 * (1 - toon), chin: lerp(0.012, 0.004, toon), brow: real ? 0.006 : 0.002, cheek: real ? 0.004 : 0 };
  const hc = [0, ho.h * 0.99, 0.012];
  const SK = J._j('skull', 'head', 0, -0.012, 0); SK.scale.setScalar(L.headScale || lerp(1.13, 1.3, toon));   // stylised heads are bigger than life
  kit.add('skull', at(headGeo(ho), hc), skin, sk);
  const fz = (x, y) => faceZ(ho, x, y - hc[1]) + hc[2];
  for (const sx of [-1, 1]) kit.add('skull', ball(1, [sx * ho.w * 0.985, hc[1] - 0.004, -0.004], [0.012, 0.031, 0.021], 14), skin, sk);
  const ny = hc[1] - ho.h * 0.20, nr = L.noseR ?? lerp(0.0165, 0.0195, toon);
  kit.add('skull', ball(1, [0, ny, fz(0, ny) + nr * 0.25], [nr, nr * 0.92, nr * 1.15], 16), real ? skin : shade(skin, -0.04), sk);
  if (toon < 0.5) kit.add('skull', ball(1, [0, ny + 0.026, fz(0, ny + 0.026) - 0.004], [0.0095, 0.03, 0.013], 12), skin, { slot: 'skin', ink: false });
  // Hair: a cap cut from the skull along a hairline, then lumps by style.
  const hl = curve(HAIRLINE[hair.style] || HAIRLINE.short), hk = { short: 1.05, side: 1.075, quiff: 1.07, curly: 1.09, grey: 1.045 }[hair.style] || 1.05;
  const hcol = hair.color, hdark = shade(hcol, -0.25);
  kit.add('skull', at(skullPatch(ho, -PI, PI, 72, () => 0.999, hl, 14, hk), hc), hcol, hr);
  const hf = J._j('hairF', 'skull', 0, hc[1] + ho.h * 0.62, hc[2] + ho.d * 0.55);
  const hfp = (x, y, z) => [x, y - ho.h * 0.62 + hc[1] - hc[1], z - ho.d * 0.55];   // head-centre coords to the fringe joint's
  if (hair.style === 'side') {
    kit.add('hairF', at(ball(1, [0, 0, 0], [ho.w * 0.86, ho.h * 0.22, ho.d * 0.48], 20), hfp(0.014, ho.h * 0.80, ho.d * 0.50), [0.25, 0, -0.16]), hcol, hr);
    kit.add('skull', at(ball(1, [0, 0, 0], [ho.w * 0.5, ho.h * 0.2, ho.d * 0.8], 18), [hc[0] + ho.w * 0.5, hc[1] + ho.h * 0.82, hc[2] - 0.01], [0, 0, -0.35]), hcol, hr);
    kit.add('skull', at(ball(1, [0, 0, 0], [ho.w * 0.4, ho.h * 0.18, ho.d * 0.75], 18), [hc[0] - ho.w * 0.56, hc[1] + ho.h * 0.74, hc[2] - 0.01], [0, 0, 0.5]), hdark, hr);
  } else if (hair.style === 'quiff' && real) {
    // The realistic head has no lumps: the cap and the combed strands are the hair. The fringe joint keeps one hidden bead inside the skull, so the joint still has a mesh.
    kit.add('hairF', ball(0.01, hfp(0, ho.h * 0.55, ho.d * 0.2), 1, 8), hdark, hr);
  } else if (hair.style === 'quiff') {
    kit.add('hairF', at(ball(1, [0, 0, 0], [ho.w * 0.80, ho.h * 0.20, ho.d * 0.46], 20), hfp(0, ho.h * 0.90, ho.d * 0.42), [-0.3, 0, 0]), real ? hdark : hcol, hr);
    kit.add('skull', ball(1, [hc[0], hc[1] + ho.h * 0.84, hc[2] - ho.d * 0.15], [ho.w * 0.84, ho.h * 0.24, ho.d * 0.84], 20), real ? hdark : hcol, hr);
  } else if (hair.style === 'curly') {
    for (let i = 0; i < 150; i++) { // curls: many small balls scattered over the cap from a seeded generator
      const phi = (rnd() * 2 - 1) * PI, top = 0.98, bot = hl(phi) + 0.10, y = lerp(bot, top, Math.pow(rnd(), 0.75)), r = Math.sqrt(1 - y * y), q = sculpt(ho, r * Math.sin(phi), y, r * Math.cos(phi)), rr = 0.017 + rnd() * 0.011;
      const front = q[2] > ho.d * 0.35 && q[1] > ho.h * 0.4, p = [q[0] * 1.05, q[1] * 1.05, q[2] * 1.05];
      if (front) kit.add('hairF', ball(rr, hfp(p[0], p[1], p[2]), 1, 12), i % 3 ? hcol : shade(hcol, 0.12), hr); else kit.add('skull', ball(rr, [p[0] + hc[0], p[1] + hc[1], p[2] + hc[2]], 1, 12), i % 3 ? hcol : shade(hcol, -0.1), hr);
    }
  } else if (hair.style === 'grey') {
    for (const sx of [-1, 1]) kit.add('skull', ball(1, [sx * ho.w * 0.93, hc[1] + ho.h * 0.3, hc[2] - ho.d * 0.12], [0.028, 0.05, 0.062], 14), hcol, hr);
  } else kit.add('skull', ball(1, [hc[0], hc[1] + ho.h * 0.82, hc[2] - ho.d * 0.05], [ho.w * 0.82, ho.h * 0.24, ho.d * 0.85], 20), hcol, hr);
  const my = hc[1] - ho.h * 0.50;
  /* Facial hair, all from looks: beardStyle (full, moustache, none), beardLine (the top edge as [angle, height] pairs),
   * beardWidth (degrees each side of the chin), beardPuff, beardBalls and beardBallR (cartoon curls), moustache. */
  const BLINE = L.beardLine || (toon > 0.8 ? [[0, -0.70], [20, -0.62], [42, -0.40], [70, -0.16], [100, 0.02]] : [[0, -0.60], [22, -0.50], [40, -0.22], [70, -0.05], [100, 0.06]]);
  const bt = curve(BLINE), bw = deg(L.beardWidth ?? 100), bstyle = L.beard ? (L.beardStyle || 'full') : 'none';
  if (bstyle === 'full') {
    const bk = L.beardPuff ?? (toon > 0.8 ? 1.045 : 1.03), nb = L.beardBalls ?? (toon > 0.8 ? 60 : 0), br0 = L.beardBallR ?? 0.011;
    kit.add('skull', at(skullPatch(ho, -bw, bw, 44, bt, () => -0.999, 10, bk), hc), L.beard, hr);
    for (let i = 0; i < nb; i++) { const phi = (rnd() * 2 - 1) * bw * 0.95, y = lerp(-0.97, bt(phi) - 0.10, rnd()), r = Math.sqrt(1 - y * y), q = sculpt(ho, r * Math.sin(phi), y, r * Math.cos(phi)); kit.add('skull', ball(br0 + rnd() * br0 * 0.65, [q[0] * bk + hc[0], q[1] * bk + hc[1], q[2] * bk + hc[2]], 1, 10), i % 3 ? L.beard : shade(L.beard, -0.1), hr); }
  }
  if (bstyle !== 'none' && L.moustache !== false) for (const sx of [-1, 1]) kit.add('skull', at(ball(1, [0, 0, 0], [0.021, 0.0085 + 0.004 * toon, 0.01], 12), [sx * 0.017, my + 0.019, fz(sx * 0.017, my + 0.019) + 0.004], [0, sx * 0.3, sx * -0.22]), L.moustacheColor || L.beard, hr);
  // Eyes, brows, mouth.
  const ex = lerp(0.036, 0.044, toon), ey = hc[1] + ho.h * 0.10, er = L.eyeR ?? (real ? 0.0178 : lerp(0.0158, 0.0245, toon)), ez = fz(ex, ey) - er * (real ? 0.74 : lerp(0.60, 0.42, toon));
  const eyes = ballEyes(J.skull, style, { x: ex, y: ey, z: ez, r: er, iris: L.iris || '#3b2a1c', skin: real ? shade(skin, -0.06) : skin, ink: real ? '#2a1a12' : ink, slot: 'skin', lash: real ? 0.05 : 0.09, open: lerp(0.52, 0.66, toon) });
  const by = ey + er * lerp(1.75, 1.6, toon);
  const br = brows(J.skull, style.material(real ? 'hair' : 'fill'), { x: ex * 1.02, y: by, z: fz(ex, by) + 0.003, w: er * 1.5, t: lerp(0.0042, 0.0075, toon), color: hair.style === 'grey' ? shade(hcol, -0.25) : shade(hcol, -0.3), tilt: 0.1, yaw: 0.3, travel: lerp(0.011, 0.018, toon) });
  if (L.glasses) {
    const gz = ez + er * 0.95 + 0.006, gr = er * 1.62;
    for (const sx of [-1, 1]) { kit.add('skull', at(torus(gr, 0.0036, 32, 8), [sx * ex, ey, gz]), L.glasses, { slot: 'noink' }); kit.add('skull', at(new THREE.CircleGeometry(gr, 28), [sx * ex, ey, gz]), '#ffffff', { slot: 'glass' });
      kit.add('skull', at(cyl(0.003, 0.003, 0.11, 6), [sx * (ex + gr + 0.012), ey + 0.002, gz - 0.056], [PI / 2, 0, sx * 0.16]), L.glasses, { slot: 'noink' }); }
    kit.add('skull', at(cyl(0.003, 0.003, ex * 2 - gr * 2 + 0.004, 6), [0, ey + 0.004, gz], [0, 0, PI / 2]), L.glasses, { slot: 'noink' });
  }
  const lipC = L.lip || (toon > 0.4 ? shade(skin, -0.5) : shade(skin, -0.32));
  const mouth = new Mouth(J.skull, style.render === 'hologram' ? style.material('fill') : BASIC, { y: my, w: lerp(0.024, 0.031, toon), h: lerp(0.034, 0.05, toon), z: (x, y) => fz(x, y) + (L.beard ? (toon > 0.8 ? 0.008 : 0.006) : 0.0025), lipColor: L.beard && !real ? shade(L.beard, -0.45) : lipC, lip: real ? 0.0048 : lerp(0.003, 0.0042, toon), lowerLip: real ? 1.7 : 1 });
  if (real && L.strands) strands(J.skull, style, ho, hc, hl, L, rnd, bstyle === 'full' ? bt : null, bw);
  const face = { update(p) { eyes.update(p); br.update(p); mouth.update(p); } };
  const features = [...eyes.eyes.map((e) => e.g), ...br.groups, mouth.mesh];
  let extra = null;
  if (L.base === 'projector') extra = projector(J, style);
  return { J, d, kit, face, extra, features, rest: { L: L.prop === 'tablet' ? { sw: 0.12, out: 0.06, el: 1.5, tw: 1.0 } : { sw: 0.02, out: 0.09, el: 0.16, tw: 0 }, R: { sw: 0.02, out: 0.09, el: 0.16, tw: 0 } }, curl: 0.3 };
}
/* Rui's hair and stubble: a few thousand thin cones, each placed and combed by rule from a seeded generator. They
 * are one instanced mesh, so they cost one draw call. */
function strands(headJ, style, ho, hc, hl, L, rnd, bt, bw) {
  const n = L.strands, nb = bt ? Math.round(n * (L.beardDensity ?? 0.55)) : 0, hLen = L.hairLen ?? 1, bLen = L.beardLen ?? 1, sideComb = L.comb === 'side' ? 1 : 0, g = at(new THREE.CylinderGeometry(0.0002, 0.0011, 1, 4, 1), [0, 0.5, 0]);
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  const mesh = new THREE.InstancedMesh(g, style.material('hair'), n + nb), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), nrm = new THREE.Vector3(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  const base = new THREE.Color(L.hair.color), bb = new THREE.Color(L.beard || L.hair.color);
  for (let i = 0; i < n + nb; i++) {
    const beard = i >= n, phi = beard ? (rnd() * 2 - 1) * bw * 0.98 : (rnd() * 2 - 1) * PI;
    const y = beard ? lerp(-0.97, bt(phi), rnd()) : lerp(hl(phi) + 0.02, 0.995, Math.sqrt(rnd())), r = Math.sqrt(1 - y * y), s = sculpt(ho, r * Math.sin(phi), y, r * Math.cos(phi));
    nrm.set(s[0] / (ho.w * ho.w), s[1] / (ho.h * ho.h), s[2] / (ho.d * ho.d)).normalize();
    const k = beard ? 1.028 : 1.045; pos.set(s[0] * k + hc[0], s[1] * k + hc[1], s[2] * k + hc[2]);
    if (beard) dir.copy(nrm).multiplyScalar(0.5).add(new THREE.Vector3((rnd() - 0.5) * 0.4, -0.9, 0.25)).normalize();
    else { // combed from the forehead over the crown and down the back: the comb direction is the normal crossed with the head's right
      const front = Math.max(0, s[2] / ho.d) * Math.max(0, y), side = Math.abs(nrm.x);
      dir.set((rnd() - 0.5) * 0.3 + 0.1 - sideComb * 0.9 * Math.max(0, nrm.y), nrm.z - 0.3 * side, (-nrm.y - 0.55 * side) * (1 - 0.5 * sideComb)).addScaledVector(nrm, 0.10 + front * 0.55).normalize(); }
    q.setFromUnitVectors(up, dir); const len = beard ? (0.007 + rnd() * 0.006) * bLen : hLen * (0.022 + rnd() * 0.022) * (1 + 0.9 * Math.max(0, s[2] / ho.d) * Math.max(0, y)); sc.set(1.5, len, 1.5);
    M.compose(pos, q, sc); mesh.setMatrixAt(i, M);
    c.copy(beard ? bb : base).multiplyScalar(0.65 + rnd() * 0.75); mesh.setColorAt(i, c);
  }
  mesh.frustumCulled = false; headJ.add(mesh);
}
// Tejo's projector: a base on the floor, a cone of light, and motes that rise through it. The motes' positions are
// computed in the shader from a seed and uTime, so they too are a function of t.
function projector(J, style) {
  const g = new THREE.Group(); J.root.add(g);
  const baseM = new THREE.MeshStandardMaterial({ color: '#10182c', roughness: 0.4, metalness: 0.6, emissive: '#0a2a66', emissiveIntensity: 0.6 });
  g.add(new THREE.Mesh(at(cyl(0.42, 0.50, 0.07, 48), [0, 0.035, 0]), baseM));
  const ring = new THREE.Mesh(at(torus(0.40, 0.012, 64, 8), [0, 0.075, 0], [PI / 2, 0, 0]), new THREE.MeshBasicMaterial({ color: '#7fe9ff' })); g.add(ring);
  const U = { uTime: style.shared.uTime, uOn: { value: 1 } };
  const cone = new THREE.Mesh(at(new THREE.CylinderGeometry(0.62, 0.38, 2.0, 48, 1, true), [0, 1.07, 0]), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uOn; varying float vY; void main(){ float a = (1.0 - smoothstep(0.1, 2.0, vY)) * 0.11 * uOn; gl_FragColor = vec4(0.25, 0.75, 1.0, a); }' })); g.add(cone);
  const N = 140, seed = new Float32Array(N * 3), r = rng('motes'); for (let i = 0; i < N * 3; i++) seed[i] = r();
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3)); pg.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const motes = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, uSize: { value: 5 } },
    vertexShader: 'attribute vec3 seed; uniform float uTime, uSize; varying float vA; void main(){ float h = fract(seed.y + uTime * (0.08 + seed.z * 0.14)); float a = seed.x * 6.2832 + uTime * (seed.z - 0.5) * 0.8; float rr = 0.25 + seed.z * 0.3 + 0.08 * sin(uTime * 1.3 + seed.x * 20.0); vec3 p = vec3(cos(a) * rr, 0.08 + h * 2.0, sin(a) * rr); vA = sin(h * 3.1416); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = uSize * (0.5 + seed.z) * 12.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uOn; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.6, 0.95, 1.0, vA * (1.0 - d * 2.0) * 0.9 * uOn); }' })); motes.frustumCulled = false; g.add(motes);
  return (p, t, env) => { motes.material.uniforms.uSize.value = 5 * (env.height || 1080) / 1080; U.uOn.value = 1; };
}

/* ---------- The box robot: The Agent, Conductor, Researcher, The Caretaker. ---------- */
export function boxbot(spec, style) {
  const L = spec.looks, h = L.head || {}, b = L.body || {}, ink = L.ink || '#23262b', limbC = spec.render === 'hatch' ? '#5a646c' : shade(ink, 0.12);
  const d = { hip: 0.50, spine: 0.02, chest: 0.06, neck: 0.41, head: 0.06, shX: 0.215, shY: 0.31, upper: 0.21, fore: 0.20, legX: 0.085, thigh: 0.22, shin: 0.22, ankle: 0.06, height: 1.5 };
  const J = skeleton(d), kit = new Kit(), bw = 0.37, bh = 0.46, bd = 0.25, bc = b.color || '#c0462a';
  const body = rbox(bw, bh, bd, 0.045, 5);
  if (b.shape === 'tunic') { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const k = lerp(1.22, 0.82, (p.getY(i) + bh / 2) / bh); p.setXYZ(i, p.getX(i) * k, p.getY(i) * 1.12 - 0.03, p.getZ(i) * k); } body.computeVertexNormals(); }
  kit.add('chest', at(body, [0, 0.16, 0]), bc);
  const fzb = () => bd / 2;
  if (b.stripes) b.stripes.forEach((c, i) => { const x0 = 0.02 + i * 0.032; kit.add('chest', decal(quad([x0, -0.065], [x0 + 0.026, -0.065], [x0 + 0.086, 0.0], [x0 + 0.06, 0.0]).map((t) => t.map(([x, y]) => [Math.min(x, bw / 2 - 0.012), y])), fzb, 0.002, 2), c, { ink: false }); });
  if (b.trim) { kit.add('chest', at(rbox(bw + 0.012, 0.05, bd + 0.012, 0.02), [0, 0.345, 0]), b.trim); kit.add('chest', at(rbox(bw + 0.012, 0.035, bd + 0.012, 0.016), [0, -0.045, 0]), b.trim); kit.add('chest', ball(0.022, [-0.11, 0.26, bd / 2]), '#7fe0a8'); }
  if (L.badge) { kit.add('chest', at(rbox(0.19, 0.075, 0.012, 0.01), [0.03, 0.2, bd / 2 + 0.004]), '#ffffff'); J.chest.add(textPlate(L.badge, 0.17, 0.06, ink, [0.03, 0.2, bd / 2 + 0.0115])); }
  kit.add('neck', at(cyl(0.045, 0.05, 0.1, 18), [0, 0.01, 0]), shade(h.color || '#e9eef2', -0.25));
  const hw = h.w || 0.42, hh = h.h || 0.34, hd = 0.30, fzz = hd / 2 + (h.screen ? 0.012 : 0.001);
  kit.add('head', at(rbox(hw, hh, hd, 0.055, 5), [0, hh / 2, 0]), h.color || '#e9eef2');
  if (h.screen) kit.add('head', at(rbox(hw - 0.075, hh - 0.075, 0.03, 0.03, 4), [0, hh / 2, hd / 2 - 0.004]), h.screen);
  for (const sx of [-1, 1]) kit.add('head', at(cyl(0.038, 0.038, 0.03, 18), [sx * (hw / 2 + 0.008), hh / 2, 0], [0, 0, PI / 2]), shade(h.color || '#e9eef2', -0.2));
  if (L.antenna !== false) { J._j('ant', 'head', 0, hh, 0); kit.add('ant', at(cyl(0.007, 0.009, 0.11, 8), [0, 0.055, 0]), limbC); kit.add('ant', ball(0.03, [0, 0.125, 0], 1, 16), L.antennaColor || '#e0a040'); }
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    kit.add('chest', ball(0.04, [sx * d.shX * 0.94, d.shY, 0]), shade(bc, -0.15));
    kit.add('arm' + s, limb(0.023, 0.021, d.upper, 10), limbC); kit.add('el' + s, limb(0.021, 0.02, d.fore, 10), limbC); kit.add('el' + s, ball(0.027, [0, 0, 0], 1, 10), limbC);
    kit.add('wr' + s, ball(0.047, [0, -0.03, 0], 1, 16), L.handColor || '#2a8f8a');
    const fp = [[0, -0.05, 0.036, -0.6], [0, -0.07, 0.012, 0], [0, -0.07, -0.016, 0]];
    fp.forEach((q, i) => { const f = J._j('f' + s + i, 'wr' + s, q[0], q[1], q[2]); f.userData.sx = sx; f.userData.restRot = [q[3], 0, 0]; kit.add('f' + s + i, limb(0.014, 0.012, 0.042, 8), L.handColor || '#2a8f8a'); });
    kit.add('leg' + s, limb(0.026, 0.024, d.thigh, 10), limbC); kit.add('kn' + s, limb(0.024, 0.022, d.shin, 10), limbC); kit.add('kn' + s, ball(0.03, [0, 0, 0], 1, 10), limbC);
    kit.add('an' + s, at(rbox(0.115, 0.062, 0.19, 0.026), [0, -0.029, 0.035]), shade(bc, bc === '#ffffff' || bc === '#f4f4f2' ? -0.3 : -0.25));
  }
  // Props live in the right hand; the left is the free one for gestures.
  let keys = null, lens = null;
  if (L.prop === 'magnifier') { kit.add('wrR', at(torus(0.07, 0.01, 32, 8), [0, -0.175, 0]), ink); kit.add('wrR', at(cyl(0.011, 0.011, 0.075, 8), [0, -0.068, 0]), '#8a5a2b'); kit.add('wrR', at(new THREE.CircleGeometry(0.068, 28), [0, -0.175, 0]), '#ffffff', { slot: 'glass' }); lens = true; }
  if (L.prop === 'card') { kit.add('wrR', at(rbox(0.012, 0.115, 0.16, 0.005), [0, -0.105, 0.02]), '#ffffff'); for (let i = 0; i < 3; i++) kit.add('wrR', at(rbox(0.004, 0.008, 0.1 - i * 0.02, 0.001), [-0.008, -0.075 - i * 0.026, 0.02 - i * 0.01]), i ? '#9aa4b0' : '#d8281c', { ink: false }); }
  if (L.prop === 'keys') {
    kit.add('wrR', at(torus(0.05, 0.006, 28, 8), [0, -0.105, 0], [0, PI / 2, 0]), '#8a9098');
    ['#d8b030', '#1a7f5a', '#b8c0c8'].forEach((c, i) => { const k = J._j('key' + i, 'wrR', 0, -0.155, (i - 1) * 0.022); k.userData.restRot = [0, (i - 1) * 0.5, (i - 1) * 0.18];
      kit.add('key' + i, at(torus(0.017, 0.005, 14, 6), [0, -0.02, 0], [0, PI / 2, 0]), c); kit.add('key' + i, at(rbox(0.006, 0.07, 0.011, 0.002), [0, -0.07, 0]), c); kit.add('key' + i, at(rbox(0.006, 0.012, 0.02, 0.002), [0, -0.094, 0.01]), c); kit.add('key' + i, at(rbox(0.006, 0.01, 0.014, 0.002), [0, -0.076, 0.009]), c); });
    keys = true;
  }
  // The face is drawn on the front of the head.
  const fm = BASIC, ec = L.eyeColor || ink;
  let face, clock = null;
  const mouth = new Mouth(J.head, fm, { y: L.face === 'clock' ? hh * 0.14 : hh * 0.27, w: L.face === 'clock' ? 0.04 : 0.052, h: L.face === 'clock' ? 0.03 : 0.058, z: () => fzz + 0.002, lipColor: ink, lip: 0.0052, inside: '#3a1010' });
  if (L.face === 'clock') { // the Conductor: the hands are its eyes, so they carry look, blink and mood
    const cy = hh * 0.58, cr = Math.min(hw, hh) * 0.31;
    kit.add('head', at(cyl(cr, cr, 0.012, 48), [0, cy, hd / 2], [PI / 2, 0, 0]), '#ffffff'); kit.add('head', at(torus(cr, 0.008, 48, 8), [0, cy, hd / 2 + 0.006]), ink, { ink: false });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, long = i % 3 === 0; kit.add('head', at(rbox(long ? 0.008 : 0.005, long ? 0.022 : 0.012, 0.004, 0.001), [Math.sin(a) * cr * 0.82, cy + Math.cos(a) * cr * 0.82, hd / 2 + 0.008], [0, 0, -a]), ink, { ink: false }); }
    const hand = (len, w, col) => { const g = new THREE.Group(); g.position.set(0, cy, hd / 2 + 0.011); g.add(new THREE.Mesh(merge([[at(rbox(w, len, 0.004, w * 0.4), [0, len / 2 - w * 0.5, 0]), col]]), fm)); J.head.add(g); return g; };
    const hr = hand(cr * 0.52, 0.016, ink), mn = hand(cr * 0.8, 0.011, ink), sec = hand(cr * 0.86, 0.004, '#d8281c');
    kit.add('head', at(cyl(0.012, 0.012, 0.012, 16), [0, cy, hd / 2 + 0.012], [PI / 2, 0, 0]), '#d8281c', { ink: false });
    clock = { hr, mn, sec };
    face = { update(p, t) {
      mouth.update(p);
      // Rest is ten past ten, the friendly face of every clock in a shop window. A blink drops both hands level.
      const spin = p.fx1 * TAU, mood = p.smile * 0.25 - p.browAng * 0.35, look = p.lookX * 0.5;
      const a1 = lerp(deg(-52) - mood + (p.browR) * 0.3, deg(-90), p.blink), a2 = lerp(deg(52) + mood - (p.browL) * 0.3, deg(90), p.blink);
      hr.rotation.z = -(a1 - look) - spin; mn.rotation.z = -(a2 - look) - spin * 12; sec.rotation.z = -Math.floor(t) / 60 * TAU - spin * 30;
    } };
  } else {
    const ey = hh * 0.60, exx = hw * 0.2;
    const eyes = flatEyes(J.head, fm, { x: exx, y: ey, z: fzz + 0.002, r: 0.027, color: ec, glint: spec.render !== 'hatch' });
    const br = brows(J.head, fm, { x: exx, y: ey + 0.055, z: fzz + 0.002, w: 0.03, t: 0.0045, color: ink, tilt: 0, flat: 0.1, travel: 0.02 });
    if (L.glasses) { for (const sx of [-1, 1]) { kit.add('head', at(torus(0.052, 0.007, 32, 8), [sx * exx, ey, fzz + 0.012]), ink, { slot: 'noink' }); kit.add('head', at(new THREE.CircleGeometry(0.05, 24), [sx * exx, ey, fzz + 0.011]), '#fff', { slot: 'glass' }); } kit.add('head', at(cyl(0.006, 0.006, exx * 2 - 0.104, 6), [0, ey, fzz + 0.012], [0, 0, PI / 2]), ink, { slot: 'noink' }); }
    face = { update(p) { eyes.update(p, lens ? p.fx1 * 0.9 : 0); br.update(p); mouth.update(p); } };
  }
  let spark = null;
  if (spec.specials && spec.specials.includes('antennaSpark')) { // a star of light on the antenna tip
    const sg = new THREE.Group(); sg.position.set(0, 0.125, 0); J.ant.add(sg);
    const sm = new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, depthWrite: false });
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(at(rbox(0.008, 0.11, 0.008, 0.003), [0, 0.085, 0]), sm); m.rotation.z = i / 8 * TAU; sg.add(m); }
    spark = { sg, sm };
  }
  const extra = (p, t) => {
    if (spark) { const k = p.fx1, f = 0.6 + 0.4 * Math.sin(Math.floor(t * 24) * 2.4); spark.sg.visible = k > 0.01; spark.sg.scale.setScalar(k * (0.7 + 0.6 * f)); spark.sg.rotation.z = Math.floor(t * 12) * 0.4; spark.sm.opacity = clamp(k * 1.5, 0, 1); }
  };
  return { J, d, kit, face, extra, rest: { L: { sw: 0.02, out: 0.16, el: 0.2, tw: 0 }, R: { sw: 0.12, out: 0.14, el: L.prop ? 1.15 : 0.2, tw: L.prop === 'card' ? 0.5 : 0.1 } }, curl: 0.25 };
}
// A small plate of text (the badge). The text is drawn with the canvas API from a string in characters.json.
function textPlate(text, w, h, ink, pos) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = ink; x.font = '700 ' + Math.round(c.height * 0.62) + 'px "DejaVu Sans", Verdana, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(...pos); return m;
}

/* ---------- The owl: Mocho. Wings are its arms, so every arm gesture is a wing gesture. ---------- */
export function owl(spec, style) {
  const L = spec.looks, c = L.color || '#8a5a2b', bel = L.belly || '#e8d3ac', ink = L.ink || '#2a1a0c', dark = shade(c, -0.22);
  const d = { hip: 0.25, spine: 0.0, chest: 0.08, neck: 0.50, head: 0.02, shX: 0.285, shY: 0.33, upper: 0.2, fore: 0.17, legX: 0.1, thigh: 0.09, shin: 0.11, ankle: 0.05, height: 1.25 };
  const J = skeleton(d), kit = new Kit();
  const egg = { cx: 0.33, cy: 0.19, ry: 0.39, cz: 0.3 }, ez = (x, y) => egg.cz * Math.sqrt(Math.max(0.001, 1 - (x / egg.cx) ** 2 - ((y - egg.cy) / egg.ry) ** 2));
  kit.add('chest', ball(1, [0, egg.cy, 0], [egg.cx, egg.ry, egg.cz], 40), c);
  kit.add('chest', ball(1, [0, egg.cy - 0.03, 0.045], [egg.cx * 0.74, egg.ry * 0.82, egg.cz * 0.93], 36), bel, { ink: false });
  for (let i = 0; i < 4; i++) for (let k = 0; k < (i % 2 ? 3 : 4); k++) { const x = (k - ((i % 2 ? 3 : 4) - 1) / 2) * 0.1, y = 0.36 - i * 0.105, z = egg.cz * 0.93 * Math.sqrt(Math.max(0.01, 1 - (x / (egg.cx * 0.74)) ** 2 - ((y - egg.cy + 0.03) / (egg.ry * 0.82)) ** 2)) + 0.045;
    kit.add('chest', at(torus(0.026, 0.0065, 12, 6, PI), [x, y, z + 0.002], [-0.25 + (y - 0.19) * -1.2, x * 2.2, PI]), shade(bel, -0.3), { ink: false }); }
  const tl = J._j('tail', 'hips', 0, 0.02, -0.22); for (const x of [-0.07, 0, 0.07]) kit.add('tail', at(ball(1, [0, 0, 0], [0.06, 0.16, 0.022], 12), [x, -0.09, -0.04], [-0.9, 0, x * 3]), x ? dark : shade(c, -0.35));
  // Head: wide, with ear tufts and two pale discs.
  const hc = [0, 0.2, 0], hr = [0.335, 0.26, 0.275];
  kit.add('head', ball(1, hc, hr, 40), c);
  const hz = (x, y) => hr[2] * Math.sqrt(Math.max(0.001, 1 - (x / hr[0]) ** 2 - ((y - hc[1]) / hr[1]) ** 2));
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const t = J._j('tuft' + s, 'head', sx * 0.2, 0.38, 0); t.userData.restRot = [0, 0, -sx * 0.5]; kit.add('tuft' + s, at(new THREE.ConeGeometry(0.075, 0.2, 14), [0, 0.07, 0], [0, 0, 0], [1, 1, 0.6]), c);
    kit.add('head', at(ball(1, [0, 0, 0], [0.142, 0.142, 0.05], 28), [sx * 0.125, 0.2, hz(sx * 0.125, 0.2) - 0.028], [0, sx * 0.42, 0]), '#fff8e8', { ink: false });
    kit.add('arm' + s, at(ball(1, [0, 0, 0], [0.055, 0.19, 0.15], 20), [sx * 0.012, -0.13, -0.02]), dark);
    kit.add('el' + s, at(ball(1, [0, 0, 0], [0.042, 0.16, 0.125], 18), [0, -0.1, -0.02]), shade(c, -0.32));
    for (let i = 0; i < 3; i++) { const f = J._j('f' + s + i, 'wr' + s, 0, 0.03, 0.05 - i * 0.05); f.userData.sx = sx; f.userData.feather = true; kit.add('f' + s + i, at(ball(1, [0, 0, 0], [0.022, 0.085, 0.04], 10), [0, -0.07, 0]), i % 2 ? dark : shade(c, -0.38)); }
    kit.add('leg' + s, limb(0.03, 0.026, d.thigh, 8), '#e8a020'); kit.add('kn' + s, limb(0.026, 0.022, d.shin, 8), '#e8a020');
    for (const a of [-0.45, 0, 0.45]) kit.add('an' + s, at(limb(0.02, 0.012, 0.1, 8), [0, -0.03, 0.01], [-PI / 2 + 0.12, 0, 0]).applyMatrix4(new THREE.Matrix4().makeRotationY(a)), '#e8a020');
  }
  const eyY = 0.2, eyX = 0.125, er = 0.072;
  const eyes = ballEyes(J.head, style, { x: eyX, y: eyY, z: hz(eyX, eyY) - er * 0.5, r: er, iris: L.iris || '#e8a020', irisA: 0.95, limb: ink, skin: shade(c, 0.1), ink, lash: 0.04, open: 0.72 });
  if (L.glasses) { const gz = hz(eyX, eyY) + er * 0.62; for (const sx of [-1, 1]) { kit.add('head', at(torus(0.108, 0.008, 40, 8), [sx * eyX, eyY, gz]), ink, { slot: 'noink' }); kit.add('head', at(new THREE.CircleGeometry(0.106, 32), [sx * eyX, eyY, gz]), '#fff', { slot: 'glass' }); } kit.add('head', at(cyl(0.007, 0.007, 0.04, 6), [0, eyY + 0.012, gz], [0, 0, PI / 2]), ink, { slot: 'noink' }); }
  // Beak: the upper half is fixed, the lower half is the jaw.
  const bz = hz(0, 0.1) - 0.01;
  kit.add('head', at(new THREE.ConeGeometry(0.05, 0.11, 14), [0, 0.11, bz + 0.03], [PI * 0.58, 0, 0], [1, 1, 0.75]), '#e8a020');
  const bk = J._j('beak', 'head', 0, 0.105, bz); kit.add('beak', at(new THREE.ConeGeometry(0.036, 0.075, 12), [0, -0.022, 0.03], [PI * 0.66, 0, 0], [1, 1, 0.6]), '#c8801a');
  const face = { update(p) { eyes.update(p); J.beak.rotation.x = clamp(p.jaw, 0, 1) * 0.55; } };
  const extra = (p) => { const ruff = p.fx1; J.chest.scale.setScalar(1 + ruff * 0.07); J.tuftL.scale.setScalar(1 + ruff * 0.35); J.tuftR.scale.setScalar(1 + ruff * 0.35); };
  return { J, d, kit, face, extra, rest: { L: { sw: -0.05, out: 0.12, el: 0.1, tw: 0 }, R: { sw: -0.05, out: 0.12, el: 0.1, tw: 0 } }, curl: 0.0, headTurn: 1 };
}

/* ---------- The cube: Cubo. No legs: it rolls on its edges. Its hands float, as game mascots' hands do. ---------- */
export function cube3d(spec, style) {
  const L = spec.looks, s = L.size || 0.78, c = L.color || '#ff9a10', ink = L.ink || '#1b1b1f';
  const d = { hip: s / 2, spine: 0, chest: 0, neck: 0, head: 0, shX: s * 0.5, shY: s * 0.2, upper: 0.27, fore: 0.25, legX: 0.1, thigh: 0.001, shin: 0.001, ankle: 0, height: s, cube: s };
  const J = skeleton(d), kit = new Kit();
  for (const a of ['armL', 'armR']) { J.body.add(J[a]); J[a].position.y += d.hip; J[a].userData.rest.copy(J[a].position); }   // the hands do not tumble with the cube
  const jelly = J._j('jelly', 'head', 0, -s / 2, 0);              // pivot on the floor, so squash keeps the base down
  const cubeG = at(rbox(s, s, s, 0.085, 6), [0, s / 2, 0]); kit.add('jelly', cubeG, c);
  const fg = new THREE.Group(); fg.position.set(0, s / 2, s / 2 + 0.002); jelly.add(fg);
  const eyes = flatEyes(fg, BASIC, { x: s * 0.2, y: s * 0.09, z: 0.001, r: s * 0.075, color: ink, glint: true });
  const br = brows(fg, BASIC, { x: s * 0.2, y: s * 0.235, z: 0.001, w: s * 0.07, t: s * 0.013, color: ink, tilt: 0.12, flat: 0.1, travel: s * 0.04 });
  const mouth = new Mouth(fg, BASIC, { y: -s * 0.17, w: s * 0.13, h: s * 0.2, z: () => 0.001, lipColor: ink, lip: s * 0.012, inside: '#5a1010' });
  for (const sx of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CircleGeometry(s * 0.055, 20), new THREE.MeshBasicMaterial({ color: '#ff5a3a', transparent: true, opacity: 0.45 })); ch.position.set(sx * s * 0.33, -s * 0.06, 0.0005); fg.add(ch); }
  for (const [sd, sx] of [['L', 1], ['R', -1]]) {
    kit.add('wr' + sd, ball(0.085, [0, -0.04, 0], [0.8, 1, 1], 18), '#fff6e6');
    const th = J._j('f' + sd + '0', 'wr' + sd, 0, -0.02, 0.06); th.userData.restRot = [-0.9, 0, 0]; th.userData.sx = sx; th.userData.thumb = true; kit.add('f' + sd + '0', limb(0.03, 0.026, 0.05, 10), '#fff6e6');
    const f = J._j('f' + sd + '1', 'wr' + sd, 0, -0.1, 0.02); f.userData.sx = sx; kit.add('f' + sd + '1', limb(0.028, 0.024, 0.05, 10), '#fff6e6');
  }
  const face = { update(p) { eyes.update(p); br.update(p); mouth.update(p); } };
  // The face stays upright while the cube tumbles round it; head channels lean the whole cube.
  // The gloves are tucked away at rest and pop out only while an arm channel is in use, so Cubo stays a cube.
  const extra = (p) => {
    fg.rotation.z = -p.r_roll;
    for (const sd of ['L', 'R']) { const act = Math.abs(p['a' + sd + '_sw']) + Math.abs(p['a' + sd + '_out']) + Math.abs(p['a' + sd + '_el']) * 0.5, k = smooth(act / 0.35); J['wr' + sd].scale.setScalar(Math.max(0.0001, k)); J['wr' + sd].visible = k > 0.01; }
  };
  return { J, d, kit, face, extra, rest: { L: { sw: 0.1, out: 0.5, el: 0.5, tw: 0.2 }, R: { sw: 0.1, out: 0.5, el: 0.5, tw: 0.2 } }, curl: 0.1, cube: true };
}

/* ---------- The mosaic: Ceefax. A blocky figure in the eight teletext colours; teletext.js turns it into blocks. ---------- */
export function mosaic(spec, style) {
  const P = spec.looks.palette;
  const d = { hip: 0.43, spine: 0.04, chest: 0.1, neck: 0.3, head: 0.03, shX: 0.215, shY: 0.24, upper: 0.18, fore: 0.17, legX: 0.1, thigh: 0.185, shin: 0.185, ankle: 0.06, height: 1.5 };
  const J = skeleton(d), kit = new Kit();
  kit.add('chest', at(rbox(0.4, 0.36, 0.26, 0.02, 2), [0, 0.13, 0]), P.B); kit.add('hips', at(rbox(0.34, 0.14, 0.24, 0.02, 2), [0, 0.0, 0]), P.B);
  kit.add('neck', at(rbox(0.14, 0.1, 0.14, 0.01, 2), [0, 0, 0]), P.W);
  const hw = 0.66, hh = 0.56, hd = 0.5;
  kit.add('head', at(rbox(hw, hh, hd, 0.03, 2), [0, hh / 2, 0]), P.Y);
  kit.add('head', at(rbox(hw + 0.05, 0.2, hd + 0.05, 0.03, 2), [0, hh - 0.05, -0.01]), P.G);      // green hair, as in version 1
  kit.add('head', at(rbox(hw + 0.05, 0.4, hd * 0.5, 0.03, 2), [0, hh - 0.2, -hd * 0.3]), P.G);
  for (const sx of [-1, 1]) kit.add('head', at(rbox(0.07, 0.17, 0.1, 0.01, 2), [sx * (hw / 2 + 0.02), hh * 0.42, 0]), P.W);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    kit.add('arm' + s, at(rbox(0.11, d.upper + 0.04, 0.11, 0.01, 2), [0, -d.upper / 2, 0]), P.B); kit.add('el' + s, at(rbox(0.1, d.fore + 0.02, 0.1, 0.01, 2), [0, -d.fore / 2, 0]), P.B);
    kit.add('wr' + s, at(rbox(0.12, 0.13, 0.12, 0.01, 2), [0, -0.05, 0]), P.Y);
    kit.add('leg' + s, at(rbox(0.13, d.thigh + 0.03, 0.13, 0.01, 2), [0, -d.thigh / 2, 0]), P.W); kit.add('kn' + s, at(rbox(0.12, d.shin + 0.03, 0.12, 0.01, 2), [0, -d.shin / 2, 0]), P.W);
    kit.add('an' + s, at(rbox(0.15, 0.09, 0.26, 0.01, 2), [0, -0.02, 0.05]), P.L);
  }
  const fz = hd / 2 + 0.004, eyes = flatEyes(J.head, BASIC, { x: 0.15, y: hh * 0.53, z: fz, r: 0.062, color: P.K });
  eyes.eyes.forEach((e) => { e.m.geometry.dispose(); e.m.geometry = merge([[new THREE.PlaneGeometry(0.125, 0.125), P.K]]); });   // square eyes
  const mouth = new Mouth(J.head, BASIC, { y: hh * 0.2, w: 0.11, h: 0.13, z: () => fz, lipColor: P.K, lip: 0.02, inside: P.R, teeth: P.R, tongue: P.R });
  const face = { update(p) { eyes.update(p); mouth.update(p); } };
  return { J, d, kit, face, extra: null, rest: { L: { sw: 0, out: 0.12, el: 0.1, tw: 0 }, R: { sw: 0, out: 0.12, el: 0.1, tw: 0 } }, curl: 0, mosaic: true };
}
export const BODIES = { humanoid, boxbot, owl, cube3d, mosaic };
