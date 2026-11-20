// A 30-second landscape video bulletin (Dinis, 20 Nov 2026: "lets try 30secs, landscape to start and use models from
// open router to create the voice"). An experiment for the lab, not yet on the pages.
// 1. Words: only sentences the check already kept for the page (data/scripts/<page>.json), with a fixed opening and
//    closing; dates and units are put into spoken form by code, never by a model.
// 2. Voice: OpenRouter's openai/gpt-audio-mini, a stock voice ("alloy"), told to read the text word for word. The
//    model's own transcript of what it said must match the script word for word, or nothing is published. The video
//    says the voice is synthetic. Every call is in the ledger; the day's cap and the per-call ceiling apply.
// 3. Picture: teletext frames rendered with Playwright (one per sentence, with its source), joined with ffmpeg.
// Output: src/lab/video/<page>.mp4, <page>.json (script, sources, model, cost) and index.html.
// Run: node bulletins/video.mjs [page]   (OPEN_ROUTER_KEY from the environment only)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, readJSON, writeJSON, spentToday, record, DAILY_CAP_USD, clean, esc } from './core.mjs';
import { LABEL } from './render.mjs';

const PAGE = process.argv[2] || '200';
const MODEL = 'openai/gpt-audio-mini', VOICE = 'alloy';
const CEILING = 0.05;
const TITLES = { 100: 'Portugal', 200: 'The Algarve', 300: 'Lisbon', 400: 'Summit and tech', 500: 'Weather', 600: 'Data', 700: 'London', 800: 'Our newsroom' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Spoken form, by rule: 2026-11-21 -> 21 November; 20.5 °C -> 20.5 degrees; 100% -> 100 percent; SW -> south-west.
const WIND = { N: 'north', S: 'south', E: 'east', W: 'west', NE: 'north-east', NW: 'north-west', SE: 'south-east', SW: 'south-west' };
const spoken = (t) => t
  .replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => `${+d} ${MONTHS[+m - 1]}`)
  .replace(/(\d{2}):(\d{2})/g, (_, h, m) => `${+h}:${m}`)
  .replace(/\s?°C/g, ' degrees').replace(/(\d)%/g, '$1 percent')
  .replace(/\bfrom (N|S|E|W|NE|NW|SE|SW)\b/g, (_, w) => `from the ${WIND[w]}`)
  .replace(/(\d) to (\d)/g, '$1 to $2');

const s = readJSON(join(ROOT, 'data', 'scripts', `${PAGE}.json`), null);
if (!s?.kept?.length) throw new Error(`no kept sentences for P${PAGE}`);
const byId = new Map((s.facts || []).map((f) => [f.id, f]));
// About 30 seconds: an opening, up to three sentences of no more than 48 words (the voice reads about 2.3 words a second), a closing.
const chosen = [];
for (const k of s.kept) { const w = chosen.reduce((a, x) => a + x.text.split(/\s+/).length, 0); if (chosen.length < 3 && w + k.text.split(/\s+/).length <= 48) chosen.push(k); }
const day = (s.written || '').slice(0, 10);
const segs = [
  { kind: 'open', show: `P${PAGE} ${TITLES[PAGE]}`, say: `PrompTugal dot news bulletins. Page ${PAGE}, ${TITLES[PAGE]}, ${spoken(day)}.` },
  ...chosen.map((k) => ({ kind: 'line', show: k.text, say: spoken(k.text), facts: k.facts, sources: (k.facts || []).map((id) => byId.get(id)).filter(Boolean).map((f) => ({ id: f.id, source: f.source, origin: f.origin, licence: f.licence?.name, by: f.by })) })),
  { kind: 'close', show: `${LABEL}. Voice: synthetic.`, say: 'Made by agents from PrompTugal dot news data. This voice is synthetic.' },
];
const script = segs.map((x) => x.say).join(' ');

// The voice, streamed (OpenRouter's audio output is streamed as base64 PCM16 at 24 kHz, with a transcript).
async function speak(text) {
  if (spentToday() + CEILING > DAILY_CAP_USD) throw new Error(`daily cap of ${DAILY_CAP_USD} USD reached`);
  const key = process.env.OPEN_ROUTER_KEY;
  if (!key) throw new Error('OPEN_ROUTER_KEY is not in the environment');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(180000),
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'PrompTugal.news bulletins' },
    body: JSON.stringify({ model: MODEL, stream: true, modalities: ['text', 'audio'], audio: { voice: VOICE, format: 'pcm16' }, usage: { include: true },
      messages: [{ role: 'system', content: 'You are a text-to-speech reader for a news bulletin. Read the user message aloud exactly as written, word for word, in a calm, clear newsreader voice. Add nothing, leave nothing out, change nothing.' },
        { role: 'user', content: text }] }),
  });
  if (!res.ok) { const b = await res.text().catch(() => ''); record({ at: new Date().toISOString(), what: `video voice for P${PAGE}`, provider: 'openrouter', model: MODEL, http: res.status, cost_usd: 0 }); throw new Error(`OpenRouter HTTP ${res.status}: ${clean(b, 160)}`); }
  const pcm = [], words = []; let usage = null, buf = '';
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const d = line.slice(5).trim(); if (d === '[DONE]') continue;
      let j; try { j = JSON.parse(d); } catch { continue; }
      const a = j.choices?.[0]?.delta?.audio;
      if (a?.data) pcm.push(Buffer.from(a.data, 'base64'));
      if (a?.transcript) words.push(a.transcript);
      if (j.usage) usage = j.usage;
    }
  }
  const reported = Number(usage?.cost);
  const cost = Number.isFinite(reported) ? reported : CEILING;
  record({ at: new Date().toISOString(), what: `video voice for P${PAGE}`, provider: 'openrouter', model: MODEL, http: res.status,
    prompt_tokens: usage?.prompt_tokens, completion_tokens: usage?.completion_tokens, cost_usd: cost, ...(Number.isFinite(reported) ? {} : { estimated: true }) });
  return { pcm: Buffer.concat(pcm), transcript: words.join(''), cost };
}

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const { pcm, transcript, cost } = await speak(script);
const same = norm(transcript) === norm(script);
const seconds = pcm.length / 2 / 24000;
console.log(`voice: ${seconds.toFixed(1)} s, ${cost.toFixed(6)} USD, transcript ${same ? 'matches' : 'DOES NOT match'} the script`);
if (!same) { console.log('script:     ' + norm(script)); console.log('transcript: ' + norm(transcript)); throw new Error('the voice did not read the script word for word: nothing published'); }
if (seconds < 5 || seconds > 36) throw new Error(`the audio is ${seconds.toFixed(1)} s long: nothing published`);

// Frames: one per segment, timed by its share of the words.
const tmp = mkdtempSync(join(tmpdir(), 'video-'));
writeFileSync(join(tmp, 'voice.pcm'), pcm);
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const css = `html,body{margin:0;background:#000;color:#fff;font:28px/1.45 'DejaVu Sans Mono',monospace}.f{width:1280px;height:720px;box-sizing:border-box;padding:48px 72px;display:flex;flex-direction:column}
.bar{display:flex;justify-content:space-between;color:#ff0;border-bottom:4px solid #4a7dff;padding-bottom:12px;font-weight:700}.bar b{color:#fff}
.main{flex:1;display:flex;align-items:center}.big{font-size:64px;color:#ff0;font-weight:700}.line{font-size:36px}.src{color:#9aa;font-size:20px;margin-top:18px}
.lab{display:inline-block;background:#4a7dff;color:#000;font-weight:700;padding:4px 12px;font-size:24px}.foot{display:flex;justify-content:space-between;color:#9aa;font-size:20px}`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const total = segs.reduce((a, x) => a + x.say.split(/\s+/).length, 0);
const list = [];
for (const [i, x] of segs.entries()) {
  const hosts = [...new Set((x.sources || []).map((f) => { try { return new URL(f.origin || f.source).hostname; } catch { return null; } }).filter(Boolean))];
  const src = x.sources?.length ? `<div class="src">Source: ${esc(hosts.join(', '))}, read through data.promptugal.news; facts ${esc(x.sources.map((f) => f.id).join(', '))}; licence: ${esc([...new Set(x.sources.map((f) => f.licence).filter(Boolean))].join(', '))}</div>` : '';
  const main = x.kind === 'line' ? `<div><div class="line">${esc(x.show).replace(/\d{4}-\d{2}-\d{2}/g, (d) => `<span style="white-space:nowrap">${d}</span>`)}</div>${src}</div>` : `<div><div class="big">${esc(x.show)}</div>${x.kind === 'open' ? `<p><span class="lab">${esc(LABEL)}</span></p>` : '<p class="src">bulletins.promptugal.news</p>'}</div>`;
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div class="f"><div class="bar"><span><b>P${esc(PAGE)}</b> PrompTugal.news Bulletins</span><span>${esc(day)}</span></div><div class="main">${main}</div><div class="foot"><span>${esc(LABEL)}</span><span>Voice: synthetic (${esc(MODEL)}, ${esc(VOICE)})</span></div></div>`);
  await p.screenshot({ path: join(tmp, `f${i}.png`) });
  list.push(`file '${join(tmp, `f${i}.png`)}'\nduration ${(seconds * x.say.split(/\s+/).length / total).toFixed(3)}`);
}
await b.close();
writeFileSync(join(tmp, 'list.txt'), list.join('\n') + `\nfile '${join(tmp, `f${segs.length - 1}.png`)}'\n`);
const out = join(ROOT, 'src', 'lab', 'video'); mkdirSync(out, { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', join(tmp, 'voice.pcm'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', '-metadata', `comment=${LABEL}. Synthetic voice (${MODEL}).`, join(out, `${PAGE}.mp4`)]);
rmSync(tmp, { recursive: true, force: true });
writeJSON(join(out, `${PAGE}.json`), { page: PAGE, made: new Date().toISOString().slice(0, 16) + 'Z', from: `data/scripts/${PAGE}.json written ${s.written}`, label: LABEL,
  voice: { model: MODEL, voice: VOICE, synthetic: true, note: 'A stock voice, not a clone of any person.' }, seconds: Number(seconds.toFixed(1)), cost_usd: cost,
  transcript_matches_script: same, script, segments: segs.map(({ kind, show, say, facts, sources }) => ({ kind, show, say, facts, sources })) });
writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Video bulletin trial: PrompTugal.news Bulletins</title>
<meta name="description" content="A 30-second landscape video bulletin, a trial: checked sentences read by a synthetic voice. ${esc(LABEL)}.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>body{background:#000;color:#fff;font:16px/1.5 monospace;max-width:900px;margin:0 auto;padding:16px}h1{color:#ff0}video{width:100%;height:auto;border:2px solid #4a7dff}a{color:#7cf}.dim{color:#9aa}</style></head><body>
<h1>Video bulletin, a trial</h1><p>P${esc(PAGE)} ${esc(TITLES[PAGE])}, ${esc(day)}: ${Number(seconds.toFixed(1))} seconds, landscape. ${esc(LABEL)}.</p>
<video controls preload="metadata" src="${esc(PAGE)}.mp4"></video>
<p class="dim">The words are the page's checked sentences, put into spoken form by rule. The voice is synthetic: ${esc(MODEL)} through OpenRouter, the stock voice "${esc(VOICE)}", and its transcript matched the script word for word. Voice cost ${esc(cost.toFixed(6))} USD. Every sentence's sources: <a href="${esc(PAGE)}.json">${esc(PAGE)}.json</a>, and <a href="../../${esc(PAGE)}/">the page itself</a>.</p></body></html>\n`);
console.log(`video: src/lab/video/${PAGE}.mp4 (${seconds.toFixed(1)} s)`);
