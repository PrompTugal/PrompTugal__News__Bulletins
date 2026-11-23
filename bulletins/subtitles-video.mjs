// "Eight ways to caption": an Explorer video about subtitles, made to work with the sound off (bulletins.d@PrompTugal
// .dinis, 22 Nov 2026). Dinis, 22 Nov: "a new video with 8 variations ... just a character ... focus on the narration
// ... on the subtitles ... this has to work outside sound ... every word is highlighted or every group of words ...
// different formats, different layouts ... programmatically choose how much of the phrase is actually shown and the
// pacing of it ... match the text being shown to the voice audio, which you should also have direct control of".
// Explorer tier (Dinis, same message): a fast first pass, an open-source voice, made in quantity; a later Publish
// pass for social media sharpens and checks it.
// 1. Script: segments of phrases. Each phrase has its own speed and the pause after it, so the pacing is explicit.
// 2. Voice: bulletins/voice-local.py (Kokoro-82M, Apache-2.0, on the CPU, free), one take per phrase, so every
//    phrase's start and end are known exactly; words are placed across the phrase's voiced span by syllables.
// 3. Timeline: words with times, segments with their caption style and options, mouth shapes from loudness, cues
//    and camera for one presenter (timeline.json).
// 4. Frames: src/lab/subtitles/stage.html by bulletins/frames.mjs (llvmpipe), then ffmpeg. Stats in stats.json.
// Run: node bulletins/subtitles-video.mjs [--reuse] [--workers <CPUs>] [--renderer auto|llvmpipe|swiftshader]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir, cpus, totalmem, platform, release } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ROOT, readJSON, writeJSON, esc } from './core.mjs';
import { LABEL } from './render.mjs';
import { renderFrames } from './frames.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REUSE = process.argv.includes('--reuse'), WORKERS = +arg('--workers', cpus().length), FPS = 30, RENDERER = arg('--renderer', 'auto');
const DIR = join(ROOT, 'src', 'lab', 'subtitles'), RATE = 24000, WHO = 'anchor';
// --script eight (the first exploration) | three (the recommended three, and the chooser). --voice: a Kokoro voice id.
// Dinis, 23 Nov: "I didn't like that voice. Try another one." am_michael is one of Kokoro's best-graded male voices
// (C+ in Kokoro's own VOICES.md, against C for bm_george).
const SCRIPT = arg('--script', 'eight'), VOICE_ID = arg('--voice', SCRIPT === 'eight' ? 'bm_george' : 'am_michael');
const NAMES = { eight: { video: 'eight-ways-to-caption.mp4', timeline: 'timeline.json', takes: 'voice-takes.json', audio: 'voice.m4a', stats: 'stats.json' },
  three: { video: 'three-ways-to-caption.mp4', timeline: 'timeline-three.json', takes: 'voice-takes-three.json', audio: 'voice-three.m4a', stats: 'stats-three.json' } }[SCRIPT];
const VOICE = { engine: 'Kokoro-82M v1.0 (int8 ONNX), kokoro-onnx 0.6.1', voice: VOICE_ID, lang: VOICE_ID.startsWith('b') ? 'en-gb' : 'en-us', licence: 'Apache-2.0 (model and voices); kokoro-onnx MIT; onnxruntime MIT',
  model: process.env.KOKORO_MODEL || '/home/user/.models/kokoro/kokoro-v1.0.int8.onnx', voices: process.env.KOKORO_VOICES || '/home/user/.models/kokoro/voices-v1.0.bin',
  python: process.env.KOKORO_PYTHON || '/home/user/.venvs/kokoro/bin/python', synthetic: true };
const stats = { started: new Date().toISOString(), tier: 'Explorer', machine: { cpus: cpus().length, cpu: cpus()[0]?.model, mem_gb: +(totalmem() / 2 ** 30).toFixed(1), os: `${platform()} ${release()}`, node: process.version }, phases: [] };
async function phase(name, fn) { const c0 = process.cpuUsage(), t0 = performance.now(); const out = await fn(); const c = process.cpuUsage(c0); stats.phases.push({ name, wall_s: +((performance.now() - t0) / 1000).toFixed(3), node_cpu_s: +((c.user + c.system) / 1e6).toFixed(3) }); console.log(`${name}: ${((performance.now() - t0) / 1000).toFixed(2)} s`); return out; }

// Layouts: where the presenter stands in the frame, as a camera on Duarte (slot x 0.9, z -2.2). dx moves him right.
const CAM = (dx = 0, dist = 4.4, fov = 30) => ({ pos: [0.9 - dx, 1.62, -2.2 + dist], look: [0.9 - dx, 1.32, -2.2], fov });
const LAYOUT = { centre: CAM(0), right: CAM(0.78), left: CAM(-0.72), wide: CAM(0, 5.8) };
// The script. *word* marks an important word (used by the kinetic style). pause: seconds after the phrase.
const SEGMENTS = [
  { id: 'intro', style: 'karaoke', layout: 'centre', chip: 'Eight ways to caption', card: 2.2, cardTitle: 'Eight ways to caption', cardSub: 'One presenter, one voice, eight ways to show what is said. Made to work with the sound off.',
    text: 'Eight ways to show what is said. This video is about subtitles, so it has to work with the sound off.', moves: ['wave'] },
  { id: 's1', style: 'karaoke', layout: 'centre', chip: '1 · Karaoke', opt: { window: 2 }, card: 1.4, cardTitle: '1 · Karaoke', cardSub: 'The whole line stays; each word fills with colour as it is spoken.',
    text: 'One. Karaoke. The whole line stays on screen, and each word lights up as it is spoken.', moves: ['present'] },
  { id: 's2', style: 'word', layout: 'right', chip: '2 · One word', opt: { hold: 0.3, lead: 0.02 }, card: 1.4, cardTitle: '2 · One word at a time', cardSub: 'Big and centred: easy on a phone, but you cannot read ahead.',
    text: 'Two. One word at a time. Big, in the middle, and easy to read on a phone.', moves: ['count'] },
  { id: 's3', style: 'groups', layout: 'centre', chip: '3 · Groups of three', opt: { window: 3 }, card: 1.4, cardTitle: '3 · Groups of three', cardSub: 'Three words at a time; the spoken word is larger.',
    text: 'Three. Small groups. Three words at a time, with the spoken word a little larger.', moves: ['nod'] },
  { id: 's4', style: 'rolling', layout: 'centre', chip: '4 · Roll-up', card: 1.4, cardTitle: '4 · Roll-up captions', cardSub: 'Two lines, as on television; the older line moves up and away.',
    text: 'Four. Roll-up captions, as on television. Two lines, and the older line moves up and away.', moves: ['think'] },
  { id: 's5', style: 'page', layout: 'right', chip: '5 · The page', opt: { title: 'The page' }, card: 1.4, cardTitle: '5 · The page', cardSub: 'The whole paragraph is visible, so you can read ahead.',
    text: 'Five. The page. You see the whole paragraph, so you can read ahead, and the word I am saying is marked as I say it.', moves: ['present'] },
  { id: 's6', style: 'bubble', layout: 'right', chip: '6 · Speech bubble', opt: { hold: 0.5 }, card: 1.4, cardTitle: '6 · A speech bubble', cardSub: 'Each phrase comes from the presenter, typed out with the voice.',
    text: 'Six. A speech bubble. Each phrase appears from me, typed out as I speak it.', moves: ['openPalms'] },
  { id: 's7', style: 'kinetic', layout: 'right', chip: '7 · Kinetic type', card: 1.4, cardTitle: '7 · Kinetic type', cardSub: 'Important words are big; small words stay quiet.',
    text: 'Seven. Kinetic type. The *important* words are *big*, and the small words stay *quiet*.', moves: ['point'] },
  { id: 's8', style: 'ticker', layout: 'left', chip: '8 · The ticker', opt: { label: 'NOW' }, card: 1.4, cardTitle: '8 · The ticker', cardSub: 'One phrase in the bar; everything already said in a column.',
    text: 'Eight. The ticker. One phrase in the bar, and everything already said in the column on the right.', moves: ['present'] },
  { id: 'outro', style: 'karaoke', layout: 'wide', chip: 'How it is timed', opt: { window: 2 }, card: 0,
    text: 'Every caption here is timed to the voice, phrase by phrase, because the voice was made from the same text. Made by agents from PrompTugal dot news. The voice and the presenter are synthetic.', moves: ['bow'] },
];
const SEGMENTS_THREE = [
  { id: 'intro', style: 'rolling', layout: 'centre', chip: 'Three ways to caption', card: 2.2, cardTitle: 'Three ways to caption', cardSub: 'Roll-up, kinetic type and the page: the recommended three, chosen by the script. Made to work with the sound off.',
    text: 'Three ways to caption, chosen for what is being said. This video works with the sound off.', moves: ['wave'] },
  { id: 'r', style: 'rolling', layout: 'centre', chip: '1 · Roll-up', card: 1.6, cardTitle: '1 · Roll-up, for narration', cardSub: 'Two lines; each whole word lights up as it is spoken.',
    text: 'Roll-up captions carry ordinary narration. Two lines stay on screen, and each word lights up as I say it.', moves: ['present'] },
  { id: 'k', style: 'kinetic', layout: 'right', chip: '2 · Kinetic type', card: 1.6, cardTitle: '2 · Kinetic type, for key lines', cardSub: 'Few words; the important ones big.',
    text: 'Kinetic type is for the *punchline*. Few words, *big* words, and the rest stays *quiet*.', moves: ['point'] },
  { id: 'p', style: 'page', layout: 'right', chip: '3 · The page', opt: { title: 'The page' }, card: 1.6, cardTitle: '3 · The page, for longer explanations', cardSub: 'The whole paragraph at once; read ahead, the spoken word marked.',
    text: 'The page is for longer explanations. When a point needs several sentences, you see the whole paragraph at once, so you can read ahead at your own pace. The word I am saying is marked as I go, which helps with numbers, names and steps that are easy to lose in a line of captions.', moves: ['present'] },
  { id: 'a1', style: 'auto', chip: 'The script chooses', card: 2.4, cardTitle: 'The script chooses', cardSub: 'Long explanations: the page. Short lines with key words: kinetic type. Everything else: roll-up.',
    text: 'So which one is used? The script chooses, from the words themselves.', moves: ['think'] },
  { id: 'a2', style: 'auto', chip: '', text: 'A short line with a *key* word gets *kinetic* type.', moves: ['point'] },
  { id: 'a3', style: 'auto', chip: '', opt: { title: 'A longer explanation' },
    text: 'And a long explanation, with several sentences and the details you may want to read twice, gets the page. You can read ahead, go back a line, and still see which word I am saying, because the marker follows the voice from the first word to the last.', moves: ['present'] },
  { id: 'outro', style: 'rolling', layout: 'wide', chip: 'How it is timed',
    text: 'Every caption is timed to the voice, phrase by phrase. Made by agents from PrompTugal dot news. The voice and the presenter are synthetic.', moves: ['bow'] },
];
// The same rule as Captions.choose in src/lab/subtitles/captions.js, to pick the layout and the chip.
function choose(text) {
  const ws = text.split(/\s+/).filter(Boolean), n = ws.length, sentences = Math.max(1, ws.filter((w) => /[.?!]\*?$/.test(w)).length), emph = ws.filter((w) => /\*/.test(w)).length;
  if (n > 40 || n / sentences > 22) return 'page';
  if (n <= 16 && emph > 0) return 'kinetic';
  return 'rolling';
}
const NAME = { rolling: 'roll-up', kinetic: 'kinetic type', page: 'the page' }, LAY = { rolling: 'centre', kinetic: 'right', page: 'right' };
if (SCRIPT === 'three') { SEGMENTS.length = 0; for (const s of SEGMENTS_THREE) { if (s.style === 'auto') { const c = choose(s.text); s.layout = LAY[c]; s.chip = `auto → ${NAME[c]}`; } SEGMENTS.push(s); } }
// Phrases: split after , . ; : ? ! so each is voiced on its own; a full stop gets a longer pause.
const phrasesOf = (text) => text.match(/[^,.;:?!]+[,.;:?!]?/g).map((s) => s.trim()).filter(Boolean).map((s) => ({ text: s, speed: 1.0, pause: /[.?!]$/.test(s) ? 0.32 : 0.14 }));
const syl = (w) => Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '').match(/[aeiouy]+/g) || []).length);
for (const s of SEGMENTS) s.phrases = phrasesOf(s.text);
const all = SEGMENTS.flatMap((s) => s.phrases.map((p) => ({ ...p, seg: s.id })));

// 1. The voice: one take per phrase.
const TAKES = join(DIR, NAMES.takes), M4A = join(DIR, NAMES.audio), PCMDIR = join(tmpdir(), 'subtitles-voice-' + SCRIPT + '-' + VOICE_ID);
const takes = await phase('voice (Kokoro on the CPU, one take per phrase)', () => {
  if (REUSE && existsSync(TAKES) && existsSync(PCMDIR)) return readJSON(TAKES, {});
  rmSync(PCMDIR, { recursive: true, force: true }); mkdirSync(PCMDIR, { recursive: true });
  const t0 = performance.now();
  const out = execFileSync(VOICE.python, ['-I', join(ROOT, 'bulletins', 'voice-local.py')], { input: JSON.stringify({ model: VOICE.model, voices: VOICE.voices, voice: VOICE.voice, lang: VOICE.lang, out: PCMDIR,
    phrases: all.map((p) => ({ text: p.text.replace(/\*/g, ''), speed: p.speed })) }), maxBuffer: 16 << 20, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
  const r = JSON.parse(out.trim().split('\n').pop());
  r.wall_s = +((performance.now() - t0) / 1000).toFixed(2);
  writeJSON(TAKES, { about: 'One Kokoro take per phrase of "Eight ways to caption": samples and voiced span. Written by bulletins/subtitles-video.mjs.', voice: VOICE.voice, engine: VOICE.engine, rate: r.rate, wall_s: r.wall_s, phrases: r.phrases.map((x) => ({ samples: x.samples, voiced: x.voiced })) });
  return readJSON(TAKES, {});
});

// 2. Timeline: exact phrase times; words across each phrase's voiced span by syllables.
const { words, segments, pcm, duration } = await phase('timeline: phrase and word times, audio', () => {
  let t = 0.3, pi = 0; const words = [], segments = [], parts = [];
  const silence = (s) => { const n = Math.round(s * RATE); parts.push(Buffer.alloc(n * 2)); t += n / RATE; };
  silence(0.3); t = 0.3;
  for (const s of SEGMENTS) {
    const start = t; if (s.card) silence(s.card);
    for (const p of s.phrases) {
      const tk = takes.phrases[pi], buf = readFileSync(join(PCMDIR, `p${String(pi).padStart(3, '0')}.pcm`));
      const p0 = t, v0 = p0 + tk.voiced[0] / RATE, v1 = p0 + tk.voiced[1] / RATE;
      const ws = p.text.split(/\s+/).filter(Boolean), total = ws.reduce((a, w) => a + syl(w) + 0.3, 0); let c = 0;
      for (const w of ws) { const d = (syl(w) + 0.3) / total * (v1 - v0); words.push({ w, s: +(v0 + c).toFixed(3), e: +(v0 + c + d).toFixed(3), p: pi, seg: s.id, emph: /\*/.test(w) }); c += d; }
      parts.push(buf); t += tk.samples / RATE; silence(p.pause); pi++;
    }
    silence(0.5); segments.push({ id: s.id, style: s.style, opt: s.opt || {}, chip: s.chip, card: s.card || 0, cardTitle: s.cardTitle || '', cardSub: s.cardSub || '', layout: s.layout, start: +start.toFixed(3), end: +t.toFixed(3) });
  }
  silence(1.0);
  return { words, segments, pcm: Buffer.concat(parts), duration: t };
});
const n = Math.floor(duration * FPS);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', 'pipe:0', '-c:a', 'aac', '-b:a', '96k', M4A], { input: pcm });

// 3. Mouth shapes from loudness, cues and camera.
const per = RATE / FPS, amp = [];
for (let f = 0; f < n; f++) { let q = 0; for (let i = 0; i < per; i++) { const k = (f * per + i) * 2; const x = k + 1 < pcm.length ? pcm.readInt16LE(k) / 32768 : 0; q += x * x; } amp.push(Math.sqrt(q / per)); }
const peak = Math.max(...amp) || 1; for (let i = 0; i < n; i++) amp[i] = Math.min(1, amp[i] / peak * 1.4);
// LEAD: the engine eases into each mouth shape over about 70 ms, so the shapes start 60 ms early to land on the sound
// (measured 23 Nov: the jaw trailed the loudness by one frame at 15 fps, correlation 0.81 one frame late against 0.68).
const LEAD = 0.06, mouthCues = [];
for (let f = 0; f < n; f++) { const a = amp[f], v = a < 0.07 ? 'X' : a < 0.22 ? (f % 6 < 3 ? 'B' : 'F') : a < 0.45 ? (f % 4 < 2 ? 'C' : 'E') : (f % 4 < 2 ? 'D' : 'C'); const last = mouthCues[mouthCues.length - 1], tt = +Math.max(0, f / FPS - LEAD).toFixed(3), te = +Math.max(0, (f + 1) / FPS - LEAD).toFixed(3); if (last && last.value === v) last.end = te; else mouthCues.push({ start: tt, end: te, value: v }); }
const cues = [{ t: 0.1, who: WHO, do: 'straightenTie' }], camera = [];
for (const s of segments) {
  const def = SEGMENTS.find((x) => x.id === s.id), first = words.find((w) => w.seg === s.id);
  camera.push({ t: s.start, ...LAYOUT[s.layout], cut: true });
  cues.push({ t: first.s - 0.05, who: WHO, do: 'speak', track: 'voice', offset: +(first.s - 0.05).toFixed(3), dur: +(s.end - first.s).toFixed(3) });   // offset: the mouth track is in absolute time
  (def.moves || []).forEach((m, i) => cues.push({ t: first.s + 0.6 + i * 1.5, who: WHO, do: m, dur: 2 }));
  cues.push({ t: first.s + 0.2, who: WHO, do: 'expression', name: 'smile', dur: 1.5 });
}
cues.sort((a, b) => a.t - b.t);
writeJSON(join(DIR, NAMES.timeline), { about: 'The subtitles video: segments (caption style and options), words with their spoken times, mouth shapes, cues and camera. Written by bulletins/subtitles-video.mjs.',
  who: WHO, duration: +duration.toFixed(3), fps: FPS, label: `${LABEL} · Voice (Kokoro, open source) and presenter: synthetic`, segments, words, mouthCues, cues, camera });

if (process.argv.includes('--timeline-only')) { console.log(`timeline written: ${duration.toFixed(1)} s, ${words.length} words, ${segments.length} segments`); process.exit(0); }

// 4. Frames and video.
const PORT = 8803, srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: join(ROOT, 'src'), stdio: 'ignore' });
const tmp = mkdtempSync(join(tmpdir(), 'subtitles-')), OUT = join(DIR, NAMES.video);
try {
  await new Promise((r) => setTimeout(r, 900));
  const r = await phase(`render ${n} frames`, () => renderFrames({ url: `http://127.0.0.1:${PORT}/lab/subtitles/stage.html?tl=${NAMES.timeline}`, n, fps: FPS, out: tmp, ready: () => window.stageReady === true, draw: (t) => window.renderFrame(t), workers: WORKERS, renderer: RENDERER }));
  stats.phases[stats.phases.length - 1].name = `render ${n} frames (${r.workers} browsers, ${r.renderer.split(' ')[0]})`;
  const pick = (k) => { const v = r.rows.map((x) => x[k]).sort((a, b) => a - b), q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]; return { min: v[0], p50: q(0.5), p90: q(0.9), p99: q(0.99), max: v[v.length - 1], mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) }; };
  stats.render = { frames: n, fps: FPS, size: '1280x720', workers: r.workers, renderer: r.renderer, webgl: r.webgl, fell_back: r.fell_back, chromium: r.chromium, wall_s: r.wall_s, ms_per_frame: r.ms_per_frame,
    captions_ms: pick('left'), presenter_ms: pick('right'), screenshot_ms: r.screenshot_ms };
  await phase('encode (ffmpeg H.264 + AAC)', () => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%05d.png'), '-i', M4A, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-metadata', `comment=${LABEL}. Synthetic presenter and synthetic voice.`, OUT]));
} finally { srv.kill(); rmSync(tmp, { recursive: true, force: true }); }
const total = stats.phases.reduce((a, p) => a + p.wall_s, 0);
Object.assign(stats, { finished: new Date().toISOString(), voice: { ...VOICE, model: undefined, voices: undefined, python: undefined, phrases: all.length, takes_wall_s: takes.wall_s, cost_usd: 0 },
  script: SCRIPT, output: { video: NAMES.video, video_bytes: statSync(OUT).size, duration_s: +duration.toFixed(2), segments: segments.length, words: words.length }, total_wall_s: +total.toFixed(2), realtime_factor: +(total / duration).toFixed(2) });
writeJSON(join(DIR, NAMES.stats), stats);
console.log(`subtitles: ${OUT} (${duration.toFixed(1)} s) in ${total.toFixed(1)} s`);
