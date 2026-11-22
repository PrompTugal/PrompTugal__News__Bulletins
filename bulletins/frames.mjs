// Frame rendering for the lab's videos, shared by bulletin-v2.mjs and explainer-v2.mjs (bulletins.d@PrompTugal.dinis,
// 22 Nov 2026). Dinis, 22 Nov, about 02:40 UTC: "Yes, adopt that LLVM pipe". The study behind it is in
// docs/research/video-render-speed/ (396 s to 127.5 s for the 21 Nov bulletin, no visible change).
//
// How: with no GPU, Chromium draws WebGL in software. Its own renderer (SwiftShader) is the slow part of every frame.
// Mesa's llvmpipe, a multi-threaded software OpenGL, draws the same scene about 2.7 times faster, but Chromium only
// uses it with a display. So this module starts its own virtual display (Xvfb), runs headed Chromium on it with
// ANGLE on OpenGL, and checks in the page that WebGL really is llvmpipe. If Xvfb or Mesa is missing, or the page
// reports another renderer, it falls back to headless SwiftShader and says so in the stats.
// Frames are split into one contiguous range per browser (as many browsers as CPUs) and captured with the
// Chrome DevTools screenshot (PNG), then ffmpeg joins them. Every frame is a function of t, so the split does not
// change the picture.
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const MESA = ['/usr/lib/x86_64-linux-gnu/dri/swrast_dri.so', '/usr/lib/x86_64-linux-gnu/dri/kms_swrast_dri.so', '/usr/lib/dri/swrast_dri.so'];
const LLVMPIPE_ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
const onPath = (bin) => (process.env.PATH || '').split(':').some((d) => d && existsSync(join(d, bin)));

// Start Xvfb on a free display number; resolves to { display, stop } or null when it cannot start.
async function startXvfb(w, h) {
  if (!onPath('Xvfb')) return null;
  for (let n = 90; n < 110; n++) {
    if (existsSync(`/tmp/.X11-unix/X${n}`) || existsSync(`/tmp/.X${n}-lock`)) continue;
    const p = spawn('Xvfb', [`:${n}`, '-screen', '0', `${w}x${h}x24`, '-nolisten', 'tcp'], { stdio: 'ignore' });
    const ok = await new Promise((res) => {
      const t0 = Date.now();
      (function wait() { if (p.exitCode !== null) return res(false); if (existsSync(`/tmp/.X11-unix/X${n}`)) return res(true); if (Date.now() - t0 > 5000) return res(false); setTimeout(wait, 50); })();
    });
    if (ok) return { display: `:${n}`, stop: () => p.kill() };
    p.kill();
  }
  return null;
}

/* opts: url (the page), n (frames), fps, out (directory for f00000.png ...), ready (a page function that is true when
 * the page can draw), draw (a page function (t) => timings), viewport {width, height}, workers, renderer
 * ('auto' | 'llvmpipe' | 'swiftshader'), colorScheme. Returns the render stats. */
export async function renderFrames(opts) {
  const { url, n, fps, out, ready, draw, viewport = { width: 1280, height: 720 }, colorScheme = 'dark' } = opts;
  const workers = Math.max(1, Math.min(opts.workers || cpus().length, n));
  const want = opts.renderer || 'auto';
  const { chromium } = createRequire(import.meta.url)('playwright');
  let x = null;
  if (want !== 'swiftshader' && MESA.some(existsSync)) x = await startXvfb(Math.max(1920, viewport.width), Math.max(1080, viewport.height));
  if (want === 'llvmpipe' && !x) throw new Error('llvmpipe asked for, but Xvfb or Mesa is not available');
  const launch = () => x ? chromium.launch({ headless: false, args: LLVMPIPE_ARGS, env: { ...process.env, DISPLAY: x.display } }) : chromium.launch();
  const rows = [], starts = [];
  let gl = null, fellBack = null;
  const t0 = performance.now();
  try {
    // One browser first, to check the renderer before starting the others.
    const probe = await launch();
    gl = await (await probe.newPage()).evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; });
    await probe.close();
    if (x && !/llvmpipe/i.test(gl)) {
      if (want === 'llvmpipe') throw new Error(`llvmpipe asked for, but WebGL reports ${gl}`);
      fellBack = `WebGL reported "${gl}" on Xvfb`; x.stop(); x = null; gl = null;
    }
    const per = Math.ceil(n / workers);
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const b = await launch(); const ts = performance.now();
      const ctx = await b.newContext({ viewport, colorScheme }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
      await p.goto(url, { waitUntil: 'networkidle' });
      await p.waitForFunction(ready, null, { timeout: 120000 });
      if (!gl) gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; });
      starts.push({ worker: w, startup_s: +((performance.now() - ts) / 1000).toFixed(2), chromium: b.version() });
      for (let f = w * per; f < Math.min(n, (w + 1) * per); f++) {
        const a = performance.now(); const tm = await p.evaluate(draw, f / fps); const c = performance.now();
        const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 } });
        writeFileSync(join(out, `f${String(f).padStart(5, '0')}.png`), Buffer.from(r.data, 'base64'));
        rows.push({ f, draw_ms: +(c - a).toFixed(1), shot_ms: +(performance.now() - c).toFixed(1), ...(tm && typeof tm === 'object' ? tm : {}) });
      }
      await b.close();
    }));
  } finally { if (x) x.stop(); }
  const wall = (performance.now() - t0) / 1000;
  const dist = (k) => { const v = rows.map((r) => r[k]).filter((z) => typeof z === 'number').sort((a, b) => a - b); if (!v.length) return null; const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]; return { min: v[0], p50: q(0.5), p90: q(0.9), p99: q(0.99), max: v[v.length - 1], mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) }; };
  return {
    frames: n, fps, size: `${viewport.width}x${viewport.height}`, workers, wall_s: +wall.toFixed(2), ms_per_frame: +(wall * 1000 / n).toFixed(1),
    renderer: x || /llvmpipe/i.test(gl || '') ? 'llvmpipe (Mesa, OpenGL through ANGLE, headed Chromium on Xvfb)' : 'SwiftShader (Chromium\'s own, headless)',
    webgl: gl, fell_back: fellBack, capture: 'Chrome DevTools Page.captureScreenshot, PNG',
    chromium: starts[0]?.chromium, browser_startup_s: starts.sort((a, b) => a.worker - b.worker).map((s) => s.startup_s),
    draw_ms: dist('draw_ms'), screenshot_ms: dist('shot_ms'), rows,
  };
}
