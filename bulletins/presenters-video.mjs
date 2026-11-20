// The side-by-side video of every presenter (Dinis, 20 Nov 2026: "create a video that basically shows them side by
// side"). No model call: src/lab/presenters/wall.html draws every presenter in src/lab/presenters/presenters.json,
// driven by the checked voice and timeline from bulletins/video.mjs and video2.mjs; Playwright steps t frame by frame
// (window.renderAt) and ffmpeg joins the frames with the voice. Run: node bulletins/presenters-video.mjs [wall|split]
// split: the animated bulletin (src/lab/video/stage.html?layout=half) on the left half, the presenters on the right.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, readJSON } from './core.mjs';
import { LABEL } from './render.mjs';

const TL = readJSON(join(ROOT, 'src', 'lab', 'video', 'timeline.json'), null);
if (!TL) throw new Error('no timeline: run bulletins/video2.mjs first');
const MODE = process.argv[2] === 'split' ? 'split' : 'wall';
const PAGE = MODE === 'split' ? { file: 'split.html', ready: 'splitReady', render: 'renderSplit', el: '#split', out: 'presenters-split.mp4' } : { file: 'wall.html', ready: 'galleryReady', render: 'renderAt', el: '#stage', out: 'presenters.mp4' };
const n = Math.floor(TL.duration * TL.fps), out = join(ROOT, 'src', 'lab', 'presenters', PAGE.out);
const srv = spawn('python3', ['-m', 'http.server', '8798', '--bind', '127.0.0.1'], { cwd: join(ROOT, 'src'), stdio: 'ignore' });
const tmp = mkdtempSync(join(tmpdir(), 'wall-'));
try {
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = createRequire(import.meta.url)('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
  await p.goto(`http://127.0.0.1:8798/lab/presenters/${PAGE.file}`, { waitUntil: 'networkidle' });
  await p.waitForFunction((k) => window[k] === true, PAGE.ready, { timeout: 15000 });
  const stage = await p.$(PAGE.el);
  for (let f = 0; f < n; f++) { await p.evaluate(([k, t]) => window[k](t), [PAGE.render, f / TL.fps]); await stage.screenshot({ path: join(tmp, `f${String(f).padStart(5, '0')}.png`) }); }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(TL.fps), '-i', join(tmp, 'f%05d.png'), '-i', join(ROOT, 'src', 'lab', 'video', '200.m4a'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-metadata', `comment=${LABEL}. Synthetic presenters and synthetic voice.`, out]);
} finally { srv.kill(); rmSync(tmp, { recursive: true, force: true }); }
console.log(`presenters: ${out.replace(ROOT + '/', '')} (${TL.duration.toFixed(1)} s, ${n} frames)`);
