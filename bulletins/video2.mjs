// The animated video bulletin with a presenter (Dinis, 20 Nov 2026: "add a lot more animations and interactivity ...
// let's create an avatar"). An experiment for the lab. No model call: it reuses the voice already made and checked by
// bulletins/video.mjs (src/lab/video/<page>.mp4 and <page>.json), so it costs nothing.
// - timeline.json: the segments with word timings (by each segment's share of the spoken words, then by word length),
//   the bars to grow (every "N °C in Place" in a sentence), the voice's loudness every 1/25 s (for the presenter's
//   mouth), the map's places, the label.
// - stage.html + stage.js: every frame a pure function of t. play.html: the same stage driven by the audio, with each
//   sentence clickable and its facts linked. <page>-animated.mp4: the stage captured at 25 frames a second by
//   Playwright and joined with the voice by ffmpeg.
// The presenter is an original pixel character drawn in code, labelled "Synthetic presenter": no one's likeness.
// Run: node bulletins/video2.mjs [page]
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, readJSON, writeJSON } from './core.mjs';
import { LABEL } from './render.mjs';
import { MAP_DATA, MAP_DIR } from './map.mjs';

const PAGE = process.argv[2] || '200', FPS = 25;
const DIR = join(ROOT, 'src', 'lab', 'video');
const v = readJSON(join(DIR, `${PAGE}.json`), null);
if (!v?.transcript_matches_script) throw new Error(`no checked voice for P${PAGE}: run bulletins/video.mjs ${PAGE} first`);

// The voice's samples, from the checked MP4 (24 kHz mono), and its loudness per frame, scaled 0..1.
const pcm = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', join(DIR, `${PAGE}.mp4`), '-vn', '-f', 's16le', '-ac', '1', '-ar', '24000', '-'], { maxBuffer: 64 << 20 });
const per = 24000 / FPS, n = Math.floor(pcm.length / 2 / per), amp = [];
for (let f = 0; f < n; f++) { let s = 0; for (let i = 0; i < per; i++) { const x = pcm.readInt16LE((f * per + i) * 2) / 32768; s += x * x; } amp.push(Math.sqrt(s / per)); }
const peak = Math.max(...amp) || 1;
const ampN = amp.map((a) => Number(Math.min(1, (a / peak) * 1.4).toFixed(3)));
const duration = n / FPS;

// Segments and word timings.
const segs = v.segments, total = segs.reduce((a, s) => a + s.say.split(/\s+/).length, 0);
let t0 = 0;
const out = segs.map((s) => {
  const len = duration * s.say.split(/\s+/).length / total, start = t0; t0 += len;
  const words = s.show.split(/\s+/).filter(Boolean), chars = words.reduce((a, w) => a + w.length + 1, 0);
  let c = 0;
  const wt = words.map((w) => { const at = start + 0.15 + (len - 0.4) * c / chars; c += w.length + 1; return { w, start: Number(at.toFixed(3)) }; });
  const bars = [];
  if (s.kind === 'line') for (const m of s.show.matchAll(/(-?\d+(?:\.\d+)?) °C in ([A-Z][\p{L}]+)/gu)) {
    const word = words.findIndex((w, i) => w === m[1] && !bars.some((b) => b.word === i));
    bars.push({ v: +m[1], place: m[2], word });
  }
  const hosts = [...new Set((s.sources || []).map((f) => { try { return new URL(f.origin || f.source).hostname; } catch { return null; } }).filter(Boolean))];
  const src = s.sources?.length ? `Source: ${hosts.join(', ')}, read through data.promptugal.news; facts ${s.sources.map((f) => f.id).join(', ')}` : '';
  const links = (s.sources || []).filter((f) => /^https:\/\//.test(f.source || '')).map((f) => ({ id: f.id, url: f.source }));
  return { kind: s.kind, show: s.show, start: Number(start.toFixed(3)), end: Number((start + len).toFixed(3)), words: wt, bars, src, links };
});
const barMax = Math.max(25, ...out.flatMap((s) => s.bars.map((b) => b.v)));
writeJSON(join(DIR, 'timeline.json'), { page: PAGE, day: v.segments[0].show && v.made.slice(0, 10), duration: Number(duration.toFixed(3)), fps: FPS, label: LABEL, voice: `${v.voice.model}, ${v.voice.voice}`,
  ticker: `P${PAGE} · ${out.filter((s) => s.kind === 'line').map((s) => s.show).join('  ·  ')}`, barMax, places: MAP_DATA.places, current: 'faro', london: MAP_DATA.london, segs: out, amp: ampN });

// The stage page (for capture) and the player page (for people).
const css = `*{box-sizing:border-box}body{margin:0;background:#000;color:#fff;font-family:'DejaVu Sans Mono',monospace}
#stage{position:relative;width:1280px;height:720px;overflow:hidden;background:#02060c;background-image:linear-gradient(rgba(74,125,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(74,125,255,.09) 1px,transparent 1px);background-size:64px 64px}
.bar{position:absolute;left:56px;right:56px;top:32px;display:flex;justify-content:space-between;color:#ff0;font:700 28px 'DejaVu Sans Mono',monospace;border-bottom:4px solid #4a7dff;padding-bottom:10px;z-index:3}.bar b{color:#fff}
.main{position:absolute;left:56px;top:96px;width:820px;height:440px;z-index:2}.scene{position:absolute;inset:0;flex-direction:column;justify-content:center;display:none}
.title{font:700 72px 'DejaVu Sans Mono',monospace;color:#ff0}.title span{display:inline-block;white-space:pre}.title.small{font-size:28px;color:#9aa;margin-top:12px}
.chip{display:inline-block;align-self:flex-start;margin-top:28px;background:#4a7dff;color:#000;font:700 26px 'DejaVu Sans Mono',monospace;padding:6px 14px}
.line{font:34px/1.5 'DejaVu Sans Mono',monospace}.w{display:inline-block;white-space:pre;transform-origin:50% 70%}.num{color:#ff0;font-weight:700}
.src{color:#9aa;font-size:18px;margin-top:18px}.bars{margin-top:18px}.brow{display:flex;align-items:center;gap:12px;margin:6px 0;font-size:22px}.bn{width:130px}.bf{display:inline-block;height:22px;background:linear-gradient(90deg,#30d5ff,#ff0);width:0}.bv{color:#ff0;width:110px}
.mapbox{height:420px}.mapbox svg.ptm{width:auto;height:420px;max-width:none}
.rain{position:absolute;inset:0;z-index:1;opacity:0;pointer-events:none}.rain span{position:absolute;color:#30d5ff;font-size:22px}
.side{position:absolute;right:48px;top:96px;width:300px;height:440px;text-align:center;z-index:3;border:1px solid rgba(48,213,255,.5);background:radial-gradient(ellipse at 50% 80%,rgba(48,213,255,.22),transparent 70%)}.av{width:270px;height:auto;margin-top:12px;filter:drop-shadow(0 0 8px #30d5ff) drop-shadow(0 0 22px rgba(27,109,255,.7))}.avl{position:absolute;left:0;right:0;bottom:0;padding:6px;background:rgba(48,213,255,.15);border-top:2px solid #30d5ff;color:#bff7ff;font-size:15px}
.wipe{position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);z-index:5;pointer-events:none}.wipe i{background:#4a7dff;opacity:0}
.foot{position:absolute;left:0;right:0;bottom:40px;height:34px;background:#ff0;color:#000;overflow:hidden;z-index:4}.tick{white-space:nowrap;font:700 22px/34px 'DejaVu Sans Mono',monospace}
.sub{position:absolute;left:120px;right:120px;bottom:86px;text-align:center;font:26px/1.3 'DejaVu Sans',sans-serif;color:#fff;z-index:4}.sub{text-shadow:0 0 6px #000,0 0 2px #000;background:rgba(0,0,0,.55);padding:4px 10px}
.chap{position:absolute;left:0;right:0;bottom:36px;height:4px;z-index:5}.chap i{position:absolute;width:3px;height:8px;top:-2px;background:#ff0}.count{position:absolute;right:56px;bottom:8px;color:#ff0;font:700 16px 'DejaVu Sans Mono',monospace;z-index:4}
.half #stage{width:640px;height:720px}.half .bar{left:24px;right:24px;font-size:20px}.half .main{left:24px;top:84px;width:592px;height:470px}.half .side{display:none}
.half .title{font-size:46px}.half .title.small{font-size:20px}.half .chip{font-size:17px}.half .line{font-size:27px}.half .src{font-size:14px}.half .brow{font-size:17px}.half .bn{width:96px}.half .bv{width:84px}
.half .mapbox{height:400px}.half .mapbox svg.ptm{height:400px}.half .sub{left:24px;right:24px;bottom:84px;font-size:19px}.half .lab{left:24px;right:90px;font-size:10px}.half .count{right:24px;font-size:13px}.half .tick{font-size:17px}
.prog{position:absolute;left:0;bottom:36px;height:4px;background:#4a7dff;z-index:4;width:0}.lab{position:absolute;left:56px;right:160px;bottom:8px;color:#9aa;font-size:16px;z-index:4}`;
const head = (title, desc) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<meta name="description" content="${desc}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'">
<link rel="stylesheet" href="../../${MAP_DIR}/ptmap.css"><script src="../../${MAP_DIR}/ptmap.js"></script><style>${css}`;
const desc = 'The animated video bulletin, a trial: checked sentences, a synthetic voice and a synthetic presenter. Made by agents from PrompTugal.news&#39;s data.';
writeFileSync(join(DIR, 'stage.html'), `${head('Video bulletin stage: PrompTugal.news Bulletins', desc)}</style></head><body><div id="stage"></div><script src="stage.js"></script></body></html>\n`);
writeFileSync(join(DIR, 'play.html'), `${head('Video bulletin player: PrompTugal.news Bulletins', desc)}
.wrap{max-width:1280px;margin:0 auto;padding:16px}.fit{width:100%;aspect-ratio:16/9;position:relative;overflow:hidden}.fit #stage{transform-origin:0 0;position:absolute}
h1{color:#ff0;font-size:22px}audio{width:100%;margin:10px 0}#segs{list-style:none;padding:0}#segs li{margin:6px 0;color:#9aa}#segs button{background:none;border:1px solid #333;color:#fff;font:inherit;text-align:left;padding:6px 10px;cursor:pointer;width:100%}#segs li.on button{border-color:#ff0;color:#ff0}#segs a{color:#7cf;font-size:14px}.dim{color:#9aa}a{color:#7cf}
</style><script src="play-fit.js" defer></script></head><body><div class="wrap"><h1>P${PAGE} video bulletin, animated, with a presenter (a trial)</h1>
<div class="fit" id="fit"><div id="stage"></div></div>
<audio id="voice" controls preload="auto" src="${PAGE}.m4a"></audio>
<p class="dim">Click a sentence to jump to it; the ids link to the facts it rests on. The voice is synthetic (${v.voice.model}, "${v.voice.voice}") and read our checked sentences word for word; the presenter is an original pixel character drawn in code, not anyone's likeness. The same scenes as a video: <a href="${PAGE}-animated.mp4">${PAGE}-animated.mp4</a>.</p>
<ol id="segs"></ol></div><script src="stage.js"></script></body></html>\n`);
writeFileSync(join(DIR, 'play-fit.js'), `/* Scales the 1280x720 stage to the width of its box. */\n(function(){function fit(){var b=document.getElementById('fit'),s=document.getElementById('stage');if(!b||!s)return;s.style.transform='scale('+(b.clientWidth/1280)+')';}window.addEventListener('resize',fit);fit();setInterval(fit,500);})();\n`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(DIR, `${PAGE}.mp4`), '-vn', '-c:a', 'copy', join(DIR, `${PAGE}.m4a`)]);

// Capture: serve src/ locally, step t frame by frame, screenshot, join with the voice.
const srv = spawn('python3', ['-m', 'http.server', '8799', '--bind', '127.0.0.1'], { cwd: join(ROOT, 'src'), stdio: 'ignore' });
const tmp = mkdtempSync(join(tmpdir(), 'video2-'));
try {
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = createRequire(import.meta.url)('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
  await p.goto(`http://127.0.0.1:8799/lab/video/stage.html`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.stageReady === true, null, { timeout: 15000 });
  const stage = await p.$('#stage');
  for (let f = 0; f < n; f++) {
    await p.evaluate((t) => window.renderAt(t), f / FPS);
    await stage.screenshot({ path: join(tmp, `f${String(f).padStart(5, '0')}.png`) });
  }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%05d.png'), '-i', join(DIR, `${PAGE}.m4a`),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-c:a', 'copy', '-shortest', '-movflags', '+faststart',
    '-metadata', `comment=${LABEL}. Synthetic voice (${v.voice.model}) and synthetic presenter.`, join(DIR, `${PAGE}-animated.mp4`)]);
} finally { srv.kill(); rmSync(tmp, { recursive: true, force: true }); }
console.log(`animated: src/lab/video/${PAGE}-animated.mp4 (${duration.toFixed(1)} s, ${n} frames), play.html`);
