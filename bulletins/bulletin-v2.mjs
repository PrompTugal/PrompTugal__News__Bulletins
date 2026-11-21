// The day's video bulletin with the version 2 presenters (Dinis, 21 Nov 2026: "use them to create another bulletin
// video ... put all 12 on the right ... make them more interesting ... pick interesting stories from what happened
// today on the multiple cities monitored ... a real 30s bulletin ... capture detailed performance stats on the
// creation and rendering").
// 1. Stories: one checked sentence each from P500 (Portugal), P300 (Lisbon) and P700 (London), by fixed rules below.
// 2. Voice: bulletins/voice.mjs (OpenRouter, stock voice, transcript checked word for word).
// 3. Mouth shapes: from the voice's loudness, in Rhubarb's format (Rhubarb itself was not run: an approximation).
// 4. Left half: version 1's animated bulletin (src/lab/video/stage.js?layout=half) from timeline.json.
//    Right half: all twelve version 2 presenters (cast.html), directed by cast.json, written here.
// 5. Render: split.html, every frame a function of t, in parallel browsers; ffmpeg joins frames and voice.
// 6. Stats: every phase timed (wall and CPU), every frame timed per half, written to stats-<day>.json and the page.
// Run: node bulletins/bulletin-v2.mjs [--reuse] [--workers 3] [--fps 30]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir, cpus, totalmem, platform, release } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { ROOT, readJSON, writeJSON, esc } from './core.mjs';
import { LABEL } from './render.mjs';
import { MAP_DATA } from './map.mjs';
import { speak, VOICE } from './voice.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REUSE = process.argv.includes('--reuse'), WORKERS = +arg('--workers', 3), FPS = +arg('--fps', 30);
const DIR = join(ROOT, 'src', 'lab', 'bulletin-v2');
const stats = { started: new Date().toISOString(), machine: { cpus: cpus().length, cpu: cpus()[0]?.model, mem_gb: +(totalmem() / 2 ** 30).toFixed(1), os: `${platform()} ${release()}`, node: process.version, gpu: 'none (software WebGL)' }, phases: [] };
async function phase(name, fn) {
  const c0 = process.cpuUsage(), t0 = performance.now();
  const out = await fn();
  const c = process.cpuUsage(c0);
  stats.phases.push({ name, wall_s: +((performance.now() - t0) / 1000).toFixed(3), node_cpu_s: +((c.user + c.system) / 1e6).toFixed(3) });
  console.log(`${name}: ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  return out;
}

// 1. The stories. Fixed rules, so the choice is explainable: the first kept sentence on each page that matches.
const RULES = [
  { page: '500', place: 'Portugal', match: /active weather warnings/, who: 'holo' },
  { page: '300', place: 'Lisbon', match: /warning for rain/, who: 'rowan' },
  { page: '700', place: 'London', match: /forecast for London today/, who: 'realist' },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WIND = { N: 'north', S: 'south', E: 'east', W: 'west', NE: 'north-east', NW: 'north-west', SE: 'south-east', SW: 'south-west' };
// Spoken form, by rule only: dates, clock times on the hour, units, compass points.
const hour = (h) => (+h === 12 ? 'noon' : +h === 0 ? 'midnight' : +h > 12 ? `${+h - 12} pm` : `${+h} am`);
const spoken = (t) => t
  .replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => `${+d} ${MONTHS[+m - 1]}`)
  .replace(/\b(\d{1,2}):00\b/g, (_, h) => hour(h))
  .replace(/\s?°C/g, ' degrees').replace(/(\d)%/g, '$1 percent').replace(/(\d) mm\b/g, '$1 millimetres')
  .replace(/\bfrom the (N|S|E|W|NE|NW|SE|SW)\b/g, (_, w) => `from the ${WIND[w]}`);

const { day, segs, picks } = await phase('select stories', () => {
  const picks = RULES.map((r) => {
    const s = readJSON(join(ROOT, 'data', 'scripts', `${r.page}.json`), null);
    const k = (s?.kept || []).find((x) => r.match.test(x.text));
    if (!k) throw new Error(`P${r.page}: no kept sentence matches ${r.match}`);
    const byId = new Map((s.facts || []).map((f) => [f.id, f]));
    return { ...r, text: k.text, written: s.written, facts: (k.facts || []).map((id) => byId.get(id)).filter(Boolean).map((f) => ({ id: f.id, source: f.source, origin: f.origin, licence: f.licence?.name, by: f.by })) };
  });
  const day = picks[0].written.slice(0, 10);
  const segs = [
    { kind: 'open', who: 'anchor', show: `${day}: Portugal, Lisbon, London`, say: `PrompTugal dot news bulletins, ${spoken(day)}.` },
    ...picks.map((p) => ({ kind: 'line', who: p.who, place: p.place, show: p.text, say: spoken(p.text), facts: p.facts })),
    { kind: 'close', who: 'anchor', show: `${LABEL}. Voices and presenters: synthetic.`, say: 'Made by agents from PrompTugal dot news data. The voices and the presenters are synthetic.' },
  ];
  return { day, segs, picks };
});
const script = segs.map((s) => s.say).join(' ');

// 2. The voice.
const M4A = join(DIR, `voice-${day}.m4a`);
const pcm = await phase('voice (OpenRouter)', async () => {
  if (REUSE && existsSync(M4A)) return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', M4A, '-f', 's16le', '-ac', '1', '-ar', '24000', '-'], { maxBuffer: 64 << 20 });
  const t0 = performance.now(), v = await speak(script, `bulletin v2 voice ${day}`);
  stats.voice = { model: VOICE.model, voice: VOICE.voice, cost_usd: v.cost, latency_s: +((performance.now() - t0) / 1000).toFixed(2), transcript_matches: v.same, words: script.split(/\s+/).length, chars: script.length };
  if (!v.same) { console.log('script:     ' + script + '\ntranscript: ' + v.transcript); throw new Error('the voice did not read the script word for word: nothing published'); }
  const tmp = join(tmpdir(), `v2voice-${process.pid}.pcm`); writeFileSync(tmp, v.pcm);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', tmp, '-c:a', 'aac', '-b:a', '96k', M4A]); rmSync(tmp);
  return v.pcm;
});
if (REUSE && !stats.voice) stats.voice = { ...(readJSON(join(DIR, `stats-${day}.json`), {}).voice || {}), reused: true };

// 3. Timings, loudness and mouth shapes.
const { duration, n, amp } = await phase('timeline, loudness, mouth shapes', () => {
  const per = 24000 / FPS, n = Math.floor(pcm.length / 2 / per), amp = [];
  for (let f = 0; f < n; f++) { let s = 0; for (let i = 0; i < per; i++) { const x = pcm.readInt16LE((f * per + i) * 2) / 32768; s += x * x; } amp.push(Math.sqrt(s / per)); }
  const peak = Math.max(...amp) || 1; for (let i = 0; i < n; i++) amp[i] = +Math.min(1, amp[i] / peak * 1.4).toFixed(3);
  const duration = n / FPS, total = segs.reduce((a, s) => a + s.say.split(/\s+/).length, 0);
  let t0 = 0;
  for (const s of segs) {
    const len = duration * s.say.split(/\s+/).length / total; s.start = +t0.toFixed(3); t0 += len; s.end = +t0.toFixed(3);
    const words = s.show.split(/\s+/).filter(Boolean), chars = words.reduce((a, w) => a + w.length + 1, 0); let c = 0;
    s.words = words.map((w) => { const at = s.start + 0.15 + (len - 0.4) * c / chars; c += w.length + 1; return { w, start: +at.toFixed(3) }; });
  }
  return { duration, n, amp };
});
// Mouth shapes from loudness (Rhubarb's letters; X rest, B closed teeth, C and E mid, D wide, F rounded), alternating
// at the same loudness so the mouth does not freeze. An approximation of lip-sync, not phonemes.
const mouthCues = [];
for (let f = 0; f < n; f++) {
  const a = amp[f], v = a < 0.07 ? 'X' : a < 0.22 ? (f % 6 < 3 ? 'B' : 'F') : a < 0.45 ? (f % 4 < 2 ? 'C' : 'E') : (f % 4 < 2 ? 'D' : 'C');
  const last = mouthCues[mouthCues.length - 1], t = +(f / FPS).toFixed(3);
  if (last && last.value === v) last.end = +((f + 1) / FPS).toFixed(3); else mouthCues.push({ start: t, end: +((f + 1) / FPS).toFixed(3), value: v });
}

// 4a. Left half: version 1's stage (half layout) and its timeline.
const hosts = (fs) => [...new Set((fs || []).map((f) => { try { return new URL(f.origin || f.source).hostname; } catch { return null; } }).filter(Boolean))];
writeJSON(join(DIR, 'timeline.json'), { page: '100', day, duration: +duration.toFixed(3), fps: FPS, label: LABEL, voice: `${VOICE.model}, ${VOICE.voice}`,
  ticker: picks.map((p) => `${p.place}: ${p.text}`).join('  ·  '), barMax: 25, places: MAP_DATA.places, current: 'faro', london: MAP_DATA.london,
  segs: segs.map((s) => ({ kind: s.kind, show: s.kind === 'line' ? `${s.place.toUpperCase()} · ${s.show}` : s.show, start: s.start, end: s.end,
    words: (s.kind === 'line' ? [{ w: `${s.place.toUpperCase()} ·`, start: s.start }] : []).concat(s.words), bars: [],
    src: s.facts ? `Source: ${hosts(s.facts).join(', ')}, read through data.promptugal.news; facts ${s.facts.map((f) => f.id).join(', ')}` : '', links: (s.facts || []).filter((f) => /^https:/.test(f.source || '')).map((f) => ({ id: f.id, url: f.source })) })),
  amp });
writeFileSync(join(DIR, 'stage.html'), readFileSync(join(ROOT, 'src', 'lab', 'video', 'stage.html'), 'utf8').replace('<script src="stage.js">', '<script src="../video/stage.js">').replace('Video bulletin stage:', 'Version 2 bulletin, left half:'));

// 4b. Right half: the cast's direction.
const SLOTS = { teletext: [-3.3, -2.2], guide: [-2.0, -2.2], holo: [-0.8, -2.2], anchor: [0.4, -2.2], realist: [1.6, -2.2], rowan: [2.8, -2.2],
  agent: [-2.7, 0.1], conductor: [-1.6, 0.1], owl: [-0.5, 0.1], researcher: [0.6, 0.1], caretaker: [1.7, 0.1], cube: [2.35, 0.7] };
const ALL = Object.keys(SLOTS), BOTS = ['agent', 'conductor', 'researcher', 'caretaker'], HUMANS = ['holo', 'anchor', 'realist', 'guide', 'rowan'];
const head = (id) => [SLOTS[id][0], ['teletext', 'guide', 'holo', 'anchor', 'realist', 'rowan'].includes(id) ? 2.2 : 1.5, SLOTS[id][1]];
const WIDE = { pos: [0, 2.35, 10.6], look: [0, 1.15, -0.9], fov: 36 };
const WIDE_L = { pos: [-2.6, 2.3, 10.2], look: [-0.2, 1.15, -0.9], fov: 36 }, WIDE_R = { pos: [2.6, 2.3, 10.2], look: [0.2, 1.15, -0.9], fov: 36 };
const cues = [], camera = [{ t: 0, pos: [0, 3.2, 14], look: [0, 1.1, -0.9], fov: 36 }, { t: 3, ...WIDE, ease: 'inOut' }], beats = [], speakers = [];
const others = (id) => ALL.filter((x) => x !== id);
cues.push({ t: 0, who: 'guide', do: 'sketchOn' }, { t: 0.2, who: 'front', do: 'wave', stagger: 0.12 }, { t: 0.3, who: 'anchor', do: 'straightenTie' }, { t: 0.5, who: 'holo', do: 'scanSweep' });
for (const s of segs) {
  const len = s.end - s.start, mid = s.start + len / 2;
  speakers.push({ who: s.who, from: s.start, to: s.end });
  cues.push({ t: s.start, who: s.who, do: 'speak', track: 'bulletin', offset: s.start, dur: +len.toFixed(3) });
  cues.push({ t: s.start + 0.1, who: others(s.who), do: 'lookAt', target: head(s.who), dur: Math.min(2.4, len - 0.2), stagger: 0.03 });
  for (const w of s.words || []) if (/\d/.test(w.w)) cues.push({ t: w.start, who: s.who, do: 'nod', amount: 0.6 });
  if (s.kind === 'open') { cues.push({ t: s.start + 0.4, who: 'anchor', do: 'expression', name: 'smile', dur: len }); beats.push({ t: s.start, title: 'Today' }); }
  if (s.kind === 'line' && s.place === 'Portugal') {
    beats.push({ t: s.start, title: 'Portugal: storm warnings' });
    camera.push({ t: s.start, focus: 'holo', cut: true, dist: 6.2, h: 0.55, lh: 0.4, orbit: -14 });
    cues.push({ t: s.start + 0.2, who: 'holo', do: 'present', dur: 2.2 }, { t: s.start + 0.4, who: others('holo'), do: 'expression', name: 'concerned', dur: len - 0.6, stagger: 0.04 });
    const red = (s.words.find((w) => /^red\b/.test(w.w)) || { start: mid }).start;
    cues.push({ t: red, who: BOTS, do: 'flinch', stagger: 0.07 }, { t: red, who: 'teletext', do: 'pageFlip' }, { t: red + 0.2, who: 'conductor', do: 'clockSpin', turns: 2 }, { t: red + 0.1, who: 'owl', do: 'wingFlap', times: 3 });
    camera.push({ t: mid + 0.6, ...WIDE_L, ease: 'inOut' });
    cues.push({ t: s.end - 1.2, who: 'holo', do: 'glitch' });
  }
  if (s.kind === 'line' && s.place === 'Lisbon') {
    beats.push({ t: s.start, title: 'Lisbon: rain warning' });
    camera.push({ t: s.start, focus: 'rowan', cut: true, dist: 5.6, h: 0.55, lh: 0.4, orbit: 18 });
    cues.push({ t: s.start + 0.2, who: 'rowan', do: 'holdUp', dur: 2.4 }, { t: s.start + 0.5, who: HUMANS.filter((h) => h !== 'rowan'), do: 'lookAt', target: [0, 6, -4], dur: 1.8, stagger: 0.08 });
    cues.push({ t: s.start + 1.0, who: 'cube', do: 'bounce', times: 2 }, { t: s.start + 1.2, who: 'researcher', do: 'magnify' }, { t: s.start + 1.6, who: 'caretaker', do: 'keyJingle' }, { t: mid, who: ['agent', 'guide', 'anchor'], do: 'shrug', stagger: 0.1 });
    camera.push({ t: mid + 0.4, ...WIDE_R, ease: 'inOut' });
    cues.push({ t: s.end - 1.4, who: 'agent', do: 'antennaSpark' });
  }
  if (s.kind === 'line' && s.place === 'London') {
    beats.push({ t: s.start, title: 'London: dry and cold' });
    camera.push({ t: s.start, focus: 'realist', cut: true, dist: 5.8, h: 0.55, lh: 0.4, orbit: -8 });
    cues.push({ t: s.start + 0.3, who: 'realist', do: 'openPalms', dur: 2 }, { t: s.start + 0.6, who: ['guide', 'anchor'], do: 'think', stagger: 0.2 }, { t: mid - 0.4, who: 'owl', do: 'headTurn270' });
    cues.push({ t: mid, who: 'cube', do: 'hop', height: 0.3 }, { t: mid + 0.3, who: ['conductor', 'researcher'], do: 'thumbsUp', stagger: 0.15 });
    camera.push({ t: mid + 0.5, ...WIDE, ease: 'inOut' });
  }
  if (s.kind === 'close') {
    beats.push({ t: s.start, title: 'Made by agents' });
    camera.push({ t: s.start, ...WIDE, cut: true });
    cues.push({ t: s.start + 0.2, who: ALL, do: 'expression', name: 'delighted', dur: len, stagger: 0.02 }, { t: s.start + 0.3, who: BOTS.concat(['owl', 'cube']), do: 'celebrate', stagger: 0.08 });
    cues.push({ t: s.start + 0.4, who: HUMANS.filter((h) => h !== 'anchor'), do: 'wave', stagger: 0.1 }, { t: Math.max(s.start + 1, s.end - 2.3), who: 'anchor', do: 'bow' });
  }
}
cues.sort((a, b) => a.t - b.t);
writeJSON(join(DIR, 'cast.json'), { about: `Direction of the twelve version 2 presenters for the bulletin of ${day}: who speaks which story, how the others react, and the camera. Written by bulletins/bulletin-v2.mjs.`,
  slots: SLOTS, speakers, tracks: { bulletin: { duration: +duration.toFixed(3), mouthCues, note: 'From the voice\'s loudness, not Rhubarb: an approximation of lip-sync.' } },
  chor: { version: '2.0.0-bulletin', duration: +duration.toFixed(3), fps: FPS, auto: { idle: true, blink: true, fidget: false }, groups: { front: ['agent', 'conductor', 'owl', 'researcher', 'caretaker', 'cube'], all: ALL }, beats, camera, cues } });

// 5. Render: split.html in WORKERS browsers, each a contiguous range of frames, every frame timed per half.
const PORT = 8796;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: join(ROOT, 'src'), stdio: 'ignore' });
const tmp = mkdtempSync(join(tmpdir(), 'bulletinv2-'));
const OUT = join(DIR, `bulletin-${day}.mp4`);
try {
  await new Promise((r) => setTimeout(r, 900));
  const { chromium } = createRequire(import.meta.url)('playwright');
  const frames = await phase(`render ${n} frames (${WORKERS} browsers)`, async () => {
    const per = Math.ceil(n / WORKERS), all = [];
    await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
      const ts = performance.now();
      await p.goto(`http://127.0.0.1:${PORT}/lab/bulletin-v2/split.html`, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => window.splitReady === true, null, { timeout: 60000 });
      all.push({ worker: w, startup_s: +((performance.now() - ts) / 1000).toFixed(2), chromium: b.version() });
      const el = await p.$('#split');
      for (let f = w * per; f < Math.min(n, (w + 1) * per); f++) {
        const tm = await p.evaluate((t) => window.renderSplit(t), f / FPS);
        const s0 = performance.now(); await el.screenshot({ path: join(tmp, `f${String(f).padStart(5, '0')}.png`) });
        all.push({ f, left_ms: tm.left, right_ms: tm.right, shot_ms: +(performance.now() - s0).toFixed(1) });
      }
      await b.close();
    }));
    return all;
  });
  const startups = frames.filter((x) => x.worker != null), per = frames.filter((x) => x.f != null);
  const dist = (k) => { const v = per.map((x) => x[k]).sort((a, b) => a - b), q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]; return { min: +v[0].toFixed(1), p50: +q(0.5).toFixed(1), p90: +q(0.9).toFixed(1), p99: +q(0.99).toFixed(1), max: +v[v.length - 1].toFixed(1), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) }; };
  stats.render = { frames: n, fps: FPS, size: '1280x720 (two halves of 640x720)', workers: WORKERS, chromium: startups[0]?.chromium, browser_startup_s: startups.map((x) => x.startup_s),
    left_v1_stage_ms: dist('left_ms'), right_v2_cast_ms: dist('right_ms'), screenshot_ms: dist('shot_ms'),
    slowest_frames: per.slice().sort((a, b) => b.right_ms - a.right_ms).slice(0, 5).map((x) => ({ t: +(x.f / FPS).toFixed(2), right_ms: x.right_ms })) };
  await phase('encode (ffmpeg H.264 + AAC)', () => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%05d.png'), '-i', M4A,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-metadata', `comment=${LABEL}. Synthetic presenters and synthetic voice.`, OUT]));
} finally { srv.kill(); rmSync(tmp, { recursive: true, force: true }); }
copyFileSync(OUT, join(DIR, 'bulletin-latest.mp4'));

// 6. Stats and the page.
const total = stats.phases.reduce((a, p) => a + p.wall_s, 0);
stats.finished = new Date().toISOString();
stats.output = { video: `bulletin-${day}.mp4`, video_bytes: statSync(OUT).size, voice_bytes: statSync(M4A).size, duration_s: +duration.toFixed(2), script_words: script.split(/\s+/).length };
stats.total_wall_s = +total.toFixed(2);
stats.realtime_factor = +(total / duration).toFixed(1);
stats.stories = picks.map((p) => ({ place: p.place, page: `P${p.page}`, presenter: p.who, text: p.text, facts: p.facts.map((f) => f.id) }));
writeJSON(join(DIR, `stats-${day}.json`), stats);
const row = (k, d) => `<tr><td>${esc(k)}</td><td>${d.min}</td><td>${d.p50}</td><td>${d.p90}</td><td>${d.p99}</td><td>${d.max}</td><td>${d.mean}</td></tr>`;
const NAMES = { holo: 'Tejo', rowan: 'Rowan', realist: 'Rui', anchor: 'Duarte' };
writeFileSync(join(DIR, 'index.html'), `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Video bulletin, version 2 presenters: PrompTugal.news Bulletins</title>
<meta name="description" content="The day's 30-second video bulletin: checked stories from Portugal, Lisbon and London, the animated bulletin on the left and twelve synthetic presenters on the right, with full performance stats. ${esc(LABEL)}.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>body{margin:0;background:#000;color:#eee;font:16px/1.5 "DejaVu Sans",sans-serif}.wrap{max-width:1280px;margin:0 auto;padding:16px}h1,h2{font-family:"DejaVu Sans Mono",monospace;color:#ff0}video{width:100%;height:auto;border:2px solid #4a7dff}
table{border-collapse:collapse;font-size:14px;margin:8px 0}td,th{border:1px solid #333;padding:4px 8px;text-align:left}th{background:#111a26;color:#ff0}a{color:#7cf}.dim{color:#9aa;font-size:13px}</style></head><body><div class="wrap">
<h1>Video bulletin, ${esc(day)}: version 2 presenters</h1>
<video controls preload="metadata" src="bulletin-${esc(day)}.mp4"></video>
<p class="dim">${esc(LABEL)}. Left: the animated bulletin (version 1's stage). Right: the twelve version 2 presenters; the one speaking is highlighted. Voices and presenters are synthetic; no presenter is the likeness of a real person. The words are the pages' checked sentences, read word for word (the voice's own transcript was checked against the script). Mouth shapes follow the voice's loudness, an approximation, not phoneme lip-sync.</p>
<h2>The stories</h2><table><tr><th>Place</th><th>Page</th><th>Presenter</th><th>Checked sentence</th><th>Facts</th></tr>${picks.map((p) => `<tr><td>${esc(p.place)}</td><td><a href="../../${esc(p.page)}/">P${esc(p.page)}</a></td><td>${esc(NAMES[p.who] || p.who)}</td><td>${esc(p.text)}</td><td>${esc(p.facts.map((f) => f.id).join(', '))}</td></tr>`).join('')}</table>
<h2>How long it took</h2><p>On ${esc(stats.machine.cpus)} CPU cores (${esc(stats.machine.cpu || '')}), ${esc(stats.machine.mem_gb)} GB, ${esc(stats.machine.gpu)}; Node ${esc(stats.machine.node)}, Chromium ${esc(stats.render.chromium || '')}.</p>
<table><tr><th>Phase</th><th>Wall (s)</th><th>Node CPU (s)</th></tr>${stats.phases.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.wall_s}</td><td>${p.node_cpu_s}</td></tr>`).join('')}<tr><th>Total</th><th>${stats.total_wall_s}</th><th></th></tr></table>
<p>${stats.output.duration_s} s of video in ${stats.total_wall_s} s: ${stats.realtime_factor} × real time. Voice: ${esc(String(stats.voice?.cost_usd ?? ''))} USD, ${esc(String(stats.voice?.latency_s ?? ''))} s from OpenRouter${stats.voice?.reused ? ' (reused from the first run)' : ''}. Video ${(stats.output.video_bytes / 1e6).toFixed(1)} MB.</p>
<h2>Each frame (milliseconds)</h2><table><tr><th>Step</th><th>min</th><th>p50</th><th>p90</th><th>p99</th><th>max</th><th>mean</th></tr>${row('Left half: draw (version 1 stage)', stats.render.left_v1_stage_ms)}${row('Right half: draw (twelve version 2 presenters, software WebGL)', stats.render.right_v2_cast_ms)}${row('Photograph the frame', stats.render.screenshot_ms)}</table>
<p class="dim">${stats.render.frames} frames at ${stats.render.fps} fps, ${esc(stats.render.size)}, ${stats.render.workers} browsers in parallel (start-up ${esc(stats.render.browser_startup_s.join(', '))} s). All numbers: <a href="stats-${esc(day)}.json">stats-${esc(day)}.json</a>. Direction: <a href="cast.json">cast.json</a>; timeline: <a href="timeline.json">timeline.json</a>; the split page: <a href="split.html">split.html</a>. Made by bulletins/bulletin-v2.mjs.</p>
</div></body></html>\n`);
console.log(`bulletin v2: ${OUT.replace(ROOT + '/', '')} (${duration.toFixed(1)} s) in ${total.toFixed(1)} s`);
