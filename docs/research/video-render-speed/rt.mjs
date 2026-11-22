// Real-time playback + screen recording. Run inside xvfb-run with a 1280x720 screen.
// RECORD=x11|none  CHROME_ARGS=...  DUR=seconds  OUT=file.mp4
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const extra = (process.env.CHROME_ARGS || '').split(' ').filter(Boolean);
const DUR = +(process.env.DUR || 10), REC = process.env.RECORD || 'none', OUT = process.env.OUT || 'rt.mp4';
const b = await chromium.launch({ headless: false, args: ['--kiosk', '--window-position=0,0', '--window-size=1280,720', ...extra] });
const ctx = await b.newContext({ viewport: null }); const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8797/lab/bulletin-v2/split.html', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.splitReady === true, null, { timeout: 60000 });
const inner = await p.evaluate(() => [innerWidth, innerHeight]);
let ff;
if (REC === 'x11') ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'x11grab', '-framerate', '30', '-video_size', '1280x720', '-i', process.env.DISPLAY + '+0,0', '-t', String(DUR), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p', OUT], { stdio: 'inherit' });
const r = await p.evaluate((D) => new Promise((res) => {
  const s = performance.now(); let n = 0, gaps = [], last = s;
  (function loop(now) { const t = (now - s) / 1000; if (t > D) return res({ frames: n, fps: +(n / D).toFixed(1), worst_gap_ms: Math.max(...gaps).toFixed(0) });
    window.renderSplit(t); n++; gaps.push(now - last); last = now; requestAnimationFrame(loop); })(s);
}), DUR);
if (ff) await new Promise((res) => ff.on('exit', res));
console.log(JSON.stringify({ record: REC, gl: extra.join(' ') || 'swiftshader', window: inner, ...r }));
await b.close();
