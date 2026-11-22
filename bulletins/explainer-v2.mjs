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
const REUSE = process.argv.includes('--reuse'), WORKERS = +arg('--workers', cpus().length), FPS = +arg('--fps', 30), RENDERER = arg('--renderer', 'auto');
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
  cues.push({ t: s.start, who: s.who, do: 'speak', track: 'voice', offset: s.start, dur: +len.toFixed(3) });
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
const row = (name, d) => d ? `<tr><td>${esc(name)}</td>${['min', 'p50', 'p90', 'p99', 'max', 'mean'].map((k) => `<td>${esc(d[k])}</td>`).join('')}</tr>` : '';
writeFileSync(join(DIR, 'index.html'), `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>How this video is made: PrompTugal.news Bulletins</title>
<meta name="description" content="An explainer video on how the lab's videos are made: one web page per frame, twelve 3D presenters, Mesa llvmpipe on a virtual screen, four browsers and ffmpeg. With its own render times. Made by agents from PrompTugal.news's data.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>body{margin:0;background:#02060c;color:#e8eef8;font:16px/1.5 'DejaVu Sans',sans-serif}main{max-width:960px;margin:0 auto;padding:16px}h1{color:#ff0;font:700 26px 'DejaVu Sans Mono',monospace}h2{color:#30d5ff;font:700 18px 'DejaVu Sans Mono',monospace;margin-top:28px}
video{width:100%;height:auto;background:#000}table{border-collapse:collapse;width:100%;font:14px 'DejaVu Sans Mono',monospace}td,th{border-bottom:1px solid #223;padding:4px 6px;text-align:right}td:first-child,th:first-child{text-align:left}.dim{color:#9ab;font-size:14px}a{color:#30d5ff}</style></head>
<body><main><p class="dim"><a href="../">Lab</a> · ${esc(LABEL)}</p><h1>How this video is made</h1>
<p>How the lab's videos are made, told by the twelve synthetic presenters: one web page per frame, the 3D half drawn in software by Mesa llvmpipe on a virtual screen, four browsers sharing the frames, and ffmpeg joining pictures and voice. The voice and the presenters are synthetic; no real person.</p>
<video controls preload="metadata" src="how-this-video-is-made.mp4"></video>
<h2>How long this video took to make</h2>
<p>${esc(stats.output.duration_s)} s of video in <b>${esc(stats.total_wall_s)} s</b> (${esc(stats.realtime_factor)} times its length), on ${esc(stats.machine.cpus)} CPU cores (${esc(stats.machine.cpu || '')}), ${esc(stats.machine.mem_gb)} GB, ${esc(stats.machine.gpu)}; Node ${esc(stats.machine.node)}, Chromium ${esc(stats.render.chromium || '')}; WebGL: ${esc(stats.render.webgl || '')}.</p>
<table><tr><th>Phase</th><th>wall (s)</th><th>Node CPU (s)</th></tr>${stats.phases.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.wall_s)}</td><td>${esc(p.node_cpu_s)}</td></tr>`).join('')}</table>
<h2>Each frame (milliseconds)</h2><table><tr><th>Step</th><th>min</th><th>p50</th><th>p90</th><th>p99</th><th>max</th><th>mean</th></tr>${row('Left half: slides (JavaScript)', stats.render.left_slides_ms)}${row('Right half: 12 presenters (JavaScript)', stats.render.right_cast_ms)}${row('Screenshot (waits for the software 3D drawing)', stats.render.screenshot_ms)}</table>
<p class="dim">${stats.render.frames} frames at ${stats.render.fps} fps, ${esc(stats.render.size)}, ${stats.render.workers} browsers (start-up ${esc(stats.render.browser_startup_s.join(', '))} s), ${esc(stats.render.renderer)}${stats.render.fell_back ? `; fell back: ${esc(stats.render.fell_back)}` : ''}. Voice: ${esc(VOICE.model)}, "${esc(VOICE.voice)}", ${esc(stats.voice.takes ?? '')} takes for ${SCENES.length} scenes, ${esc(stats.voice.cost_usd ?? '')} USD${stats.voice.reused ? ' (reused)' : ''}. All numbers: <a href="stats.json">stats.json</a>. Scenes: <a href="script.json">script.json</a>; direction: <a href="cast.json">cast.json</a>; the page: <a href="split.html">split.html</a>. Made by bulletins/explainer-v2.mjs.</p>
<h2>Where the numbers on the slides come from</h2><p class="dim">${esc(NUMBERS.source)}</p>
</main></body></html>
`);
console.log(`explainer v2: ${OUT} (${duration.toFixed(1)} s) in ${total.toFixed(1)} s`);
