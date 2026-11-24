/* scenes.js: bigger 3D sets, built by code from data (presenters 0.3.0, bulletins.d@PrompTugal.dinis, 24 Nov 2026).
 * Dinis, relayed by c.studio through the maestros: "work with the dev to start creating these sort of bigger scenes
 * and these three-dimensional stories". Data in, not baked in: every count, label and texture comes from the spec.
 * A scene has the same shape as a prop (props.js): uses(t), update(t), destroy(), plus anchor(name, t), which gives a
 * camera target { p: [x, y, z], r } (r: how far away the camera stands to frame it), and base(aspect), the shot that
 * frames the whole set. Every frame is a function of t.
 *   { kind: 'galaxy', suns: [{ id, label, agents, color }], seed, title }     six suns (people) with agent planets */
import * as THREE from '../vendor/three.module.min.js';
import { rng, TAU } from './math.js';

// A text label drawn into a canvas, shown as a sprite that always faces the camera.
function label(text, sub, opt = {}) {
  const c = document.createElement('canvas'), W = 1024, H = sub ? 256 : 160; c.width = W; c.height = H;
  const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = opt.size || 84; g.font = `700 ${fs}px "DejaVu Sans", sans-serif`; while (fs > 24 && g.measureText(text).width > W - 40) { fs -= 4; g.font = `700 ${fs}px "DejaVu Sans", sans-serif`; }   // shrink to fit
  g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.fillStyle = opt.color || '#ffffff';
  g.strokeText(text, W / 2, sub ? 90 : H / 2); g.fillText(text, W / 2, sub ? 90 : H / 2);
  if (sub) { g.font = '400 60px "DejaVu Sans", sans-serif'; g.fillStyle = opt.subColor || '#bfe8ff'; g.lineWidth = 10; g.strokeText(sub, W / 2, 190); g.fillText(sub, W / 2, 190); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // screen: true keeps the label the same size on screen at any distance (w is then a fraction of the frame height).
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: !opt.screen }));
  const w = opt.width || 2.4; s.scale.set(w, w * H / W, 1); s.renderOrder = 10; return s;
}
// A soft round glow (additive), drawn once into a canvas.
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SUN_COLOURS = ['#ffcf5a', '#ff9f4a', '#ffe9a8', '#ff7a5c', '#ffd27a', '#ffb36b', '#fff1c4', '#ff8d6e'];
const PLANET_COLOURS = ['#4fd1ff', '#7cf7c8', '#9aa8ff', '#5fe0a0', '#c8a0ff', '#62b8ff'];

function galaxy(def, stage) {
  const suns = def.suns || [], r = rng('galaxy:' + (def.seed ?? 1)), group = new THREE.Group(), disposables = [];
  const n = suns.length, R = def.radius ?? Math.max(3.2, n * 1.05), glow = glowTexture(); disposables.push(glow);
  // Stars: a seeded shell of points, far away.
  const SN = def.stars ?? 1800, sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { const u = r() * 2 - 1, a = r() * TAU, d = 60 + r() * 40, q = Math.sqrt(1 - u * u); sp[i * 3] = Math.cos(a) * q * d; sp[i * 3 + 1] = u * d; sp[i * 3 + 2] = Math.sin(a) * q * d; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#cfe0ff', size: 0.18, sizeAttenuation: true })); group.add(stars); disposables.push(sg, stars.material);
  // Suns on a ring, each with its planets (one per agent). Positions of planets are a function of t: an orbit each.
  const at = [], planets = [];
  suns.forEach((s, i) => {
    const a = (i / Math.max(1, n)) * TAU + 0.3, p = new THREE.Vector3(Math.cos(a) * R, (r() - 0.5) * 0.8, Math.sin(a) * R * 0.75); at.push(p);
    const col = s.color || SUN_COLOURS[i % SUN_COLOURS.length];
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 24), new THREE.MeshBasicMaterial({ color: col })); body.position.copy(p); group.add(body); disposables.push(body.geometry, body.material);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(2.6); halo.position.copy(p); group.add(halo); disposables.push(halo.material);
    const light = new THREE.PointLight(col, 6, 5, 1.6); light.position.copy(p); group.add(light);
    const k = Math.max(0, Math.floor(s.agents || 0));
    for (let j = 0; j < 3; j++) { // faint orbit rings
      const rr = 0.85 + j * 0.42, pts = []; for (let q = 0; q <= 96; q++) pts.push(new THREE.Vector3(Math.cos(q / 96 * TAU) * rr, 0, Math.sin(q / 96 * TAU) * rr));
      const lg = new THREE.BufferGeometry().setFromPoints(pts), ring = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#3a5a8a', transparent: true, opacity: 0.35 })); ring.position.copy(p); group.add(ring); disposables.push(lg, ring.material);
    }
    for (let j = 0; j < k; j++) planets.push({ c: p, rad: 0.75 + r() * 1.05, w: 0.35 + r() * 0.35, ph: r() * TAU, inc: (r() - 0.5) * 0.35, y: (r() - 0.5) * 0.12, size: 0.05 + r() * 0.045, col: PLANET_COLOURS[Math.floor(r() * PLANET_COLOURS.length)] });
    const tag = label(s.label || `Person ${i + 1}`, `${k} agent${k === 1 ? '' : 's'}`, { screen: true, width: 0.13 }); tag.position.set(p.x, p.y + 0.95, p.z); group.add(tag); disposables.push(tag.material.map, tag.material);
  });
  // All planets in one instanced mesh: one draw call, however many agents.
  const pg = new THREE.SphereGeometry(1, 16, 10), pm = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, emissive: '#0a1a2a' });
  const inst = new THREE.InstancedMesh(pg, pm, Math.max(1, planets.length)); inst.count = planets.length; group.add(inst); disposables.push(pg, pm);
  const C = new THREE.Color(); planets.forEach((q, i) => inst.setColorAt(i, C.set(q.col))); if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  const total = planets.length;
  if (def.title !== false) { const t = label(def.title || `${total} agents round ${n} ${n === 1 ? 'person' : 'people'}`, def.subtitle || 'counts from the storyboard', { width: 0.42, size: 80, screen: true }); t.position.set(0, R * 0.95, 0); group.add(t); disposables.push(t.material.map, t.material); }
  stage.scene.add(group);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const planetAt = (q, t, out) => { const a = q.ph + q.w * t; return out.set(q.c.x + Math.cos(a) * q.rad, q.c.y + q.y + Math.sin(a) * q.rad * Math.sin(q.inc), q.c.z + Math.sin(a) * q.rad * Math.cos(q.inc)); };
  function update(t) {
    for (let i = 0; i < planets.length; i++) { const q = planets[i]; planetAt(q, t, P); S.setScalar(q.size); M.compose(P, Q.setFromEuler(E.set(0, q.ph + t * 0.6, 0)), S); inst.setMatrixAt(i, M); }
    inst.instanceMatrix.needsUpdate = true; stars.rotation.y = t * 0.004;
  }
  function anchor(name, t) {
    if (name === 'galaxy' || name === 'all') return { p: [0, 0, 0], r: R * 2.4 + 2 };
    const m = /^sun:(.+)$/.exec(name); if (m) { const i = suns.findIndex((s, k) => s.id === m[1] || String(k + 1) === m[1]); if (i < 0) throw new Error('galaxy: no sun "' + m[1] + '"'); return { p: at[i].toArray(), r: 5.6 }; }
    const a = /^agent:(\d+)$/.exec(name); if (a) { const q = planets[+a[1] - 1]; if (!q) throw new Error('galaxy: no agent ' + a[1]); return { p: planetAt(q, t, new THREE.Vector3()).toArray(), r: 1.6 }; }
    return null;
  }
  // The base shot frames the whole ring at any aspect: a tall phone frame stands the camera further back.
  const base = (aspect = 16 / 9) => { const fov = 40, h = Math.atan(Math.tan(fov * Math.PI / 360) * aspect), d = Math.max((R + 1.6) / Math.tan(h), (R + 2.2) / Math.tan(fov * Math.PI / 360)); return { pos: [0, d * 0.42, d * 0.91], look: [0, 0.2, 0], fov }; };
  return { def, uses: () => [], update, anchor, group, base,
    destroy() { stage.scene.remove(group); for (const d of disposables) d.dispose && d.dispose(); } };
}

export const SCENES = { galaxy };
export function makeScene(def, stage) { const f = SCENES[def.kind]; if (!f) throw new Error('scene: unknown kind "' + def.kind + '" (known: ' + Object.keys(SCENES).join(', ') + ')'); return f(def, stage); }
