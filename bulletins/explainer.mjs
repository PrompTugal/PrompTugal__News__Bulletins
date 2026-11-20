// The explainer video: how the presenters are made, told by the presenters themselves (Dinis, 20 Nov 2026: "write a
// video that actually explains how this is done ... on the right ... the explanation ... and the capabilities that
// they have on the left"). The explanation on the left half, the presenters on the right; each action is shown by all
// twelve presenters while it is explained.
// Words: a fixed script below, written by bulletins.b@ (not data, so not fact-checked; every claim in it is about this
// code). Voice: openai/gpt-audio-mini through OpenRouter, stock voice "alloy", transcript checked word for word.
// Everything else is code: scenes, actions, frames (Playwright), video (ffmpeg).
// Run: node bulletins/explainer.mjs            (voice, then frames; about 0.005 USD)
//      node bulletins/explainer.mjs --reuse    (frames only, from the saved voice; no cost)
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, writeJSON, readJSON } from './core.mjs';
import { LABEL } from './render.mjs';
import { speak, VOICE } from './voice.mjs';

const DIR = join(ROOT, 'src', 'lab', 'presenters'), FPS = 25;
const SPEC = readJSON(join(DIR, 'presenters.json'), {}).presenters.find((p) => p.id === 'rowan');
// The scenes: what is said, what is shown, which actions all presenters perform while it is said.
const SCENES = [
  { title: 'How the presenters are made', lines: ['Drawn by code, from data', 'Nothing filmed, nothing drawn by hand'],
    say: 'This is how PrompTugal dot news makes its synthetic presenters. Everything you see is drawn by code, from data. Nothing is filmed, and nothing is drawn by hand.', demo: 'smile' },
  { title: '1. A presenter is data', code: JSON.stringify({ id: SPEC.id, kind: SPEC.kind, render: SPEC.render, looks: { hair: SPEC.looks.hair, beard: SPEC.looks.beard, outfit: SPEC.looks.outfit, prop: SPEC.looks.prop } }, null, 1),
    say: 'Each presenter is a few lines of data: what kind of figure it is, its hair, its clothes, its props, and a drawing style. Flat, line, hand drawn, shaded, hologram or teletext.' },
  { title: '2. Compiled into parts and a rig', diagram: 1, lines: ['parts: ellipses, rectangles, paths, blocks', 'rig: head pivot, eyes, mouth, pointing arm'],
    say: 'Code compiles that description into shapes and a rig: where the head turns, where the eyes and the mouth are, and which arm can point.' },
  { title: '3. One language of actions', chips: ['speak'], lines: ['speak: the mouth follows the loudness of the voice'],
    say: 'The presenters share one small language of actions. Speak opens the mouth with the loudness of the voice.' },
  { title: 'blink · nod', chips: ['blink', 'nod'], lines: ['blink: the eyes close and open', 'nod: the head dips, on every number'],
    say: 'Blink closes the eyes. Nod dips the head, for example on every number in a bulletin.', demo: 'blinknod' },
  { title: 'look · point', chips: ['look', 'point'], lines: ['look: the eyes turn to the story', 'point: an arm rises towards it'],
    say: 'Look turns the eyes towards the story. Point raises an arm towards it, when a chart appears.', demo: 'lookpoint' },
  { title: 'emote', chips: ['emote'], lines: ['emote: smile, for the opening and the close'],
    say: 'Emote changes the face. Here, every presenter smiles at once.', demo: 'smile' },
  { title: '4. State at time t', diagram: 3, code: '{ mouth: 0.6, blink: 0,\n  nod: 0.3, look: -1,\n  arm: 1, smile: 0.25 }',
    say: 'At any moment, the actions fold into one state, and every presenter knows how to show it. So each frame is a function of time, and the same script always gives the same video.' },
  { title: 'Rendering', lines: ['a browser draws frame t, for every t', 'ffmpeg joins the frames with the voice', 'twelve presenters: about a minute, no GPU', 'paid: only the voice, under one cent'],
    say: 'A browser draws each frame, and a script joins the frames with the voice. Twelve presenters take about a minute. The only paid step is the voice, under one cent.' },
  { title: 'Version 1, and what comes next', lines: ['zoom in on any presenter', 'more detail, more actions', 'an engine for characters'],
    say: 'Because it is all code, we can zoom in on any presenter and give it more detail and more skills, like an engine for characters. This is version one. Made by agents. The voice is synthetic.', demo: 'smile' },
];
const script = SCENES.map((s) => s.say).join(' ');

// The voice: made once, or reused.
let pcm;
const PCM = join(DIR, 'explainer.pcm');
if (process.argv.includes('--reuse') && existsSync(join(DIR, 'explainer.m4a'))) {
  pcm = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', join(DIR, 'explainer.m4a'), '-f', 's16le', '-ac', '1', '-ar', '24000', '-'], { maxBuffer: 64 << 20 });
} else {
  const v = await speak(script, 'explainer voice');
  console.log(`voice: ${(v.pcm.length / 48000).toFixed(1)} s, ${v.cost.toFixed(6)} USD, transcript ${v.same ? 'matches' : 'DOES NOT match'}`);
  if (!v.same) throw new Error('the voice did not read the script word for word: nothing published');
  pcm = v.pcm; writeFileSync(PCM, pcm);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', PCM, '-c:a', 'aac', '-b:a', '96k', join(DIR, 'explainer.m4a')]);
  rmSync(PCM);
}

// Loudness per frame, scene and word timings by share of words, and the scripted actions.
const per = 24000 / FPS, n = Math.floor(pcm.length / 2 / per), amp = [];
for (let f = 0; f < n; f++) { let s = 0; for (let i = 0; i < per; i++) { const x = pcm.readInt16LE((f * per + i) * 2) / 32768; s += x * x; } amp.push(Math.sqrt(s / per)); }
const peak = Math.max(...amp) || 1, duration = n / FPS;
const total = SCENES.reduce((a, s) => a + s.say.split(/\s+/).length, 0);
let t0 = 0; const actions = [];
const segs = SCENES.map((s, i) => {
  const words = s.say.split(/\s+/), len = duration * words.length / total, start = t0; t0 += len;
  const chars = words.reduce((a, w) => a + w.length + 1, 0); let c = 0;
  const wt = words.map((w) => { const at = start + (len - 0.2) * c / chars; c += w.length + 1; return { w, start: +at.toFixed(3) }; });
  actions.push({ t: start, dur: len, do: 'speak' });
  if (s.demo === 'smile') actions.push({ t: start, dur: len, do: 'emote', mood: 'smile' });
  if (s.demo === 'blinknod') for (let k = start + 0.3; k < start + len - 0.3; k += 0.7) { actions.push({ t: k, dur: 0.18, do: 'blink' }); if (Math.round((k - start) / 0.7) % 2) actions.push({ t: k, dur: 0.45, do: 'nod', amount: 1.4 }); }
  if (s.demo === 'lookpoint') { actions.push({ t: start, dur: 0.6, do: 'look', dir: 'content' }); actions.push({ t: start + 0.4, dur: len / 2 - 0.4, do: 'point', dir: 'content' }); actions.push({ t: start + len / 2 + 0.2, dur: len / 2 - 0.4, do: 'point', dir: 'content' }); actions.push({ t: start + len - 0.2, dur: 0.6, do: 'look', dir: 'camera' }); }
  return { kind: 'scene', start: +start.toFixed(3), end: +(start + len).toFixed(3), words: wt, ...s };
});
for (let k = 1.1; k < duration; k += 2.9) if (!segs.some((s) => s.demo === 'blinknod' && k >= s.start && k < s.end)) actions.push({ t: +k.toFixed(2), dur: 0.16, do: 'blink' });
actions.sort((a, b) => a.t - b.t);
writeJSON(join(DIR, 'explainer.json'), { about: 'The explainer\'s timeline: scenes, word timings, the voice\'s loudness per frame and the scripted actions.', label: LABEL,
  voice: VOICE, duration: +duration.toFixed(3), fps: FPS, segs, actions, amp: amp.map((a) => +Math.min(1, a / peak * 1.4).toFixed(3)) });

// Frames and video.
const srv = spawn('python3', ['-m', 'http.server', '8797', '--bind', '127.0.0.1'], { cwd: join(ROOT, 'src'), stdio: 'ignore' });
const tmp = mkdtempSync(join(tmpdir(), 'explain-'));
try {
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = createRequire(import.meta.url)('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
  await p.goto('http://127.0.0.1:8797/lab/presenters/explain.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.explainReady === true, null, { timeout: 15000 });
  const stage = await p.$('#split');
  for (let f = 0; f < n; f++) { await p.evaluate((t) => window.renderExplain(t), f / FPS); await stage.screenshot({ path: join(tmp, `f${String(f).padStart(5, '0')}.png`) }); }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%05d.png'), '-i', join(DIR, 'explainer.m4a'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24',
    '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-metadata', `comment=${LABEL}. Synthetic presenters and synthetic voice.`, join(DIR, 'explainer.mp4')]);
} finally { srv.kill(); rmSync(tmp, { recursive: true, force: true }); }
console.log(`explainer: src/lab/presenters/explainer.mp4 (${duration.toFixed(1)} s, ${n} frames)`);
