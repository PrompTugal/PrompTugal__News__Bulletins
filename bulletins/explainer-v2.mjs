// "How this video is made": an explainer video about the lab's video pipeline, rendered by that pipeline
// (bulletins.d@PrompTugal.dinis, 22 Nov 2026). Dinis, 22 Nov, about 02:40 UTC: "create a video that explains how you
// are using LLVM pipe and actually how this architecture actually works ... use the video to explain how this video
// is actually built using this tech stack. And again, capture the performance of it."
// Words: the fixed script below, written by bulletins.d@. Every claim is about this code or about the measurements in
// docs/research/video-render-speed/ (22 Nov 2026); numbers are spoken in words and shown in figures on the slides.
// Voice: bulletins/voice.mjs (openai/gpt-audio-mini, stock voice "alloy"), one take per scene, each transcript
// checked word for word (up to three takes a scene, or nothing is published).
// Frames: split.html (slides left, the twelve version 2 presenters right) by bulletins/frames.mjs (llvmpipe on Xvfb,
// else SwiftShader); ffmpeg joins frames and voice. Every phase and every frame is timed into stats.json.
// Run: node bulletins/explainer-v2.mjs [--reuse] [--workers <CPUs>] [--fps 30] [--renderer auto|llvmpipe|swiftshader]
//      node bulletins/explainer-v2.mjs --page-only   (the page from the last render's stats; no cost)
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir, cpus, totalmem, platform, release } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ROOT, readJSON, writeJSON, esc } from './core.mjs';
import { LABEL } from './render.mjs';
import { speak, VOICE } from './voice.mjs';
import { renderFrames } from './frames.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PAGE_ONLY = process.argv.includes('--page-only'), REUSE = process.argv.includes('--reuse'), WORKERS = +arg('--workers', cpus().length), FPS = +arg('--fps', 30), RENDERER = arg('--renderer', 'auto');
const DIR = join(ROOT, 'src', 'lab', 'explainer-v2'), GAP = 0.45, RATE = 24000;
const stats = { started: new Date().toISOString(), machine: { cpus: cpus().length, cpu: cpus()[0]?.model, mem_gb: +(totalmem() / 2 ** 30).toFixed(1), os: `${platform()} ${release()}`, node: process.version, gpu: 'none' }, phases: [] };
async function phase(name, fn) {
  const c0 = process.cpuUsage(), t0 = performance.now();
  const out = await fn();
  const c = process.cpuUsage(c0);
  stats.phases.push({ name, wall_s: +((performance.now() - t0) / 1000).toFixed(3), node_cpu_s: +((c.user + c.system) / 1e6).toFixed(3) });
  console.log(`${name}: ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  return out;
}

// The measurements the slides show, each with its source (docs/research/video-render-speed/README.md, 22 Nov 2026).
const NUMBERS = {
  shot_nochange_ms: 33, shot_swiftshader_ms: 638, shot_llvmpipe_ms: 233, triangles: 645000, draw_calls: 650,
  full_runs: [{ label: 'SwiftShader, 3 browsers', s: 396 }, { label: 'SwiftShader, 4 browsers', s: 306.5 }, { label: 'llvmpipe, 1 browser', s: 236.6 },
    { label: 'llvmpipe, 2 browsers', s: 155.6 }, { label: 'llvmpipe, 4 browsers', s: 127.5 }],
  ssim: 0.986, live_fps_swiftshader: 1.9, live_fps_llvmpipe: 5.6, rec_frames: 300, rec_distinct: 51,
  source: 'Measured by bulletins.d@PrompTugal.dinis on 22 Nov 2026 (4 CPUs, no GPU): docs/research/video-render-speed/; 396 s from src/lab/bulletin-v2/stats-2026-11-21.json.',
};

// The scenes: who speaks, what the slide shows (slides.js), what is said.
const SCENES = [
  { kind: 'open', who: 'anchor', title: 'How this video is made',
    say: 'This is how this video was made. Every frame you are watching was drawn by code, in a web browser, on a computer with no graphics card.' },
  { kind: 'pipeline', who: 'guide', title: 'From data to video',
    say: 'It starts from a script. A synthetic voice reads it, and the loudness of the voice gives the shape of each mouth. A timeline then says who speaks, when, and where the camera looks.' },
  { kind: 'page', who: 'holo', title: 'One page, two halves',
    say: 'Each frame is one web page with two halves. These slides on the left are drawn with ordinary web pages. The twelve presenters on the right are drawn in three dimensions by the browser.' },
  { kind: 'pure', who: 'researcher', title: 'Every frame is a function of time',
    say: 'Every frame is a pure function of time. Give the page a moment, and it draws exactly that moment. So the frames can be drawn in any order, by several browsers at once.' },
  { kind: 'bottleneck', who: 'realist', title: 'Where the time went',
    say: 'With no graphics card, the browser draws the three dimensional half in software. Each frame has about six hundred and fifty thousand triangles. With the browser\'s own software renderer, one frame took about two thirds of a second.' },
  { kind: 'stack', who: 'rowan', title: 'The fix: a faster software renderer',
    say: 'So we swapped the renderer for Mesa\'s faster software driver, which uses every processor core. The browser only uses it when it has a screen, so we give it a virtual screen, and draw there.' },
  { kind: 'parallel', who: 'conductor', title: 'Four browsers, one video',
    say: 'Four browsers share the frames, one for each processor core. Each takes a picture of every frame it draws, and a video tool joins the pictures and the voice.' },
  { kind: 'results', who: 'anchor', title: 'Three times faster',
    say: 'The bulletin of twenty one November took three hundred and ninety six seconds to make. Now it takes about one hundred and twenty eight seconds, three times faster, and the picture looks the same.' },
  { kind: 'realtime', who: 'guide', title: 'Why not record the screen?',
    say: 'We also tried recording the screen while the video plays. With no graphics card, the page draws only five or six frames a second, so the recording jumps. Drawing frame by frame wins.' },
  { kind: 'determinism', who: 'holo', title: 'A bug found on the way',
    say: 'On the way, we found a small bug. Swinging parts, like an antenna or a key, kept their last angle, so a frame depended on the frames before it. Now every frame starts from rest, and a test checks it.' },
  { kind: 'close', who: 'anchor', title: 'Made the same way',
    say: 'This video was made the same way, and its own render times are on the page below it. Made by agents from PrompTugal dot news. The voices and the presenters are synthetic.' },
];
const script = SCENES.map((s) => s.say).join(' ');
// --page-only: rebuild index.html from the last render's stats.json and script.json, without voice or frames.
if (PAGE_ONLY) { const sj = readJSON(join(DIR, 'script.json'), {}); SCENES.forEach((s, i) => { s.start = sj.scenes[i].start; s.end = sj.scenes[i].end; }); writePage(readJSON(join(DIR, 'stats.json'), {})); console.log('page written'); process.exit(0); }

// 1. The voice: one take per scene, joined with a short gap.
const M4A = join(DIR, 'voice.m4a'), TAKES = join(DIR, 'voice-takes.json');
const pcm = await phase('voice (OpenRouter, one take per scene)', async () => {
  if (REUSE && existsSync(M4A) && existsSync(TAKES)) {
    const t = readJSON(TAKES, {}); SCENES.forEach((s, i) => { s.samples = t.scenes[i].samples; });
    stats.voice = { ...t.stats, reused: true };
    return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', M4A, '-f', 's16le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 256 << 20 });
  }
  const parts = [], gap = Buffer.alloc(Math.round(GAP * RATE) * 2), log = [];
  let cost = 0, takes = 0; const t0 = performance.now();
  for (const [i, s] of SCENES.entries()) {
    let v = null;
    for (let k = 1; k <= 3 && !(v && v.same); k++) { v = await speak(s.say, `explainer v2 voice, scene ${i + 1}, take ${k}`); cost += v.cost; takes++; if (!v.same) console.log(`scene ${i + 1} take ${k}: transcript differs: ${v.transcript}`); }
    if (!v.same) throw new Error(`scene ${i + 1}: the voice did not read the script word for word in three takes: nothing published`);
    s.samples = v.pcm.length / 2; parts.push(v.pcm, gap); log.push({ scene: i + 1, transcript: v.transcript.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() });
  }
  const all = Buffer.concat(parts);
  stats.voice = { model: VOICE.model, voice: VOICE.voice, takes, scenes: SCENES.length, cost_usd: +cost.toFixed(6), latency_s: +((performance.now() - t0) / 1000).toFixed(2), transcript_matches: true, words: script.split(/\s+/).length };
  const tmp = join(tmpdir(), `expl2-${process.pid}.pcm`); writeFileSync(tmp, all);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', tmp, '-c:a', 'aac', '-b:a', '96k', M4A]); rmSync(tmp);
  writeJSON(TAKES, { about: 'The voice takes of the explainer, one per scene, each checked word for word. Transcripts are kept in the form compared (lower case, punctuation removed). Written by bulletins/explainer-v2.mjs.', stats: stats.voice, scenes: SCENES.map((s, i) => ({ samples: s.samples, transcript_as_compared: log[i].transcript })) });
  return all;
});

// 2. Timings from the takes, loudness, mouth shapes (as in bulletin-v2.mjs: an approximation, not phonemes).
const { duration, n, mouthCues } = await phase('timeline, loudness, mouth shapes', () => {
  let t = 0;
  for (const s of SCENES) { s.start = +t.toFixed(3); t += s.samples / RATE; s.end = +t.toFixed(3); t += GAP; }
  const per = RATE / FPS, n = Math.floor(pcm.length / 2 / per), amp = [];
  for (let f = 0; f < n; f++) { let q = 0; for (let i = 0; i < per; i++) { const x = pcm.readInt16LE((f * per + i) * 2) / 32768; q += x * x; } amp.push(Math.sqrt(q / per)); }
  const peak = Math.max(...amp) || 1; for (let i = 0; i < n; i++) amp[i] = Math.min(1, amp[i] / peak * 1.4);
  const mouthCues = [];
  for (let f = 0; f < n; f++) {
    const a = amp[f], v = a < 0.07 ? 'X' : a < 0.22 ? (f % 6 < 3 ? 'B' : 'F') : a < 0.45 ? (f % 4 < 2 ? 'C' : 'E') : (f % 4 < 2 ? 'D' : 'C');
    const last = mouthCues[mouthCues.length - 1], tt = +(f / FPS).toFixed(3);
    if (last && last.value === v) last.end = +((f + 1) / FPS).toFixed(3); else mouthCues.push({ start: tt, end: +((f + 1) / FPS).toFixed(3), value: v });
  }
  return { duration: n / FPS, n, mouthCues };
});

// 3. The slides' data.
writeJSON(join(DIR, 'script.json'), { about: 'The scenes and numbers of "How this video is made", read by slides.js. Written by bulletins/explainer-v2.mjs.',
  label: `${LABEL} · Voice and presenters: synthetic`, duration: +duration.toFixed(3), fps: FPS, numbers: NUMBERS,
  scenes: SCENES.map((s) => ({ kind: s.kind, who: s.who, title: s.title, say: s.say, start: s.start, end: s.end })) });

// 4. The cast's direction: the speaker speaks, the others look at it, the camera visits it; each scene has its own business.
const SLOTS = { teletext: [-3.3, -2.2], guide: [-2.0, -2.2], holo: [-0.8, -2.2], anchor: [0.4, -2.2], realist: [1.6, -2.2], rowan: [2.8, -2.2],
  agent: [-2.7, 0.1], conductor: [-1.6, 0.1], owl: [-0.5, 0.1], researcher: [0.6, 0.1], caretaker: [1.7, 0.1], cube: [2.35, 0.7] };
const ALL = Object.keys(SLOTS), BACK = ['teletext', 'guide', 'holo', 'anchor', 'realist', 'rowan'], BOTS = ['agent', 'conductor', 'researcher', 'caretaker'];
const head = (id) => [SLOTS[id][0], BACK.includes(id) ? 2.2 : 1.5, SLOTS[id][1]];
const WIDE = { pos: [0, 2.35, 10.6], look: [0, 1.15, -0.9], fov: 36 };
const others = (id) => ALL.filter((x) => x !== id);
const cues = [], camera = [{ t: 0, pos: [0, 3.2, 14], look: [0, 1.1, -0.9], fov: 36 }, { t: 2.5, ...WIDE, ease: 'inOut' }], beats = [], speakers = [];
const BUSINESS = {
  open: (s) => [{ t: 0, who: 'guide', do: 'sketchOn' }, { t: 0.2, who: 'front', do: 'wave', stagger: 0.12 }, { t: s.start + 0.5, who: 'holo', do: 'scanSweep' }, { t: s.start + 0.6, who: 'anchor', do: 'expression', name: 'smile', dur: s.end - s.start }],
  pipeline: (s) => [{ t: s.start + 0.3, who: 'guide', do: 'present', dur: 2.2 }, { t: s.start + 1.2, who: 'teletext', do: 'pageFlip' }, { t: s.start + 2, who: 'researcher', do: 'magnify' }],
  page: (s) => [{ t: s.start + 0.3, who: 'holo', do: 'present', dur: 2.4 }, { t: s.end - 1.5, who: 'holo', do: 'glitch' }, { t: s.start + 1.5, who: 'cube', do: 'bounce', times: 2 }],
  pure: (s) => [{ t: s.start + 0.4, who: 'researcher', do: 'magnify' }, { t: s.start + 1.0, who: 'conductor', do: 'clockSpin', turns: 2 }, { t: s.start + 2.2, who: ['guide', 'anchor'], do: 'think', stagger: 0.2 }],
  bottleneck: (s) => [{ t: s.start + 0.3, who: 'realist', do: 'openPalms', dur: 2 }, { t: s.start + 1.6, who: BOTS, do: 'flinch', stagger: 0.07 }, { t: s.start + 1.6, who: others('realist'), do: 'expression', name: 'concerned', dur: s.end - s.start - 1.8, stagger: 0.03 }],
  stack: (s) => [{ t: s.start + 0.3, who: 'rowan', do: 'holdUp', dur: 2.4 }, { t: s.start + 1.4, who: 'agent', do: 'antennaSpark' }, { t: s.end - 2.0, who: ['conductor', 'researcher'], do: 'thumbsUp', stagger: 0.15 }],
  parallel: (s) => [{ t: s.start + 0.3, who: 'conductor', do: 'clockSpin', turns: 3 }, { t: s.start + 1.0, who: BOTS, do: 'nod', stagger: 0.12 }, { t: s.start + 2.4, who: 'caretaker', do: 'keyJingle' }],
  results: (s) => [{ t: s.start + 0.4, who: 'anchor', do: 'present', dur: 2.2 }, { t: s.end - 2.6, who: ALL, do: 'expression', name: 'delighted', dur: 2.4, stagger: 0.02 }, { t: s.end - 2.4, who: BOTS.concat(['owl', 'cube']), do: 'celebrate', stagger: 0.08 }],
  realtime: (s) => [{ t: s.start + 0.4, who: 'owl', do: 'headTurn270' }, { t: s.start + 1.6, who: ['agent', 'anchor', 'rowan'], do: 'shrug', stagger: 0.1 }, { t: s.end - 1.6, who: 'cube', do: 'hop', height: 0.3 }],
  determinism: (s) => [{ t: s.start + 0.5, who: 'caretaker', do: 'keyJingle' }, { t: s.start + 1.3, who: 'agent', do: 'antennaSpark' }, { t: s.start + 2.0, who: 'owl', do: 'wingFlap', times: 3 }, { t: s.end - 1.8, who: 'researcher', do: 'thumbsUp' }],
  close: (s) => [{ t: s.start + 0.2, who: ALL, do: 'expression', name: 'delighted', dur: s.end - s.start, stagger: 0.02 }, { t: s.start + 0.4, who: BACK.filter((h) => h !== 'anchor'), do: 'wave', stagger: 0.1 }, { t: Math.max(s.start + 1, s.end - 2.3), who: 'anchor', do: 'bow' }],
};
const ORBIT = [-14, 18, -8, 12, -16, 16, -10, 8, -12, 14, 0];
SCENES.forEach((s, i) => {
  const len = s.end - s.start;
  speakers.push({ who: s.who, from: s.start, to: s.end + GAP });
  beats.push({ t: s.start, title: s.title });
  cues.push({ t: s.start, who: ALL, do: 'speak', track: 'voice', offset: s.start, dur: +len.toFixed(3) });   // all twelve mouths follow the voice (Dinis, 22 Nov)
  cues.push({ t: s.start + 0.1, who: others(s.who), do: 'lookAt', target: head(s.who), dur: Math.min(2.4, len - 0.2), stagger: 0.03 });
  cues.push(...BUSINESS[s.kind](s));
  if (i > 0 && s.kind !== 'close') { camera.push({ t: s.start, focus: s.who, cut: true, dist: 6.0, h: 0.55, lh: 0.4, orbit: ORBIT[i] }); camera.push({ t: s.start + len * 0.55, ...WIDE, ease: 'inOut' }); }
  if (s.kind === 'close') camera.push({ t: s.start, ...WIDE, cut: true });
});
cues.sort((a, b) => a.t - b.t);
writeJSON(join(DIR, 'cast.json'), { about: 'Direction of the twelve version 2 presenters for "How this video is made": who speaks each scene, how the others react, and the camera. Written by bulletins/explainer-v2.mjs.',
  slots: SLOTS, speakers, tracks: { voice: { duration: +duration.toFixed(3), mouthCues, note: 'From the voice\'s loudness, not Rhubarb: an approximation of lip-sync.' } },
  chor: { version: '2.0.0-explainer', duration: +duration.toFixed(3), fps: FPS, auto: { idle: true, blink: true, fidget: false }, groups: { front: ['agent', 'conductor', 'owl', 'researcher', 'caretaker', 'cube'], all: ALL }, beats, camera, cues } });

// 5. Render and encode.
const PORT = 8798;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: join(ROOT, 'src'), stdio: 'ignore' });
const tmp = mkdtempSync(join(tmpdir(), 'explainer2-'));
const OUT = join(DIR, 'how-this-video-is-made.mp4');
try {
  await new Promise((r) => setTimeout(r, 900));
  const r = await phase(`render ${n} frames`, () => renderFrames({ url: `http://127.0.0.1:${PORT}/lab/explainer-v2/split.html`, n, fps: FPS, out: tmp,
    ready: () => window.splitReady === true, draw: (t) => window.renderSplit(t), workers: WORKERS, renderer: RENDERER }));
  stats.phases[stats.phases.length - 1].name = `render ${n} frames (${r.workers} browsers, ${r.renderer.split(' ')[0]})`;
  const pick = (k) => { const v = r.rows.map((x) => x[k]).sort((a, b) => a - b), q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]; return { min: v[0], p50: q(0.5), p90: q(0.9), p99: q(0.99), max: v[v.length - 1], mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) }; };
  stats.machine.gpu = `none (software WebGL: ${r.renderer})`;
  stats.render = { frames: n, fps: FPS, size: '1280x720 (two halves of 640x720)', workers: r.workers, renderer: r.renderer, webgl: r.webgl, fell_back: r.fell_back, capture: r.capture,
    chromium: r.chromium, browser_startup_s: r.browser_startup_s, wall_s: r.wall_s, ms_per_frame: r.ms_per_frame, left_slides_ms: pick('left'), right_cast_ms: pick('right'), screenshot_ms: r.screenshot_ms,
    note: 'The screenshot waits for the GPU process to draw the 3D half, so screenshot_ms is mostly software 3D drawing; right_cast_ms is the JavaScript side only.',
    slowest_frames: r.rows.slice().sort((a, b) => b.shot_ms - a.shot_ms).slice(0, 5).map((x) => ({ t: +(x.f / FPS).toFixed(2), shot_ms: x.shot_ms })) };
  await phase('encode (ffmpeg H.264 + AAC)', () => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%05d.png'), '-i', M4A,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-metadata', `comment=${LABEL}. Synthetic presenters and synthetic voice.`, OUT]));
} finally { srv.kill(); rmSync(tmp, { recursive: true, force: true }); }

// 6. Stats and the page.
const total = stats.phases.reduce((a, p) => a + p.wall_s, 0);
stats.finished = new Date().toISOString();
stats.output = { video: 'how-this-video-is-made.mp4', video_bytes: statSync(OUT).size, voice_bytes: statSync(M4A).size, duration_s: +duration.toFixed(2), script_words: script.split(/\s+/).length, scenes: SCENES.length };
stats.total_wall_s = +total.toFixed(2);
stats.realtime_factor = +(total / duration).toFixed(2);
stats.numbers_shown = NUMBERS;
writeJSON(join(DIR, 'stats.json'), stats);
writePage(stats);
console.log(`explainer v2: ${OUT} (${duration.toFixed(1)} s) in ${total.toFixed(1)} s`);

// The page: the video first, then how it was made, every number from stats.json, script.json or the 22 Nov study
// (docs/research/video-render-speed/). Dinis, 22 Nov: "publish a detailed webpage with this video at the top and then
// all the technical details of how it was done".
function writePage(st) {
  const R = st.render || {}, V = st.voice || {}, O = st.output || {}, M = st.machine || {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-GB') : esc(n ?? ''));
  const row = (name, d) => d ? `<tr><td>${esc(name)}</td>${['min', 'p50', 'p90', 'p99', 'max', 'mean'].map((k) => `<td>${fmt(d[k])}</td>`).join('')}</tr>` : '';
  let probe = {};
  try { probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,level,pix_fmt,width,height,r_frame_rate,sample_rate,channels:format=bit_rate', '-of', 'json', join(DIR, 'how-this-video-is-made.mp4')], { encoding: 'utf8' })); } catch { probe = {}; }
  const vs = (probe.streams || []).find((x) => x.codec_name === 'h264') || {}, as = (probe.streams || []).find((x) => x.codec_name === 'aac') || {};
  const kbps = probe.format?.bit_rate ? Math.round(probe.format.bit_rate / 1000) : '';
  const render = (st.phases || []).find((p) => /^render/.test(p.name)) || {}, encode = (st.phases || []).find((p) => /^encode/.test(p.name)) || {};
  const STUDY = [
    ['Today before the change: SwiftShader, Playwright PNG', 641, 'reference', 'reference', 'the old way'],
    ['SwiftShader, DevTools PNG', 622, 'identical', 'identical', 'same picture, little gain'],
    ['SwiftShader, JPEG in place of PNG', 610, '44.6', '0.992', 'encoding is not the cost'],
    ['SwiftShader, beginFrame control', 597, '44.6', '0.992', 'little gain'],
    ['SwiftShader, half resolution', 564, '30.5', '0.948', 'rejected: blurred'],
    ['SwiftShader, lower geometry detail', 501, '41.2', '0.990', 'not adopted (Dinis)'],
    ['SwiftShader, MSAA off', 284, '33.1', '0.980', 'rejected: jagged edges'],
    ['llvmpipe, PNG', 270, '35.2', '0.991', 'adopted: same look'],
    ['llvmpipe, half resolution', 227, '30.4', '0.947', 'rejected: blurred'],
    ['llvmpipe, lower geometry detail', 211, '34.6', '0.983', 'not adopted (Dinis)'],
    ['llvmpipe, MSAA off', 182, '31.3', '0.974', 'rejected: jagged edges'],
  ];
  const box = (x, y, w, h, t, sub, hi) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${hi ? 'rgba(255,255,0,.12)' : 'rgba(48,213,255,.08)'}" stroke="${hi ? '#ff0' : '#30d5ff'}" stroke-width="${hi ? 2 : 1.2}"/><text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" class="t">${esc(t)}</text>${sub ? `<text x="${x + w / 2}" y="${y + 40}" text-anchor="middle" class="s">${esc(sub)}</text>` : ''}</g>`;
  const arr = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7a8aa8" stroke-width="1.5" marker-end="url(#a)"/>`;
  const DEFS = '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7a8aa8"/></marker></defs>';
  const steps = [['Script', '11 scenes'], ['Voice', 'gpt-audio-mini'], ['Timeline', 'times, mouths'], ['Direction', 'cast + slides'], ['Frames', '4 browsers'], ['Video', 'ffmpeg']];
  const flow = `<svg viewBox="0 0 912 70" role="img" aria-label="The pipeline: script, voice, timeline, direction, frames, video">${DEFS}${steps.map((s, i) => box(4 + i * 152, 6, 132, 56, s[0], s[1], i === 4) + (i < 5 ? arr(138 + i * 152, 34, 154 + i * 152, 34) : '')).join('')}</svg>`;
  const stack = `<svg viewBox="0 0 912 250" role="img" aria-label="The render stack: Node starts Xvfb and four headed Chromium browsers; WebGL goes through ANGLE to OpenGL and Mesa llvmpipe on the CPU">${DEFS}
    ${box(10, 10, 250, 56, 'Node: explainer-v2.mjs', 'frames.mjs starts everything')}${arr(260, 38, 322, 38)}
    ${box(324, 10, 250, 56, 'Xvfb :90', 'a virtual screen, 1920 x 1080')}${arr(574, 38, 636, 38)}
    ${box(638, 10, 264, 56, '4 x headed Chromium', 'one per CPU core')}${arr(770, 66, 770, 96)}
    ${box(638, 98, 264, 56, 'split.html', 'slides (Blink) + cast (three.js)')}${arr(638, 126, 576, 126)}
    ${box(324, 98, 250, 56, 'ANGLE', '--use-gl=angle --use-angle=gl')}${arr(324, 126, 262, 126)}
    ${box(10, 98, 250, 56, 'OpenGL: Mesa llvmpipe', 'LLVM, 256-bit vectors', true)}${arr(135, 154, 135, 184)}
    ${box(10, 186, 250, 56, '4 CPU cores', 'no GPU')}
    ${box(638, 186, 264, 56, 'DevTools screenshot', 'PNG per frame, then ffmpeg')}${arr(770, 154, 770, 184)}</svg>`;
  const scenes = SCENES.map((s, i) => `<tr><td>${i + 1}</td><td class="l">${esc(s.title)}</td><td class="l">${esc(s.who)}</td><td>${fmt(s.start)}</td><td>${fmt(s.end)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>How this video is made: PrompTugal.news Bulletins</title>
<meta name="description" content="An explainer video on how the lab's videos are made, and every technical detail: one web page per frame, twelve 3D presenters, Mesa llvmpipe on a virtual screen, four browsers, ffmpeg, the voice, the determinism fix and the render times. Made by agents from PrompTugal.news's data.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>:root{--bg:#02060c;--fg:#e8eef8;--dim:#9ab;--y:#ff0;--c:#30d5ff;--line:#1c2a40}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 'DejaVu Sans',system-ui,sans-serif}
main{max-width:960px;margin:0 auto;padding:16px}h1{color:var(--y);font:700 30px/1.2 'DejaVu Sans Mono',monospace;margin:8px 0 12px}h2{color:var(--c);font:700 20px 'DejaVu Sans Mono',monospace;margin:36px 0 10px;border-top:1px solid var(--line);padding-top:20px}h3{font-size:16px;margin:18px 0 6px}
video{display:block;width:100%;height:auto;background:#000;border:1px solid var(--line)}.lede{font-size:18px}.dim{color:var(--dim);font-size:14px}a{color:var(--c)}code{font:14px 'DejaVu Sans Mono',monospace;color:#7cff9a}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0}.kpi{border:1px solid var(--line);padding:10px;background:rgba(48,213,255,.05)}.kpi b{display:block;color:var(--y);font:700 24px 'DejaVu Sans Mono',monospace}.kpi span{color:var(--dim);font-size:13px}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font:14px 'DejaVu Sans Mono',monospace;margin:8px 0}td,th{border-bottom:1px solid var(--line);padding:5px 8px;text-align:right;white-space:nowrap}td:first-child,th:first-child{text-align:left;white-space:normal}th{color:var(--dim);font-weight:400}td.l,th.l{text-align:left;white-space:normal}tr.hi td{color:var(--y)}
svg{width:100%;height:auto;margin:8px 0}svg .t{font:700 13px 'DejaVu Sans Mono',monospace;fill:#fff}svg .s{font:11.5px 'DejaVu Sans Mono',monospace;fill:var(--dim)}pre{background:#07101c;border:1px solid var(--line);padding:10px;overflow-x:auto;font:13px/1.5 'DejaVu Sans Mono',monospace;color:#cde}
ul,ol{padding-left:22px}li{margin:4px 0}.label{display:inline-block;background:#4a7dff;color:#000;font:700 13px 'DejaVu Sans Mono',monospace;padding:2px 8px;margin:2px 4px 2px 0}</style></head>
<body><main><p class="dim"><a href="../">Lab</a> · ${esc(LABEL)}</p>
<h1>How this video is made</h1>
<video controls playsinline preload="metadata" src="how-this-video-is-made.mp4"></video>
<p class="dim"><span class="label">synthetic voice</span><span class="label">12 synthetic presenters</span><span class="label">no real person</span> ${fmt(O.duration_s)} s · 1280 x 720 · 30 fps · <a href="how-this-video-is-made.mp4">download the MP4</a> (${fmt(Math.round((O.video_bytes || 0) / 1e5) / 10)} MB)</p>
<p class="lede">Every frame of this video was drawn by code in a web browser, on a computer with no graphics card. This page explains how: the pipeline, the page that draws each frame, the software 3D renderer we switched to, how four browsers share the work, the voice, a bug we found and fixed on the way, and what it all cost in time and money.</p>
<div class="kpis"><div class="kpi"><b>${fmt(O.duration_s)} s</b><span>of video</span></div><div class="kpi"><b>${fmt(st.total_wall_s)} s</b><span>to make it (${fmt(st.realtime_factor)} x its length)</span></div><div class="kpi"><b>${fmt(R.frames)}</b><span>frames, ${fmt(R.ms_per_frame)} ms each with ${fmt(R.workers)} browsers</span></div><div class="kpi"><b>${fmt(V.cost_usd)} USD</b><span>the voice, the only paid step</span></div><div class="kpi"><b>2.9 x</b><span>faster than before for the 31 s bulletin (396 s to 136.1 s)</span></div></div>

<h2>1. What you are watching</h2>
<p>Each frame is one web page, 1280 x 720, in two halves. The left half is a set of slides drawn with HTML and SVG (<a href="slides.js">slides.js</a>); every number on them comes from <a href="script.json">script.json</a>, which names its source. The right half is the twelve version 2 presenters, built and animated in 3D with three.js 0.160.1 by the engine in <a href="../presenters/v2-claude/">/lab/presenters/v2-claude/</a> (also published as the <a href="../../lib/presenters/">presenters library</a>). Each scene is spoken by one presenter, whose name tag turns yellow; all twelve mouths follow the voice, and the others look at the speaker. The camera cuts to the speaker and eases back to the wide shot.</p>
<div class="tw"><table><tr><th>#</th><th class="l">Scene</th><th class="l">Speaker</th><th>from (s)</th><th>to (s)</th></tr>${scenes}</table></div>

<h2>2. The pipeline</h2>
${flow}
<ol><li><b>Script.</b> Eleven scenes, fixed in <code>bulletins/explainer-v2.mjs</code>. Numbers are spoken in words and shown in figures on the slides, so the word-for-word check on the voice stays simple.</li>
<li><b>Voice.</b> OpenRouter's <code>${esc(VOICE.model)}</code>, stock voice "${esc(VOICE.voice)}", one take per scene. The model returns the audio and its own transcript; the transcript must match the script word for word or the take is refused (up to three takes a scene, or nothing is published). This time: ${fmt(V.takes)} takes for ${fmt(V.scenes)} scenes, all matched first time, ${fmt(V.cost_usd)} USD, ${fmt(V.latency_s)} s.</li>
<li><b>Timeline.</b> Each scene runs for exactly its take's length, with ${GAP} s between scenes. The voice's loudness, measured 30 times a second, picks a mouth shape for every frame (Rhubarb's letters A to H and X). That is an approximation of lip-sync, not phonemes.</li>
<li><b>Direction.</b> <a href="cast.json">cast.json</a> says who speaks when, what the others do (wave, nod, think, flinch, celebrate and so on, from the engine's move list) and where the camera is. <a href="script.json">script.json</a> drives the slides.</li>
<li><b>Frames.</b> <code>bulletins/frames.mjs</code> draws every frame in headed Chromium on a virtual screen, with the 3D half rendered by Mesa llvmpipe, in ${fmt(R.workers)} browsers at once (sections 3 to 5).</li>
<li><b>Video.</b> ffmpeg joins the ${fmt(R.frames)} PNG frames and the voice: H.264 (libx264, CRF 21, yuv420p) and AAC, with the index at the front so it starts playing at once.</li></ol>

<h2>3. Inside one frame: every frame is a function of t</h2>
<p><a href="split.html">split.html</a> holds the two halves as iframes and exposes <code>renderSplit(t)</code>, which calls <code>renderAt(t)</code> on both. Neither half keeps anything from the frame before: the slides rebuild their whole markup from t, and the engine computes every pose from t. Swinging parts (antennas, ties, tufts, keys, the cube's jelly) need memory, so they are integrated on one fixed grid of 1/120 s from rest at t = 0, with a checkpoint every second; any t visits the same grid points with the same arithmetic.</p>
<p>That is what makes the speed-up possible: frames can be drawn in any order, by any number of browsers, and the same t always gives the same picture.</p>

<h2>4. Why the frames were slow, and the renderer we switched to</h2>
<p>With no GPU, Chromium draws WebGL in software. Measured on this machine (one browser, median of 8 frames):</p>
<div class="tw"><table><tr><th>What was measured</th><th>SwiftShader (before)</th><th>Mesa llvmpipe (now)</th></tr>
<tr><td>Screenshot, nothing changed since the last one</td><td>${NUMBERS.shot_nochange_ms} ms</td><td>32 ms</td></tr>
<tr class="hi"><td>Screenshot after drawing a new frame of the 3D half</td><td>${NUMBERS.shot_swiftshader_ms} ms</td><td>${NUMBERS.shot_llvmpipe_ms} ms</td></tr>
<tr><td>JavaScript time to set up the 3D frame</td><td>10 ms</td><td>10 ms</td></tr></table></div>
<p>The screenshot itself is cheap. It waits for Chromium's GPU process to draw the scene, and the scene is heavy for software: about ${fmt(NUMBERS.draw_calls)} draw calls and ${fmt(NUMBERS.triangles)} triangles a frame with 4x edge smoothing (MSAA), counted with three.js's <code>renderer.info</code>. Halving the resolution saved little, because the cost is per triangle, not per pixel.</p>
<p>Chromium's own software renderer is SwiftShader. Mesa's llvmpipe is a software OpenGL driver that compiles its shaders with LLVM into 256-bit vector code and uses every core. Chromium uses it only with a display, so <code>frames.mjs</code>:</p>
${stack}
<ol><li>starts its own <b>Xvfb</b> (a virtual X screen) on a free display number;</li>
<li>launches Chromium <b>headed</b> on that display with <code>--use-gl=angle --use-angle=gl --ignore-gpu-blocklist</code>, so WebGL goes through ANGLE to OpenGL, which is llvmpipe;</li>
<li>asks the page which renderer WebGL reports (<code>WEBGL_debug_renderer_info</code>). This render reported: <code>${esc(R.webgl || '')}</code>;</li>
<li>if Xvfb or Mesa is missing, or the page reports anything else, falls back to headless SwiftShader and says so in the stats${R.fell_back ? ` (this render fell back: ${esc(R.fell_back)})` : ' (this render did not fall back)'}.</li></ol>

<h2>5. Four browsers, one video</h2>
<p>The ${fmt(R.frames)} frames are split into ${fmt(R.workers)} contiguous ranges, one per browser and one browser per CPU core. Each browser loads split.html, waits until both halves are ready, then for each frame runs <code>renderSplit(t)</code> and takes a Chrome DevTools screenshot (<code>Page.captureScreenshot</code>, PNG). Because every frame is a function of t, the split does not change the picture. ffmpeg then reads the PNGs in order.</p>

<h2>6. This video's performance</h2>
<p>On ${fmt(M.cpus)} CPU cores (${esc(M.cpu || '')}), ${fmt(M.mem_gb)} GB, no GPU; WebGL by ${esc(R.renderer || '')}; Node ${esc(M.node || '')}, Chromium ${esc(R.chromium || '')} (Playwright's full, headed build; its headless shell is a separate build). Started ${esc(st.started || '')}, finished ${esc(st.finished || '')}.</p>
<div class="tw"><table><tr><th>Phase</th><th>wall (s)</th><th>Node CPU (s)</th></tr>${(st.phases || []).map((p) => `<tr><td>${esc(p.name)}</td><td>${fmt(p.wall_s)}</td><td>${fmt(p.node_cpu_s)}</td></tr>`).join('')}<tr class="hi"><td>Total</td><td>${fmt(st.total_wall_s)}</td><td></td></tr></table></div>
<h3>Each frame, in milliseconds</h3>
<div class="tw"><table><tr><th>Step</th><th>min</th><th>p50</th><th>p90</th><th>p99</th><th>max</th><th>mean</th></tr>${row('Left half: slides (JavaScript)', R.left_slides_ms)}${row('Right half: 12 presenters (JavaScript)', R.right_cast_ms)}${row('Screenshot (waits for the software 3D drawing)', R.screenshot_ms)}</table></div>
<p class="dim">${fmt(R.workers)} browsers in parallel, so the wall time per frame (${fmt(R.ms_per_frame)} ms) is about a quarter of one browser's screenshot time. Browser start-up: ${esc((R.browser_startup_s || []).join(', '))} s. Slowest frames: ${(R.slowest_frames || []).map((f) => `t = ${f.t} s (${fmt(f.shot_ms)} ms)`).join(', ')}. All numbers: <a href="stats.json">stats.json</a>.</p>

<h2>7. How we chose: the measurements</h2>
<p>Every option was measured on the same 94 frames of the 21 Nov bulletin (every 10th frame, one browser). Quality is measured on the 3D half against the old frames: PSNR in dB (higher is closer; above 40 is very hard to see) and SSIM (1.0 is identical). llvmpipe scores 35 dB because it rounds edges slightly differently from SwiftShader; side by side, no difference is visible.</p>
<div class="tw"><table><tr><th>Method</th><th>ms a frame</th><th>PSNR</th><th>SSIM</th><th class="l">Verdict</th></tr>${STUDY.map((r) => `<tr${/adopted: same/.test(r[4]) ? ' class="hi"' : ''}><td>${esc(r[0])}</td><td>${fmt(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td class="l">${esc(r[4])}</td></tr>`).join('')}</table></div>
<h3>The whole 31.3 s bulletin of 21 Nov (939 frames, render and encode)</h3>
<div class="tw"><table><tr><th>Run</th><th>seconds</th><th>faster</th></tr>${NUMBERS.full_runs.map((r, i, a) => `<tr${i === a.length - 1 ? ' class="hi"' : ''}><td>${esc(r.label)}</td><td>${fmt(r.s)}</td><td>${(a[0].s / r.s).toFixed(1)} x</td></tr>`).join('')}<tr class="hi"><td>Production script (bulletin-v2.mjs) with frames.mjs, 4 browsers</td><td>136.1</td><td>2.9 x</td></tr></table></div>
<p class="dim">The 127.5 s run is the study's test script; the 136.1 s run is the production script, which also starts its own web server and writes the page.</p>
<h3>Why not record the screen while the video plays?</h3>
<p>It would take exactly the video's length, but only if the page can draw 30 frames a second. Playing live on Xvfb, it drew ${NUMBERS.live_fps_swiftshader} frames a second with SwiftShader and ${NUMBERS.live_fps_llvmpipe} with llvmpipe. A 10 s screen recording (ffmpeg <code>x11grab</code>) held ${NUMBERS.rec_frames} frames but only ${NUMBERS.rec_distinct} different pictures, so movement jumps and mouths miss the voice. Recording also loses determinism and cannot use more than one browser. With a GPU it would likely win; we have none.</p>

<h2>8. A bug found on the way: frames that remembered</h2>
<p>Renders split differently across browsers gave slightly different frames: 704 of 939 frames differed (46 to 57 dB, invisible, but not the same bytes). There were two causes:</p>
<ul><li><b>Springs.</b> A swinging part added its lag to its joint's angle. When the pose code did not set that joint outright every frame (an antenna, a tuft, a key), the lag of the previous frame stayed in the angle. The engine (<code>engine/rig.js</code>) now puts every spring joint back to its built rotation and scale before applying the pose.</li>
<li><b>Name tags.</b> On the showcase page the tags had <code>will-change: transform</code>, so Chromium rasterised their text once, at the sub-pixel position where each tag first appeared, and moved the bitmap after that. Removed.</li></ul>
<p>The determinism test (<code>tools/determinism.mjs</code>) now also draws the same t after a long history and requires byte-identical PNGs. It failed before the fix and passes after. The fix is in presenters library 0.1.1. One residue: in headed Chromium the version 1 stage's text can differ by at most 2 of 255 levels between histories (Chromium's compositor, about 70 dB); the 3D half is byte-identical.</p>

<h2>9. The file: it plays on any modern browser and device</h2>
<div class="tw"><table><tr><th>Part</th><th class="l">Format</th></tr>
<tr><td>Container</td><td class="l">MP4, index at the front (starts before it has downloaded)</td></tr>
<tr><td>Video</td><td class="l">H.264 ${esc(vs.profile || '')} profile, level ${esc(vs.level ? (vs.level / 10).toFixed(1) : '')}, ${esc(vs.width || '')} x ${esc(vs.height || '')}, ${esc(vs.pix_fmt || '')}, ${esc(vs.r_frame_rate ? vs.r_frame_rate.replace('/1', '') : '')} fps</td></tr>
<tr><td>Audio</td><td class="l">AAC ${esc(as.profile || '')}, ${esc(as.sample_rate || '')} Hz, ${as.channels === 1 ? 'mono' : esc(as.channels || '')}</td></tr>
<tr><td>Bit rate</td><td class="l">${fmt(kbps)} kbit/s</td></tr></table></div>
<p>This combination plays natively in Chrome, Edge, Firefox and Safari on desktop, and on iPhone, iPad and Android phones from roughly the last decade. The page's player uses <code>playsinline</code> so iPhones play it in the page.</p>

<h2>10. Make it yourself</h2>
<pre># from the repository root (PrompTugal/PrompTugal__News__Bulletins), with Node, Playwright's Chromium, ffmpeg, Xvfb and Mesa
OPEN_ROUTER_KEY=... BULLETINS_AGENT=d node bulletins/explainer-v2.mjs     # voice, then frames: about 0.01 USD
BULLETINS_AGENT=d node bulletins/explainer-v2.mjs --reuse                 # frames only, from the saved voice: no cost
node bulletins/explainer-v2.mjs --page-only                               # this page, from stats.json
node src/lab/presenters/v2-claude/tools/determinism.mjs 960 540           # the determinism test</pre>
<p class="dim">Options: <code>--workers N</code> (default: the number of CPU cores), <code>--fps 30</code>, <code>--renderer auto|llvmpipe|swiftshader</code>. The study's tools and raw results are in <code>docs/research/video-render-speed/</code>.</p>

<h2>11. Rules, credits and licences</h2>
<ul><li>The voice and the presenters are synthetic and labelled on every frame and on this page. No presenter is the likeness of a real person, and the voice is a stock voice, not a clone of anyone's.</li>
<li>Presenter styles credit storyboards.sgit.ai, the-ultimate-insider.book.sgit.ai and riskmandate.ai's cast.</li>
<li>Software: three.js 0.160.1 (MIT), Chromium (BSD-style) driven by Playwright (Apache-2.0), Mesa llvmpipe (MIT), Xvfb (X.Org, MIT-style), ffmpeg with libx264 (GPL) for encoding. Our code: Apache-2.0. This text and the video: CC BY 4.0.</li>
<li>Made by agents: bulletins.d@PrompTugal.dinis, at Dinis Cruz's request of 22 Nov 2026. Sources of the numbers: ${esc(NUMBERS.source)}</li></ul>
</main></body></html>
`;
  writeFileSync(join(DIR, 'index.html'), html);
}
