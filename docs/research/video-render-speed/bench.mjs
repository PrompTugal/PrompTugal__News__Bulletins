// Screenshot benchmark for the v2 bulletin (bulletins.d@PrompTugal.dinis, 22 Nov 2026). Serve src/ on 127.0.0.1:8797 first.
// node bench.mjs <method> <outdir> [--frames 0:939:10] [--noaa] [--scale 0.5]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [method, out] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [f0, f1, step] = arg('--frames', '0:939:10').split(':').map(Number);
const NOAA = process.argv.includes('--noaa');
const LOD = process.argv.includes('--lod');
const SCALE = +arg('--scale', 1);
const FPS = +arg('--fps', 30);
const PORT = +arg('--port', 8797);
mkdirSync(out, { recursive: true });

const beginFrame = method === 'beginframe';
const args = beginFrame ? ['--deterministic-mode', '--enable-begin-frame-control', '--disable-new-content-rendering-timeout',
  '--run-all-compositor-stages-before-draw', '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging'] : [];
const extra = (process.env.CHROME_ARGS || '').split(' ').filter(Boolean);
const b = await chromium.launch({ args: [...args, ...extra], headless: !process.env.HEADED });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
const p = await ctx.newPage();
if (NOAA || SCALE !== 1) {
  await p.route('**/engine/stage.js', async (route) => {
    const r = await route.fetch(); let s = await r.text();
    if (NOAA) s = s.replace('antialias: true', 'antialias: false');
    if (SCALE !== 1) s = s.replace('r.setPixelRatio(1)', `r.setPixelRatio(${SCALE})`);
    await route.fulfill({ response: r, body: s });
  });
}
if (LOD) {
  await p.route('**/engine/geometry.js', async (route) => {
    const r = await route.fetch(); let s = await r.text();
    s = s.replace('SphereGeometry(1, 56, 44)', 'SphereGeometry(1, 32, 24)').replace('fixSeam(g, 56, 44)', 'fixSeam(g, 32, 24)')
      .replace('(r, p, s, seg = 24)', '(r, p, s, seg = 14)').replace('(r0, r1, h, seg = 24, open = false)', '(r0, r1, h, seg = 14, open = false)')
      .replace('(pts, seg = 32)', '(pts, seg = 18)').replace('(r0, r1, len, seg = 18)', '(r0, r1, len, seg = 12)').replace('(w, h, d, r = 0.02, seg = 5)', '(w, h, d, r = 0.02, seg = 3)')
      .replace('(pts, r, seg = 24, rseg = 8)', '(pts, r, seg = 14, rseg = 6)');
    await route.fulfill({ response: r, body: s });
  });
}
const cdp = await ctx.newCDPSession(p);
const t0 = performance.now();
await p.goto(`http://127.0.0.1:${PORT}/lab/bulletin-v2/split.html`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.splitReady === true, null, { timeout: 60000 });
const startup = performance.now() - t0;
const el = await p.$('#split');
const clip = { x: 0, y: 0, width: 1280, height: 720, scale: 1 };
if (beginFrame) await cdp.send('HeadlessExperimental.enable').catch(() => {});

const rows = [];
const tAll = performance.now();
for (let f = f0; f < f1; f += step) {
  const a = performance.now();
  const tm = await p.evaluate((t) => window.renderSplit(t), f / FPS);
  const c = performance.now();
  const name = join(out, `f${String(f).padStart(5, '0')}`);
  if (method === 'png-el') await el.screenshot({ path: name + '.png' });
  else if (method === 'pw-jpeg') await p.screenshot({ path: name + '.jpg', type: 'jpeg', quality: 90, clip });
  else if (method === 'cdp-png' || method === 'cdp-jpeg') {
    const fmt = method === 'cdp-png' ? 'png' : 'jpeg';
    const r = await cdp.send('Page.captureScreenshot', { format: fmt, ...(fmt === 'jpeg' ? { quality: 90 } : {}), optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false });
    writeFileSync(name + (fmt === 'png' ? '.png' : '.jpg'), Buffer.from(r.data, 'base64'));
  } else if (beginFrame) {
    const r = await cdp.send('HeadlessExperimental.beginFrame', { screenshot: { format: 'jpeg', quality: 90 } });
    if (!r.screenshotData) throw new Error('beginFrame gave no screenshot at frame ' + f);
    writeFileSync(name + '.jpg', Buffer.from(r.screenshotData, 'base64'));
  } else throw new Error('unknown method ' + method);
  rows.push({ f, left: tm.left, right: tm.right, eval_ms: c - a, shot_ms: performance.now() - c });
}
const wall = performance.now() - tAll;
await b.close();
const q = (k, pp) => { const v = rows.map((r) => r[k]).sort((x, y) => x - y); return +v[Math.min(v.length - 1, Math.floor(pp * v.length))].toFixed(1); };
const res = { method, lod: LOD, noaa: NOAA, scale: SCALE, frames: rows.length, startup_s: +(startup / 1000).toFixed(2), wall_s: +(wall / 1000).toFixed(2),
  ms_per_frame: +(wall / rows.length).toFixed(1), right_p50: q('right', 0.5), shot_p50: q('shot_ms', 0.5), shot_p90: q('shot_ms', 0.9) };
console.log(JSON.stringify(res));
writeFileSync(join(out, 'result.json'), JSON.stringify({ ...res, rows }, null, 1));
