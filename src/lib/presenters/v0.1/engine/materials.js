/* materials.js: the drawing styles. In version 1 a style was a way of filling SVG shapes; here a style is a set of
 * shaders on a 3D puppet. A style gives: material(slot), an optional outline(slot) (the ink hull), and
 * update(t, pose, env) to feed time and effect channels to its shaders. All motion in a shader comes from the uTime
 * uniform, so the same t always shades the same way. */
import * as THREE from '../vendor/three.module.min.js';

const HASH = `float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float hash1(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453123); }`;

/* Flat, line and hatch share one shader. Light comes from a fixed direction in view space, so the cel band sits in
 * the same place on screen however the puppet turns: that is what keeps a flat style looking drawn, not lit. */
const TOON_V = `varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec3 vO;
void main(){ vColor = color; vO = position; vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const TOON_F = `uniform vec3 uLight; uniform float uBand, uEdge, uHatch, uTime, uReveal, uPx, uSeed, uBaseY, uSpanY, uLit; varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec3 vO;
${HASH}
void main(){
  vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
  float tone = dot(n, normalize(uLight)) * 0.5 + 0.5;
  vec3 col = vColor;
  if (uHatch < 0.5) {
    col *= mix(1.0 - uBand, 1.0, smoothstep(uEdge - 0.012, uEdge + 0.012, tone));
    col += uLit * pow(max(0.0, tone - 0.86) / 0.14, 2.0) * 0.10;
  } else {
    // Hand-drawn hatching: a paper-tinted fill, pen lines that thicken in shade, a cross set in deep shade.
    // floor(uTime * 8) redraws the lines 8 times a second: the "boil" of a drawing made again for each frame.
    vec2 p = gl_FragCoord.xy * uPx; float k = floor(uTime * 8.0) + uSeed;
    float wob = sin(p.y * 0.045 + hash1(k) * 6.283) * 1.6 + sin(p.x * 0.031 + hash1(k + 3.0) * 6.283) * 1.3;
    float lum = dot(vColor, vec3(0.3, 0.6, 0.1));
    vec3 paper = mix(vColor, vec3(0.96, 0.94, 0.88), 0.5); // was 0.72, which washed the colours out at bulletin size
    float dark = 1.0 - tone; dark = clamp(dark * 1.15 + (1.0 - lum) * 0.10, 0.0, 1.0);
    float a = abs(fract((p.x + p.y + wob) / 9.0 + hash1(k + 7.0)) - 0.5) * 2.0;
    float b = abs(fract((p.x - p.y + wob) / 9.0 + hash1(k + 11.0)) - 0.5) * 2.0;
    float w1 = mix(0.10, 0.62, smoothstep(0.18, 0.75, dark)), w2 = mix(0.0, 0.5, smoothstep(0.55, 0.9, dark));
    float m = max(1.0 - smoothstep(w1 - 0.12, w1 + 0.12, a), 1.0 - smoothstep(w2 - 0.12, w2 + 0.12, b));
    col = mix(paper, vColor * 0.92, m);
  }
  if (uReveal > 0.001) { // sketch-on: first bare paper inside the lines, from the head down; then the fill, from the feet up
    float h0 = (vW.y - uBaseY) / uSpanY, h = h0 + (hash(floor(gl_FragCoord.xy * uPx / 5.0)) - 0.5) * 0.16;
    if (1.0 - h0 > (1.0 - uReveal) / 0.5 * 1.05) discard;
    if (h > (0.55 - uReveal) / 0.55 * 1.1 - 0.05) col = vec3(0.955, 0.935, 0.875);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
/* The ink line is an inverted hull: the mesh drawn again, back faces only, pushed out along its normals by a fixed
 * number of pixels. uWeight makes the line heavier underneath, as an inker would; uBoil jitters it 8 times a second. */
const INK_V = `uniform float uWidth, uTime, uBoil, uSeed, uWeight, uPass; uniform vec2 uRes; varying vec3 vW;
${HASH}
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 clip = projectionMatrix * viewMatrix * w;
  vec3 n = normalize(normalMatrix * normal); vec2 dir = normalize(n.xy + vec2(1e-5));
  float wd = uWidth * (1.0 + uWeight * (-dir.y * 0.5 + 0.15));
  float k = floor(uTime * 8.0) + uSeed + uPass * 17.0;
  vec2 jit = (vec2(hash(position.xy * 31.0 + k), hash(position.yz * 17.0 + k)) - 0.5) * uBoil;
  clip.xy += (dir * wd + jit) * 2.0 / uRes * clip.w;
  gl_Position = clip;
}`;
const INK_F = `uniform vec3 uInk; uniform float uReveal, uBaseY, uSpanY; varying vec3 vW;
void main(){
  // sketch-on: the ink arrives first, drawn from the head down
  if (uReveal > 0.001) { float h = (vW.y - uBaseY) / uSpanY; if (1.0 - h > (1.0 - uReveal) / 0.5 * 1.05) discard; }
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
}`;
/* The hologram: light, not surface. Brightness comes from the rim (fresnel), fine scan lines ride up the body, a
 * sweep band passes through it, slices jump sideways when it glitches, and it dissolves from the feet when it
 * re-materialises. The same shader, enlarged and additive, is the glow shell. */
const HOLO_V = `uniform float uTime, uGlitch, uShell; varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec3 vV;
${HASH}
void main(){
  vColor = color; vec3 pos = position + normal * uShell;
  vec4 w = modelMatrix * vec4(pos, 1.0);
  float slice = floor(w.y * 16.0), k = floor(uTime * 20.0);
  float g = step(1.0 - uGlitch * 0.55, hash(vec2(slice, k)));
  vec4 v = viewMatrix * w; v.x += g * (hash(vec2(k, slice)) - 0.5) * 0.5 * uGlitch;
  vW = w.xyz; vN = normalize(normalMatrix * normal); vV = normalize(-v.xyz);
  gl_Position = projectionMatrix * v;
}`;
const HOLO_F = `uniform float uTime, uMat, uSweep, uShell, uBaseY, uSpanY, uGlitch; varying vec3 vColor; varying vec3 vN; varying vec3 vW; varying vec3 vV;
${HASH}
void main(){
  vec3 n = normalize(vN); float f = pow(1.0 - abs(dot(n, normalize(vV))), 1.7);
  float h = (vW.y - uBaseY) / uSpanY;
  float lum = dot(vColor, vec3(0.3, 0.6, 0.1));
  vec3 lo = vec3(0.02, 0.16, 0.85), hi = vec3(0.45, 0.93, 1.0);
  vec3 col = mix(lo, hi, clamp(lum * 0.9 + h * 0.25 + f * 0.6, 0.0, 1.0));
  float scan = 0.72 + 0.28 * step(0.45, fract(vW.y * 46.0 - uTime * 0.9));
  float flick = 0.90 + 0.10 * hash1(floor(uTime * 30.0)) - 0.25 * step(0.93, hash1(floor(uTime * 12.0) + 5.0)) * (0.3 + uGlitch);
  float band = exp(-pow((h - uSweep) * 9.0, 2.0));
  float edge = h - (1.0 - uMat * 1.25) - (hash(floor(vW.xy * 60.0)) - 0.5) * 0.12;   // dissolve front, from the feet
  if (uMat > 0.001 && edge > 0.0) discard;
  float rimline = (uMat > 0.001) ? smoothstep(-0.05, 0.0, edge) : 0.0;
  float a;
  if (uShell > 0.0) { a = f * f * 0.5 * flick + band * 0.35; col = hi; }
  else { a = (0.42 + 0.58 * f) * scan * flick; col += band * 0.9 + rimline * 1.2; col *= 1.15; }
  // Dark features (pupils, the inside of the mouth) stay dark and solid, so the face can be read and lip-sync shows.
  if (uShell <= 0.0) { float dk = 1.0 - smoothstep(0.10, 0.40, lum); col = mix(col, vec3(0.0, 0.04, 0.22), dk * 0.9); a = mix(a, 0.92, dk); }
  gl_FragColor = vec4(col, clamp(a + rimline, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

const uni = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));

export function makeStyle(render, looks = {}, seedN = 1) {
  const ink = new THREE.Color(looks.ink || '#1b1b1f');
  const shared = { uTime: { value: 0 }, uReveal: { value: 0 }, uBaseY: { value: 0 }, uSpanY: { value: 1.9 }, uRes: { value: new THREE.Vector2(1920, 1080) }, uPx: { value: 1 } };
  const cache = {};
  const toon = (o) => new THREE.ShaderMaterial({ vertexShader: TOON_V, fragmentShader: TOON_F, vertexColors: true, side: THREE.DoubleSide,
    uniforms: { ...uni({ uLight: new THREE.Vector3(-0.45, 0.75, 0.6), uBand: o.band, uEdge: o.edge ?? 0.42, uHatch: o.hatch || 0, uSeed: seedN, uLit: o.lit || 0 }), uTime: shared.uTime, uReveal: shared.uReveal, uPx: shared.uPx, uBaseY: shared.uBaseY, uSpanY: shared.uSpanY } });
  const inkMat = (o) => new THREE.ShaderMaterial({ vertexShader: INK_V, fragmentShader: INK_F, side: THREE.BackSide,
    uniforms: { ...uni({ uWidth: o.width, uBoil: o.boil || 0, uSeed: seedN, uWeight: o.weight || 0, uPass: o.pass || 0, uInk: ink, uW0: o.width, uB0: o.boil || 0 }), uTime: shared.uTime, uRes: shared.uRes, uReveal: shared.uReveal, uBaseY: shared.uBaseY, uSpanY: shared.uSpanY } });
  const basic = () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const S = { render, shared, inks: [], update() {} };
  const setRes = (w, h) => { shared.uRes.value.set(w, h); shared.uPx.value = 1080 / h; for (const m of S.inks) { m.uniforms.uWidth.value = m.uniforms.uW0.value * h / 1080; m.uniforms.uBoil.value = m.uniforms.uB0.value * h / 1080; } };
  S.setRes = setRes;
  const mk = (k, f) => cache[k] || (cache[k] = f());

  if (render === 'flat' || render === 'line' || render === 'hatch') {
    const P = { flat: { band: 0.10, width: 2.0, weight: 0.5, lit: 0.0 }, line: { band: 0.16, width: 4.4, weight: 0.9, lit: 1 }, hatch: { band: 0, width: 1.9, weight: 0.3, boil: 2.6, hatch: 1 } }[render];
    // Hatch shades skin and hair with a flat cel band, not pen lines: at bulletin size the lines (a fixed number of
    // pixels apart) ran through small faces and turned them to noise (Dinis, 21 Nov 2026: "The Guide looks pretty weird").
    const plain = { band: 0.12, edge: 0.42 };
    S.material = (slot) => mk(slot, () => (slot === 'glass' ? new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.28, depthWrite: false }) : slot === 'flat' ? basic() : (render === 'hatch' && (slot === 'skin' || slot === 'hair')) ? toon(plain) : toon(P)));
    S.outline = (slot) => (slot === 'glass' || slot === 'flat' || slot === 'noink') ? null : mk('ink', () => { const m = inkMat(P); S.inks.push(m); return m; });
    if (render === 'hatch') { // version 1 drew each hatched outline twice with a different wobble; so does this
      const first = S.outline; S.outline2 = () => mk('ink2', () => { const m = inkMat({ ...P, pass: 1, width: 1.2 }); S.inks.push(m); return m; }); S.outline = first;
    }
    S.update = (t, fx) => { shared.uTime.value = t; shared.uReveal.value = fx.reveal || 0; };
  } else if (render === 'realistic' || render === '3d') {
    const R = render === 'realistic';
    S.material = (slot) => mk(slot, () => {
      if (slot === 'glass') return new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
      if (slot === 'flat') return basic();
      const o = { vertexColors: true, roughness: 0.6, metalness: 0 };
      if (slot === 'skin') Object.assign(o, { roughness: 0.86, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ff9a7a') });   // matt: skin is not plastic
      if (slot === 'cloth') Object.assign(o, { roughness: 0.95, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color('#aab4c4') });
      if (slot === 'hair') Object.assign(o, { roughness: 0.9 });
      if (slot === 'eye') Object.assign(o, { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
      // looks.matt (0..1) takes the gloss off: no sheen, no specular highlight, on skin, cloth and hair alike.
      if (R && looks.matt && slot !== 'eye') { const k = 1 - looks.matt; Object.assign(o, { roughness: 1 - 0.15 * k, sheen: (o.sheen || 0) * k, specularIntensity: 0.9 * k }); }
      if (!R) Object.assign(o, { roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.25 });
      return new THREE.MeshPhysicalMaterial(o);
    });
    S.outline = null;
  } else if (render === 'hologram') {
    const U = { uTime: shared.uTime, uBaseY: shared.uBaseY, uSpanY: shared.uSpanY, ...uni({ uGlitch: 0, uMat: 0, uSweep: -1 }) };
    const body = new THREE.ShaderMaterial({ vertexShader: HOLO_V, fragmentShader: HOLO_F, vertexColors: true, transparent: true, side: THREE.DoubleSide, uniforms: { ...U, uShell: { value: 0 } } });
    const shell = new THREE.ShaderMaterial({ vertexShader: HOLO_V, fragmentShader: HOLO_F, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, uniforms: { ...U, uShell: { value: 0.035 } } });
    S.material = () => body; S.outline = (slot) => (slot === 'noink' ? null : shell); S.holo = U;
    S.update = (t, fx) => { shared.uTime.value = t; U.uGlitch.value = fx.glitch || 0; U.uMat.value = fx.mat || 0; U.uSweep.value = fx.sweep ?? -1; };
  } else { // teletext: pure colours, no shading; teletext.js turns the picture into blocks
    S.material = () => mk('b', basic); S.outline = null;
  }
  return S;
}
