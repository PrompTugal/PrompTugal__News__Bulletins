#!/usr/bin/env node
// render.mjs: exports the showcase to showcase.mp4, frame by frame, as version 1's presenters-video.mjs does.
// No model call. Playwright opens index.html?export=1 in headless Chromium, calls window.renderAt(f / fps) for every
// frame and photographs the #frame element (the canvas and the labels over it). ffmpeg joins the frames and lays
// version 1's voice under the lip-sync passage at the times choreography.json gives.
//
// Run from the repository root:   node src/lab/presenters/v2-claude/render.mjs
// Options: --width 1920 --height 1080 --fps 60 --from 0 --to <end> --out <file.mp4> --frames <dir> --jpeg --fresh --gpu
//   --frames  where the frames are kept. A run that is stopped can be started again: frames already there are skipped.
//   --fresh   delete the frames first.   --jpeg  JPEG frames (quality 95) instead of PNG: smaller and quicker, not lossless.
//   --gpu     use the machine's GPU instead of software WebGL (SwiftShader). Frames are only promised identical on one setup.
// Needs Node 20+, Playwright's Chromium and ffmpeg.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), SRC = resolve(HERE, '..', '..', '..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const W = +arg('width', 1920), H = +arg('height', 1080), FPS = +arg('fps', 60), JPEG = !!arg('jpeg', false), EXT = JPEG ? 'jpg' : 'png';
const chor = JSON.parse(readFileSync(join(HERE, 'choreography.json'), 'utf8'));
const FROM = +arg('from', 0), TO = Math.min(chor.duration, +arg('to', chor.duration));
const OUT = resolve(arg('out', join(HERE, 'showcase.mp4'))), FRAMES = resolve(arg('frames', join(tmpdir(), `presenters-v2-claude-${W}x${H}-${FPS}fps-${EXT}`)));
const LABEL = 'Synthetic presenters and synthetic voice. PrompTugal.news Bulletins lab, presenters version 2 (Claude). Made by code; no real person.';
const require = createRequire(import.meta.url); let pw;
try { pw = require('playwright'); } catch { try { pw = require('/opt/npm-tools/node_modules/playwright'); } catch { throw new Error('Playwright is not installed: npm i playwright && npx playwright install chromium'); } }

if (arg('fresh', false)) rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
const f0 = Math.round(FROM * FPS), f1 = Math.round(TO * FPS), name = (f) => join(FRAMES, `f${String(f).padStart(6, '0')}.${EXT}`);
const PORT = 8799, srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: SRC, stdio: 'ignore' });
const started = Date.now(); let made = 0, skipped = 0;
try {
  await new Promise((r) => setTimeout(r, 800));
  const args = arg('gpu', false) ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await pw.chromium.launch({ args });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'dark' });
  page.on('pageerror', (e) => { console.error('[page error]', e.message); });
  await page.goto(`http://127.0.0.1:${PORT}/lab/presenters/v2-claude/index.html?export=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.showcaseReady === true, null, { timeout: 120000 });
  const frame = await page.$('#frame');
  for (let f = f0; f < f1; f++) {
    const file = name(f);
    if (existsSync(file) && statSync(file).size > 0) { skipped++; continue; }
    await page.evaluate((t) => window.renderAt(t), f / FPS);
    await frame.screenshot(JPEG ? { path: file, type: 'jpeg', quality: 95 } : { path: file });
    made++;
    if (made % 100 === 0) { const el = (Date.now() - started) / 1000, left = (f1 - f - 1) * el / made; console.log(`frame ${f + 1 - f0} of ${f1 - f0}: ${(el / made).toFixed(2)} s a frame, about ${Math.round(left / 60)} min left`); }
  }
  await browser.close();
} finally { srv.kill(); }
const renderSecs = (Date.now() - started) / 1000;

// Sound: each part of the voice is cut out and delayed to its place. An export of part of the showcase (--from, --to)
// keeps only the stretch of each part that falls inside it.
const voiceFile = chor.voice ? resolve(HERE, chor.voice.src) : null;
const voice = chor.voice && { parts: chor.voice.parts.map((p) => { const a = Math.max(p.at, FROM), b = Math.min(p.at + p.to - p.from, TO); return b > a ? { from: p.from + a - p.at, to: p.from + b - p.at, at: a - FROM } : null; }).filter(Boolean) };
const sound = voice && voice.parts.length > 0 && existsSync(voiceFile);
const ff = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(f0), '-i', join(FRAMES, `f%06d.${EXT}`)];
if (sound) {
  ff.push('-i', voiceFile);
  const parts = voice.parts.map((p, i) => `[1:a]atrim=start=${p.from}:end=${p.to},asetpts=PTS-STARTPTS,adelay=${Math.round(p.at * 1000)}:all=1[a${i}]`);
  ff.push('-filter_complex', `${parts.join(';')};${voice.parts.map((p, i) => `[a${i}]`).join('')}amix=inputs=${voice.parts.length}:normalize=0:duration=longest,apad[a]`, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '128k');
}
ff.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-t', String((f1 - f0) / FPS), '-movflags', '+faststart', '-metadata', `comment=${LABEL}`, '-metadata', 'title=Presenters version 2 (Claude): the showcase', OUT);
const e0 = Date.now(); execFileSync('ffmpeg', ff);
const cpu = cpus();
console.log(`showcase: ${OUT} (${((f1 - f0) / FPS).toFixed(1)} s, ${f1 - f0} frames at ${FPS} fps, ${W}x${H}, ${EXT} frames${sound ? ', with the voice' : ', no sound'})`);
console.log(`rendered ${made} frames in ${Math.round(renderSecs)} s (${made ? (renderSecs / made).toFixed(2) : '0'} s a frame), ${skipped} already there; encoded in ${Math.round((Date.now() - e0) / 1000)} s; ${cpu.length} x ${cpu[0] ? cpu[0].model : 'cpu'}; ${arg('gpu', false) ? 'GPU' : 'software WebGL (SwiftShader)'}`);
