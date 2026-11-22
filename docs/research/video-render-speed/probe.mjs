import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = (process.env.CHROME_ARGS || '').split(' ').filter(Boolean);
const b = await chromium.launch({ args, headless: !process.env.HEADED });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const cdp = await p.context().newCDPSession(p);
const url = process.env.URL || 'http://127.0.0.1:8797/lab/bulletin-v2/split.html';
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.splitReady === true || window.castReady === true || window.stageReady === true, null, { timeout: 60000 });
const shot = async () => { const a = performance.now(); await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true }); return performance.now() - a; };
const raf = async () => { const a = performance.now(); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); return performance.now() - a; };
const med = (v) => v.sort((x, y) => x - y)[Math.floor(v.length / 2)].toFixed(0);
const R = (t) => p.evaluate((t) => (window.renderSplit || window.renderAt)(t), t);
let s1 = [], s2 = [], s3 = [];
for (let i = 0; i < 8; i++) s1.push(await shot());                 // no change between shots
for (let i = 0; i < 8; i++) { await R(5 + i / 30); s2.push(await shot()); }
for (let i = 0; i < 8; i++) { await R(9 + i / 30); s3.push(await raf()); }
console.log(JSON.stringify({ url: url.split('/').pop(), args: args.join(' '), shot_nochange: med(s1), shot_after_render: med(s2), two_rafs_after_render: med(s3),
  gl: await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; }) }));
await b.close();
