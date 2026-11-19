// Step 6: publish each bulletin with its transcript, its sources list and its cost, as static
// pages in src/ (the build copies src/ to _site/). Every value from a fact or the model is escaped;
// links are shown only when safeLink() allows them. No scripts on the pages.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, esc, safeLink, writeJSON, readJSON, clean } from './core.mjs';
import { PAGES } from './pages.mjs';

const SITE = 'https://bulletins.promptugal.news';
export const LABEL = "Made by agents from PrompTugal.news's data";
export const fmt = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : '');
const src = (...p) => join(ROOT, 'src', ...p);

const CSS = `:root{--bg:#000;--fg:#fff;--y:#ff0;--c:#0ff;--g:#0f0;--r:#f55;--m:#f0f;--b:#58f;--dim:#bbb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.5 ui-monospace,"Cascadia Mono","DejaVu Sans Mono",Menlo,Consolas,monospace}
main{max-width:46rem;margin:0 auto;padding:1rem 16px 3rem}a{color:var(--c)}a:focus,a:hover{background:var(--c);color:#000}
.bar{display:flex;flex-wrap:wrap;gap:.2rem 1rem;justify-content:space-between;color:var(--y);border-bottom:2px solid var(--b);padding-bottom:.3rem}
.bar b{color:var(--fg)}h1{font-size:1.9rem;line-height:1.15;margin:.8rem 0 .2rem;color:var(--y);letter-spacing:.02em}
h2{font-size:1.05rem;color:var(--c);margin:1.6rem 0 .4rem;text-transform:uppercase;letter-spacing:.08em}
.label{display:inline-block;background:var(--b);color:#000;font-weight:700;padding:0 .4rem}.dim{color:var(--dim);font-size:.88rem}
ol.script{padding-left:1.4rem}ol.script li{margin:.35rem 0}sup a{font-size:.75rem;color:var(--g);text-decoration:none}
ul.src{padding-left:1.2rem;font-size:.9rem}ul.src li{margin:.4rem 0}ul.src .id{color:var(--g)}
.dropped{color:var(--r)}.live .v{color:var(--c)}.live.now .s{color:var(--g)}.stale,.live.stale .s{color:var(--r)}.index a{display:grid;grid-template-columns:4.2rem 1fr;gap:.6rem;padding:.35rem 0;text-decoration:none;color:var(--fg)}
.index a span:first-child{color:var(--y);font-weight:700}.index a:hover span{color:#000}
nav.fast{display:flex;flex-wrap:wrap;gap:.4rem 1rem;margin-top:2rem;border-top:2px solid var(--b);padding-top:.5rem}
nav.fast a:nth-child(4n+1){color:var(--r)}nav.fast a:nth-child(4n+2){color:var(--g)}nav.fast a:nth-child(4n+3){color:var(--y)}nav.fast a:nth-child(4n+4){color:var(--c)}`;

// The PrompTugal sites bar (vendored, pinned: see sitesbar.mjs). Set once per build with setBar().
let BAR = '';
export const setBar = (html) => { BAR = String(html || ''); };
const BAR_DIR = 'assets/sites-bar/1.1.1';

export function page({ title, description, path, body, depth }) {
  const up = depth ? '../'.repeat(depth) : './';
  const fast = Object.entries(PAGES).map(([n, p]) => `<a href="${up}${n}/">${n} ${esc(p.title)}</a>`).join('');
  // The bar's own script and stylesheet come from this host; its pop-up shows other PrompTugal sites'
  // /preview.svg and reads their /version.json, so img-src and connect-src name those hosts.
  const bar = (BAR ? `<link rel="stylesheet" href="${up}${BAR_DIR}/sites-bar.css">\n<script src="${up}${BAR_DIR}/sites-bar.js" defer></script>\n` : '')
    + `<script src="${up}assets/live.js" defer></script>\n`;
  // Live figures read data.promptugal.news only (live.js); the bar's pop-up reads the other sites' version.json.
  const csp = BAR
    ? "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://promptugal.news https://*.promptugal.news; connect-src https://promptugal.news https://*.promptugal.news; script-src 'self'; base-uri 'none'; form-action 'none'"
    : "default-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src https://data.promptugal.news; script-src 'self'; base-uri 'none'; form-action 'none'";
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
${bar}<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/preview.png">
<style>${CSS}</style>
</head>
<body>
${BAR}
<main>
${body}
<nav class="fast" aria-label="Pages"><a href="${up}">Index</a>${fast}<a href="${up}how/">How it is made</a><a href="${up}lab/">The lab</a></nav>
<p class="dim">${LABEL}. Part of <a href="https://promptugal.news/">PrompTugal.news</a>. Independent: not an official or government site; for weather warnings follow <a href="https://www.ipma.pt/">IPMA</a> and ANEPC. Free: this site carries no billing. Version __VERSION__. Code Apache-2.0; our text CC BY 4.0; each fact keeps its source's licence, linked beside it.</p>
</main>
</body>
</html>
`;
}

// The live strip: figures re-read in the browser from data.promptugal.news (live.js), built values as the fallback.
function liveStrip(items) {
  if (!items?.length) return '';
  return `<h2>Live figures</h2><ul class="src">${items.map((x) => {
    const l = x.licence?.url ? safeLink(x.licence.url) : null;
    return `<li data-live data-url="${esc(x.url)}" data-path="${esc(x.path)}" data-read-at-path="${esc(x.read_at_path)}" data-read-at="${esc(x.read_at)}" data-min="${esc(x.min)}" data-max="${esc(x.max)}" data-cadence-min="${esc(x.cadence_min)}" class="live"><b class="v">${esc(x.value)}</b> ${esc(x.label)}<br><span class="dim"><span class="s">built copy: read ${esc(fmt(x.read_at))}</span>; from ${esc(x.source)}; licence ${l ? `<a href="${esc(l)}">${esc(x.licence.name)}</a>` : esc(x.licence?.name || "the source's terms")}.</span></li>`;
  }).join('')}</ul><p class="dim">These figures are re-read from data.promptugal.news when the page opens and every five minutes; the bulletin above was written from the facts at its own time.</p>`;
}

function bulletinBody(n, p, facts, script, made, live) {
  const kept = script?.kept || [];
  const ref = (ids) => ids.map((id) => `<a href="#f-${esc(id)}">${esc(id)}</a>`).join(' ');
  const lines = !facts.length ? `<p>${esc(p.waiting || 'No facts for this page yet.')}</p>` : kept.length
    ? `<ol class="script">${kept.map((s) => `<li>${esc(s.text)} <sup>${ref(s.facts)}</sup></li>`).join('')}</ol>`
    : `<p class="dim">No checked script this hour: the facts below are the bulletin.</p><ol class="script">${facts.map((f) => `<li>${esc(f.text)} <sup>${ref([f.id])}</sup></li>`).join('')}</ol>`;
  const sources = facts.map((f) => {
    const s = safeLink(f.source), o = f.origin && f.origin !== f.source ? safeLink(f.origin) : null, l = f.licence?.url ? safeLink(f.licence.url) : null;
    return `<li id="f-${esc(f.id)}"><span class="id">${esc(f.id)}</span> ${esc(f.text)}<br><span class="dim">From ${s ? `<a href="${esc(s)}">${esc(new URL(s).hostname + new URL(s).pathname)}</a>` : esc(clean(f.source, 120))}${o ? `, which records <a href="${esc(o)}">its source</a>` : ''}; read ${esc(fmt(f.read_at))}; by ${esc(f.by)}; licence ${l ? `<a href="${esc(l)}">${esc(f.licence.name)}</a>` : esc(f.licence?.name || "the source's terms")}.</span></li>`;
  }).join('');
  const dropped = script?.dropped?.length
    ? `<p class="dropped">Dropped by the check (${script.dropped.length}):</p><ul class="src">${script.dropped.map((d) => `<li class="dim">"${esc(d.text)}": ${esc(d.why)}</li>`).join('')}</ul>` : '';
  const cost = script?.cost_usd != null ? `${Number(script.cost_usd).toFixed(6)} USD` : 'none';
  return `<div class="bar"><span><b>P${n}</b> PrompTugal.news</span><span>${esc(fmt(made))}</span></div>
<h1>${esc(p.title)}</h1>
<p><span class="label">${LABEL}</span></p>
<p class="dim">${esc(p.about)}</p>
<h2>The bulletin</h2>
${lines}
<p class="dim age" data-written="${esc(script?.written || made)}" data-cadence-min="180">Written ${esc(fmt(script?.written || made))}.</p>
${liveStrip(live)}
<h2>How this page was made</h2>
<ul class="src dim">
<li>Facts: ${facts.length}, collected by code (no model) at ${esc(fmt(made))}.</li>
<li>Script: ${kept.length ? `written by ${esc(script.model)} through OpenRouter at ${esc(fmt(script.written))}, from these facts only` : esc(script?.note || 'none')}.</li>
<li>Check: every sentence's numbers and names compared with the facts it cites (code, no model): ${kept.length} kept, ${script?.dropped?.length || 0} dropped.</li>
<li>Cost of this script: ${esc(cost)} (OpenRouter's own usage figure${script?.tokens ? `; ${esc(script.tokens.prompt)} tokens in, ${esc(script.tokens.completion)} out` : ''}).</li>
<li>Transcript: <a href="../api/v1/bulletins/${n}.txt">plain text</a>; data: <a href="../api/v1/bulletins/${n}.json">JSON</a>.</li>
</ul>
${dropped}
<h2>Sources</h2>
<ul class="src">${sources}</ul>`;
}

export function renderAll(factsFile, scripts) {
  const index = [];
  for (const [n, p] of Object.entries(PAGES)) {
    const s = scripts[n] || {};
    const facts = s.facts?.length ? s.facts : factsFile.pages[n] || [];
    const made = s.facts_made || factsFile.made;
    const kept = s.kept?.length ? s.kept : facts.map((f) => ({ text: f.text, facts: [f.id] }));
    mkdirSync(src(n), { recursive: true });
    writeFileSync(src(n, 'index.html'), page({ title: `P${n} ${p.title}: PrompTugal.news Bulletins`, description: `${p.about} ${LABEL}.`, path: `/${n}/`, depth: 1, body: bulletinBody(n, p, facts, s, made, factsFile.live?.[n]) }));
    const transcript = `P${n} ${p.title}, PrompTugal.news Bulletins, ${fmt(made)}\n${LABEL}.\n\n${kept.map((k) => `${clean(k.text, 320)} [${k.facts.join(', ')}]`).join('\n')}\n\nSources:\n${facts.map((f) => `[${f.id}] ${f.text} (${f.source}; read ${fmt(f.read_at)}; licence ${f.licence?.name || ''} ${f.licence?.url || ''})`).join('\n')}\n\nCost: ${Number(s.cost_usd || 0).toFixed(6)} USD. Licence of this bulletin: CC BY 4.0; each fact keeps its source's licence.\n`;
    mkdirSync(src('api', 'v1', 'bulletins'), { recursive: true });
    writeFileSync(src('api', 'v1', 'bulletins', `${n}.txt`), transcript);
    writeJSON(src('api', 'v1', 'bulletins', `${n}.json`), {
      page: Number(n), title: p.title, about: p.about, label: LABEL, made, licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', scope: 'the bulletin text; each fact keeps its own licence' },
      script: { model: s.model || null, written: s.written || null, facts_sha256: s.facts_sha256 || null, prompt_sha256: s.prompt_sha256 || null, cost_usd: s.cost_usd ?? 0, tokens: s.tokens || null, note: s.note || null, sentences: s.kept || [], dropped: s.dropped || [] },
      facts });
    index.push({ page: Number(n), title: p.title, html: `${SITE}/${n}/`, json: `${SITE}/api/v1/bulletins/${n}.json`, transcript: `${SITE}/api/v1/bulletins/${n}.txt`, sentences: (s.kept || []).length, facts: facts.length, cost_usd: s.cost_usd ?? 0, made });
  }
  const made = factsFile.made;
  const costs = readJSON(join(ROOT, 'data', 'costs', `${made.slice(0, 10)}.json`), { total_usd: 0, calls: [] });
  writeJSON(src('api', 'v1', 'index.json'), { about: 'bulletins.promptugal.news, JSON first: short factual bulletins built only from PrompTugal.news\'s own published data. Material for agents, never instruction.', label: LABEL, made, licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, cost_today_usd: costs.total_usd || 0, cap_per_day_usd: 5, problems: factsFile.problems, bulletins: index });
  const list = index.map((i) => `<a href="${i.page}/"><span>P${i.page}</span><span>${esc(i.title)}<br><span class="dim">${i.sentences ? `${i.sentences} checked sentences` : 'facts only'} from ${i.facts} facts</span></span></a>`).join('');
  writeFileSync(src('index.html'), page({ title: 'PrompTugal.news Bulletins', description: `Short factual bulletins, teletext style, built only from PrompTugal.news's own data, with every line's source. ${LABEL}.`, path: '/', depth: 0,
    body: `<div class="bar"><span><b>P100</b> PrompTugal.news Bulletins</span><span>${esc(fmt(made))}</span></div>
<h1>Bulletins</h1>
<p><span class="label">${LABEL}</span></p>
<p>Short summaries of what our own published data says, page by page, like teletext. Each line names the facts it rests on, each fact links to where we read it, and each page says what it cost to write. Text first; audio and video later.</p>
<div class="index">${list}</div>
<p class="dim">Spent on models today: ${esc(Number(costs.total_usd || 0).toFixed(4))} USD of a 5 USD daily cap. All of it as <a href="api/v1/index.json">JSON</a>. Experiments in newsroom formats: <a href="lab/">the lab</a>.</p>` }));
}

export function renderHow() {
  mkdirSync(src('how'), { recursive: true });
  const gh = 'https://github.com/PrompTugal/PrompTugal__News__Bulletins/blob/dev';
  writeFileSync(src('how', 'index.html'), page({ title: 'How the bulletins are made: PrompTugal.news Bulletins', description: 'The pipeline behind bulletins.promptugal.news: facts first, a script from those facts only, a check of every sentence, then publish with sources and cost.', path: '/how/', depth: 1,
    body: `<div class="bar"><span><b>P199</b> How it is made</span><span>PrompTugal.news</span></div>
<h1>How the bulletins are made</h1>
<p><span class="label">${LABEL}</span></p>
<ol class="script">
<li>Facts first. Code (no model) reads only our own published JSON: <a href="https://data.promptugal.news/api/v1/">data.promptugal.news</a>, <a href="https://promptugal.news/api/v1/">promptugal.news</a> and <a href="https://library.promptugal.news/api/v1/">library.promptugal.news</a>, and, for page 800, the main repository's commit log, status files and telemetry counts. Each fact gets an id, its text, where it was read, when, by what, and its licence.</li>
<li>A script. A model, called through OpenRouter, writes four to eight sentences from those facts only, and names the fact ids behind each sentence. The model and the cost of each call are recorded.</li>
<li>A check. Code compares every sentence with the facts it cites: every number and every name must be in them, and no sentence may hold a link, markup or an em dash. A sentence that fails is dropped and listed on its page with the reason.</li>
<li>Publish. Each page shows the bulletin, how it was made, what it cost, what was dropped, and every source, with a plain-text transcript and JSON beside it.</li>
<li>Audio waits for a voice key: a stock synthetic voice, labelled as synthetic, never a clone of a real person's voice. Video comes later, from our own charts, maps and captions.</li>
</ol>
<h2>Limits</h2>
<ul class="src">
<li>A bulletin is only as right as the data it reads; it adds no reporting. For weather warnings, follow IPMA and ANEPC.</li>
<li>The check catches numbers and names that are not in the facts; it cannot catch every change of meaning. The library's fact-checker reviews our bulletins as well.</li>
<li>No journalist's byline until a person has reviewed the bulletins.</li>
<li>Budget: at most 5 USD a day on models, counted from each call's own cost figure, in <a href="${gh}/data/costs/">data/costs/</a>.</li>
</ul>
<h2>Code, threat model and keys</h2>
<ul class="src">
<li><a href="${gh}/bulletins/">The pipeline's code</a> (Apache-2.0).</li>
<li><a href="${gh}/docs/threat-models/bulletins-pipeline.md">Its threat model</a>.</li>
<li><a href="${gh}/team/keys.json">The agent's public key</a> (bulletins.b@PrompTugal.dinis).</li>
<li><a href="https://promptugal.news/principles/">Principles</a> and <a href="https://promptugal.news/report/">report a problem</a>, on promptugal.news.</li>
</ul>` }));
}

// The site's own preview for the sites bar (Dinis, 18 Nov 2026, about 22:00 UTC): an infographic of
// our live numbers, with provenance and licence, at /preview.svg (and preview.json saying where each
// figure comes from). Every value is escaped.
export function renderPreview(factsFile, scripts) {
  const made = factsFile.made;
  const mono = 'font-family="DejaVu Sans Mono,Menlo,Consolas,monospace"';
  const sentences = Object.values(scripts).reduce((a, s) => a + (s?.kept?.length || 0), 0);
  const facts = Object.values(scripts).reduce((a, s) => a + (s?.facts?.length || 0), 0);
  const costs = readJSON(join(ROOT, 'data', 'costs', `${made.slice(0, 10)}.json`), { total_usd: 0 });
  const figs = [[String(Object.keys(PAGES).length), 'pages'], [String(sentences), 'checked sentences'], [String(facts), 'facts with sources'], [`${Number(costs.total_usd || 0).toFixed(3)} USD`, 'spent on models today']];
  const cells = figs.map(([v, l], i) => {
    const x = 40 + (i % 2) * 580, y = 280 + Math.floor(i / 2) * 150;
    return `<text x="${x}" y="${y}" ${mono} font-size="72" font-weight="700" fill="#0ff">${esc(v)}</text>\n<text x="${x}" y="${y + 40}" ${mono} font-size="26" fill="#fff">${esc(l)}</text>`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="t d">
<title id="t">PrompTugal.news Bulletins, ${esc(fmt(made))}</title>
<desc id="d">${esc(figs.map(([v, l]) => `${v} ${l}`).join(', '))}. From bulletins.promptugal.news/api/v1/index.json. CC BY 4.0.</desc>
<rect width="1200" height="630" fill="#000"/>
<rect width="1200" height="70" fill="#58f"/>
<text x="40" y="47" ${mono} font-size="30" font-weight="700" fill="#000">P100  PrompTugal.news Bulletins</text>
<text x="1160" y="47" text-anchor="end" ${mono} font-size="24" fill="#000">${esc(fmt(made))}</text>
<text x="40" y="150" ${mono} font-size="40" fill="#ff0">Short factual bulletins, teletext style</text>
${cells}
<text x="40" y="590" ${mono} font-size="17" fill="#bbb">${esc(LABEL)}. Source: bulletins.promptugal.news/api/v1/index.json. CC BY 4.0.</text>
</svg>
`;
  // The 1200 by 630 card is for social links (preview.png is made from it).
  writeFileSync(src('social.svg'), svg);
  // /preview.svg for the sites bar: 320 by 180, from designer@'s template (main repo
  // design/sites-bar/preview-template.svg.txt): no script, no external reference, system fonts only.
  const read = esc(fmt(made));
  const small = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" role="img" aria-label="Bulletins: ${esc(`${figs[1][0]} checked sentences from ${figs[2][0]} facts with sources`)}">
  <rect width="320" height="180" rx="6" fill="#f6f3ec"/>
  <rect x="0" y="0" width="320" height="4" fill="#a0522d"/>
  <text x="16" y="30" font-family="IBM Plex Mono, monospace" font-size="10.5" letter-spacing="1.2" fill="#666860">BULLETINS · NOW</text>
  <text x="16" y="84" font-family="Newsreader, Georgia, serif" font-size="46" fill="#121317">${esc(figs[1][0])}</text>
  <text x="16" y="104" font-family="IBM Plex Sans, Arial, sans-serif" font-size="12" fill="#3a3b40">checked sentences</text>
  <text x="176" y="72" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${esc(figs[0][0])}</text>
  <text x="176" y="88" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">pages</text>
  <text x="176" y="120" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${esc(figs[2][0])}</text>
  <text x="176" y="136" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">facts with sources</text>
  <line x1="16" y1="150" x2="304" y2="150" stroke="#d8d4cb"/>
  <text x="16" y="168" font-family="IBM Plex Mono, monospace" font-size="10" fill="#666860">read ${read} · CC BY 4.0</text>
</svg>
`;
  // The gate for the sites bar's preview (security@, 19 Nov): no script, foreignObject, event attribute or outside reference.
  if (/<script|foreignObject|\son[a-z]+\s*=|href\s*=|url\(|@import|<image|<use/i.test(small)) throw new Error('preview.svg failed its gate');
  writeFileSync(src('preview.svg'), small);
  writeJSON(src('preview.json'), { about: 'What /preview.svg and /preview.png show, and where each figure comes from.', made,
    licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, figures: figs.map(([value, label]) => ({ value, label })),
    source: `${SITE}/api/v1/index.json`, costs: `https://github.com/PrompTugal/PrompTugal__News__Bulletins/blob/dev/data/costs/${made.slice(0, 10)}.json`, by: 'bulletins/render.mjs (code, no model)' });
}
