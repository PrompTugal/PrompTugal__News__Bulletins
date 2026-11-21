/* stage.js: the scene the presenters stand in, and render(). The stage owns the renderer, the floor, the lights
 * and the camera; it knows nothing about moves. Whoever calls it passes poses that were already computed from t. */
import * as THREE from '../vendor/three.module.min.js';
import { build } from './rig.js';
import { makeTeletext } from './teletext.js';
import { at, rbox } from './geometry.js';
import { CH, newPose } from './channels.js';

const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), BS = new THREE.Sphere();
export const RISER = { y: 0.55, z0: -3.4, z1: -1.25 };
export const BACKDROPS = { 'grid-navy': '#0a1230', studio: '#17253f', 'soft-studio': '#c9ced6', black: '#000000', paper: '#f1ecdf', zx: '#d7dbe2', office: '#e6edf0', dusk: '#2a2448', gradient: '#2b1d4a' };

export class Stage {
  constructor(canvas, specs, opt = {}) {
    this.canvas = canvas; this.opt = opt;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: !!opt.alpha, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    const sc = this.scene = new THREE.Scene(); if (opt.alpha) r.setClearColor(0x000000, 0); else sc.background = new THREE.Color(opt.background || '#060914');
    this.camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 200);
    sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3026, 1.5));
    const key = new THREE.DirectionalLight(0xfff0dc, 3.0); key.position.set(-4, 7, 8); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 2.6); rim.position.set(5, 5, -7); sc.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(6, 2, 6); sc.add(fill);
    this.set = new THREE.Group(); sc.add(this.set);
    if (opt.set !== false) this.buildSet();
    this.chars = []; this.byId = {};
    specs.forEach((spec, i) => {
      const c = build(spec, i); c.slot = spec.slot || [0, 0]; c.baseY = opt.flat ? 0 : (c.slot[1] < RISER.z1 && c.slot[1] > RISER.z0 ? RISER.y : 0);
      if (spec.kind === 'mosaic') { c.tele = makeTeletext(c, spec.looks); c.object = c.tele.panel; }
      sc.add(c.object);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uA: { value: 0.5 } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uA; varying vec2 vU; void main(){ float d = length(vU - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.0, 0.0, uA * pow(1.0 - clamp(d, 0.0, 1.0), 1.6)); }' }));
      sh.rotation.x = -Math.PI / 2; sh.renderOrder = -5; c.shadow = sh; c.shadowR = spec.kind === 'cube3d' ? 0.62 : spec.kind === 'owl' ? 0.5 : spec.kind === 'mosaic' ? 0.0 : 0.42; sc.add(sh);
      this.chars.push(c); this.byId[c.id] = c;
    });
    this.rest = newPose(); this.size = [0, 0];
  }
  buildSet() {
    // The floor: dark, with a faint grid that fades with distance, like the teletext page the site is built on.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.ShaderMaterial({ uniforms: {},
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `varying vec3 vW; void main(){ vec2 g = abs(fract(vW.xz / 0.9) - 0.5); float w = fwidth(vW.x / 0.9) * 1.2; float line = 1.0 - smoothstep(0.5 - w * 1.5, 0.5, max(g.x, g.y)); line = 1.0 - smoothstep(0.0, w * 1.5, 0.5 - max(g.x, g.y));
        float fade = exp(-dot(vW.xz, vW.xz) / 160.0); vec3 base = mix(vec3(0.012, 0.016, 0.035), vec3(0.03, 0.045, 0.10), fade); vec3 col = base + vec3(0.05, 0.22, 0.30) * line * 0.35 * fade; gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }` }));
    floor.rotation.x = -Math.PI / 2; this.set.add(floor);
    const riser = new THREE.Mesh(at(rbox(13.4, RISER.y, RISER.z1 - RISER.z0, 0.03, 2), [0, RISER.y / 2, (RISER.z0 + RISER.z1) / 2]), new THREE.MeshStandardMaterial({ color: '#141b33', roughness: 0.75 })); this.set.add(riser);
    const edge = new THREE.Mesh(at(new THREE.BoxGeometry(13.4, 0.035, 0.03), [0, RISER.y - 0.02, RISER.z1 + 0.002]), new THREE.MeshBasicMaterial({ color: '#ffe600' })); this.set.add(edge);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vU; void main(){ float d = distance(vU, vec2(0.5, 0.42)); vec3 c = mix(vec3(0.05, 0.085, 0.20), vec3(0.008, 0.012, 0.03), smoothstep(0.0, 0.42, d)); gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` }));
    wall.position.set(0, 9, -14); this.set.add(wall);
  }
  setSize(w, h) {
    if (this.size[0] === w && this.size[1] === h) return; this.size = [w, h];
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    for (const c of this.chars) c.style.setRes(w, h);
  }
  setCamera(cam) { const c = this.camera; c.position.set(...cam.pos); c.fov = cam.fov || 28; c.updateProjectionMatrix(); c.lookAt(cam.look[0], cam.look[1], cam.look[2]); }
  /* poses: id -> Float64Array, springs: id -> array (may be missing), only: an id or a list of ids to draw (null for all). */
  render(poses, springs, t, only = null) {
    const env = { height: this.size[1] }, cam = this.camera;
    cam.updateMatrixWorld(); FR.setFromProjectionMatrix(PM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (const c of this.chars) {
      const p = poses[c.id] || this.rest;
      // A character is skipped when it is hidden, or wholly outside the camera's view: close-ups then cost one figure, not twelve.
      let show = (!only || only === c.id || (only.includes && only.includes(c.id))) && p[CH.hide] < 0.5;
      if (show) { BS.center.set(p[CH.r_x], c.baseY + c.height * 0.55 + p[CH.r_y], p[CH.r_z]); BS.radius = c.height * 0.75 + 1.1; show = FR.intersectsSphere(BS); }
      c.object.visible = show; c.shadow.visible = show && c.shadowR > 0 && this.opt.shadows !== false; if (!show) continue;
      c.apply(p, springs && springs[c.id], t, env);
      if (c.tele) c.tele.render(this.renderer, c.P, c.baseY);
      const up = Math.max(0, c.P.r_y), k = c.shadowR * (1 + up * 0.5);
      c.shadow.position.set(c.P.r_x, c.baseY + 0.006, c.P.r_z); c.shadow.scale.set(k, k, 1); c.shadow.material.uniforms.uA.value = 0.55 / (1 + up * 2.2) * (c.style.render === 'hologram' ? 0.3 : 1);
    }
    this.renderer.render(this.scene, this.camera);
  }
  // Where a stage point lands on the canvas, in CSS pixels of a w x h box: used to place the name labels.
  project(x, y, z, w, h) { const v = new THREE.Vector3(x, y, z).project(this.camera); return [(v.x * 0.5 + 0.5) * w, (1 - (v.y * 0.5 + 0.5)) * h, v.z]; }
}
