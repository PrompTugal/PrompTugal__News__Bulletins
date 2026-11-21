/* teletext.js: Ceefax. Version 1 stored a face as rows of palette letters. Here the figure is a puppet like the
 * others, but it is never shown directly: each frame it is drawn off-screen at sextant size, and every 2 x 3
 * character cell is then forced to the rule of a real teletext mosaic: one foreground colour from the eight, on
 * black. What reaches the stage is only that grid, on a page that hangs where Ceefax stands. So it turns, walks and
 * speaks with the same move set, and stays blocks. */
import * as THREE from '../vendor/three.module.min.js';
import { at, rbox } from './geometry.js';

const PAL = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]];   // bit 0 red, 1 green, 2 blue
const CYCLE = [1, 3, 2, 6, 4, 5, 7];   // red, yellow, green, cyan, blue, magenta, white

export function makeTeletext(char, looks) {
  const cols = looks.cols, rows = looks.rows, W = cols * 2, H = rows * 3, s = looks.sextant, pw = W * s, ph = H * s;
  const rt = new THREE.WebGLRenderTarget(W, H, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.add(char.J.root);
  const cam = new THREE.OrthographicCamera(-pw / 2, pw / 2, ph - 0.05, -0.05, 0.1, 30); cam.position.set(0, 0, 10);
  const buf = new Uint8Array(W * H * 4), out = new Uint8Array(W * H * 4), idx = new Uint8Array(W * H);
  const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
  const panel = new THREE.Group();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex })); screen.position.set(0, ph / 2, 0); panel.add(screen);
  const bezel = new THREE.Mesh(at(rbox(pw + 0.14, ph + 0.14, 0.12, 0.05, 3), [0, ph / 2, -0.07]), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.6 })); panel.add(bezel);
  const tele = { panel, scene, W, H, cols, rows,
    /* Called once per frame, after the puppet has been posed. The page moves in whole cells; what is left over is
     * drawn inside the page, so the figure never slides between blocks. */
    render(renderer, p, baseY) {
      const cell = 2 * s, gx = Math.round(p.r_x / cell) * cell, gz = p.r_z;
      panel.position.set(gx, baseY, gz); char.J.root.position.set(p.r_x - gx, 0, 0);
      const old = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); renderer.setRenderTarget(old);
      for (let i = 0; i < W * H; i++) idx[i] = (buf[i * 4] > 110 ? 1 : 0) | (buf[i * 4 + 1] > 110 ? 2 : 0) | (buf[i * 4 + 2] > 110 ? 4 : 0);
      const shift = Math.floor(((p.fx2 % 1) + 1) % 1 * 7 + 1e-6), total = cols * rows, shown = Math.round((1 - Math.min(1, Math.max(0, p.fx1))) * total), cnt = new Uint8Array(8);
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        const order = (rows - 1 - cy) * cols + cx;                 // reading order: the top row first, as a page arrives
        cnt.fill(0); let fg = 0, best = 0;
        for (let k = 0; k < 6; k++) { const c = idx[(cy * 3 + (k >> 1)) * W + cx * 2 + (k & 1)]; if (c) { cnt[c]++; if (cnt[c] > best) { best = cnt[c]; fg = c; } } }
        if (fg && shift) fg = CYCLE[(CYCLE.indexOf(fg) + shift) % 7];
        const hide = order >= shown, cursor = order === shown && shown < total;
        for (let k = 0; k < 6; k++) {
          const q = (cy * 3 + (k >> 1)) * W + cx * 2 + (k & 1), on = !hide && idx[q] !== 0, c = cursor ? PAL[7] : on ? PAL[fg] : PAL[0];
          out[q * 4] = c[0]; out[q * 4 + 1] = c[1]; out[q * 4 + 2] = c[2]; out[q * 4 + 3] = 255;
        }
      }
      tex.needsUpdate = true;
    } };
  return tele;
}
