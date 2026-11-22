// Full render of the 939 frames with N browsers, then encode. node full.mjs <workers> <outdir> [--lod] [--fmt png|jpeg]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
const { chromium } = createRequire(import.meta.url)('playwright');
const [W, out] = [+process.argv[2], process.argv[3]];
const LOD = process.argv.includes('--lod'), FMT = process.argv.includes('jpeg') ? 'jpeg' : 'png';
const extra = (process.env.CHROME_ARGS || '').split(' ').filter(Boolean);
const N = 939, FPS = 30; rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const t0 = performance.now();
await Promise.all(Array.from({ length: W }, async (_, w) => {
  const b = await chromium.launch({ headless: !process.env.HEADED, args: extra });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' }); const p = await ctx.newPage();
  if (LOD) await p.route('**/engine/geometry.js', async (route) => { const r = await route.fetch(); let s = await r.text();
    s = s.replace('SphereGeometry(1, 56, 44)', 'SphereGeometry(1, 32, 24)').replace('fixSeam(g, 56, 44)', 'fixSeam(g, 32, 24)').replace('(r, p, s, seg = 24)', '(r, p, s, seg = 14)').replace('(r0, r1, h, seg = 24, open = false)', '(r0, r1, h, seg = 14, open = false)').replace('(pts, seg = 32)', '(pts, seg = 18)').replace('(r0, r1, len, seg = 18)', '(r0, r1, len, seg = 12)').replace('(w, h, d, r = 0.02, seg = 5)', '(w, h, d, r = 0.02, seg = 3)').replace('(pts, r, seg = 24, rseg = 8)', '(pts, r, seg = 14, rseg = 6)');
    await route.fulfill({ response: r, body: s }); });
  const cdp = await ctx.newCDPSession(p);
  await p.goto('http://127.0.0.1:8797/lab/bulletin-v2/split.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.splitReady === true, null, { timeout: 60000 });
  const per = Math.ceil(N / W);
  for (let f = w * per; f < Math.min(N, (w + 1) * per); f++) {
    await p.evaluate((t) => window.renderSplit(t), f / FPS);
    const r = await cdp.send('Page.captureScreenshot', { format: FMT, ...(FMT === 'jpeg' ? { quality: 92 } : {}), optimizeForSpeed: true });
    writeFileSync(join(out, `f${String(f).padStart(5, '0')}.${FMT === 'png' ? 'png' : 'jpg'}`), Buffer.from(r.data, 'base64'));
  }
  await b.close();
}));
const render_s = (performance.now() - t0) / 1000;
const t1 = performance.now();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(out, `f%05d.${FMT === 'png' ? 'png' : 'jpg'}`), '-i', new URL('../../../src/lab/bulletin-v2/voice-2026-11-21.m4a', import.meta.url).pathname,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out + '.mp4']);
const enc_s = (performance.now() - t1) / 1000;
console.log(JSON.stringify({ workers: W, gl: extra.length ? 'llvmpipe' : 'swiftshader', lod: LOD, fmt: FMT, render_s: +render_s.toFixed(1), encode_s: +enc_s.toFixed(1), total_s: +(render_s + enc_s).toFixed(1), ms_per_frame: +(render_s * 1000 / N).toFixed(0), x_realtime: +((render_s + enc_s) / 31.3).toFixed(1) }));
