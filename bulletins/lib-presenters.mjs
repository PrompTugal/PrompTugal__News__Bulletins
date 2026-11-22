// Publishes the presenters library (Dinis, 21 Nov 2026: "I would like to have the presenter engine as a reusable
// library using our current library publishing flow"). Builds src/lib/presenters/v<VERSION>/ from lib/presenters/
// (the entry, demo, README) and the adopted engine in src/lab/presenters/v2-claude/ (engine/, vendor/, the four data
// files), then copies it to the moving folders: v<major>.<minor>/, v<major>/ and latest/. A pinned version never
// changes: if v<VERSION>/ exists and any file differs from what this build makes, it stops; bump VERSION instead.
// Pins (SRI) are never stored here; dev@ lists them in the registry after security@'s review. No dependencies.
// Run: node bulletins/lib-presenters.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, cpSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, esc } from './core.mjs';
import { md } from './md.mjs';

const VERSION = '0.1.1', DATE = '2026-11-22';
const SRC = join(ROOT, 'lib', 'presenters'), V2 = join(ROOT, 'src', 'lab', 'presenters', 'v2-claude'), OUT = join(ROOT, 'src', 'lib', 'presenters');
const [MA, MI] = VERSION.split('.');

// 1. The files of this version, in memory: path -> Buffer.
const files = new Map();
const addDir = (from, to) => { for (const f of readdirSync(from)) { const p = join(from, f); if (statSync(p).isDirectory()) addDir(p, to + f + '/'); else files.set(to + f, readFileSync(p)); } };
addDir(join(V2, 'engine'), 'engine/');
for (const f of ['three.module.min.js', 'three.LICENSE']) files.set('vendor/' + f, readFileSync(join(V2, 'vendor', f)));
for (const f of ['characters', 'moves', 'choreography', 'visemes']) files.set(`data/${f}.json`, readFileSync(join(V2, f + '.json')));
for (const f of ['presenters.js', 'demo.js', 'README.md']) files.set(f, readFileSync(join(SRC, f)));
const readme = readFileSync(join(SRC, 'README.md'), 'utf8');
files.set('index.html', Buffer.from(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Presenters library ${VERSION}: PrompTugal.news Bulletins</title>
<meta name="description" content="The PrompTugal.news presenters library, version ${VERSION}: twelve synthetic presenters built and animated by code, in one import. Documentation and live examples.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'">
<style>body{margin:0;background:#000;color:#eee;font:16px/1.6 "DejaVu Sans",sans-serif}.wrap{max-width:960px;margin:0 auto;padding:16px}
h1,h2,h3{font-family:"DejaVu Sans Mono",monospace;color:#ff0}h1{border-bottom:3px solid #4a7dff;padding-bottom:6px}h2{margin-top:32px;border-bottom:1px solid #333}
a{color:#7cf}code{font-family:"DejaVu Sans Mono",monospace;background:#111a26;padding:1px 4px;border-radius:3px;color:#bff7ff}pre{background:#0b1220;border-left:3px solid #30d5ff;padding:10px;overflow:auto}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}th,td{border:1px solid #333;padding:5px 7px;vertical-align:top;text-align:left}th{background:#111a26;color:#ff0}
.nav{background:#4a7dff;color:#000;padding:8px 12px;font-family:"DejaVu Sans Mono",monospace;font-weight:700}.nav a{color:#000}
.st{width:100%;aspect-ratio:16/9;background:#060914;margin:8px 0}button{font:700 14px "DejaVu Sans Mono",monospace;background:#ff0;border:0;padding:6px 12px;cursor:pointer}.dim{color:#9aa;font-size:13px}</style></head>
<body><div class="nav">PrompTugal.news Bulletins · Lab · Presenters library <span id="ver"></span> · <a href="../versions.json">versions</a> · <a href="manifest.json">manifest</a> · <a href="README.md">README.md</a> · <a href="/lab/bulletin-v2/">used in the bulletin</a></div>
<div class="wrap"><h2>Live: all twelve, defaults</h2><div id="one" class="st"></div><button id="p1">play / pause</button>
<h2>Live: three presenters, cues, beats and a camera</h2><div id="two" class="st"></div><button id="p2">play / pause</button> <span id="state" class="dim">Loading...</span>
<p class="dim">The code of both examples is in <a href="demo.js">demo.js</a>.</p>
${md(readme)}
<p class="dim">Made by agents: bulletins.b@PrompTugal.dinis. Every presenter is synthetic and labelled; none is the likeness of a real person.</p></div>
<script type="module" src="demo.js"></script></body></html>\n`));
const list = [...files.keys(), 'manifest.json'].sort();
files.set('manifest.json', Buffer.from(JSON.stringify({ name: 'presenters', version: VERSION, published: DATE, by: VERSION === '0.1.0' ? 'bulletins.b@PrompTugal.dinis' : 'bulletins.d@PrompTugal.dinis',
  entry: 'presenters.js', licence: { code: 'Apache-2.0', text_and_data: 'CC BY 4.0', 'vendor/three.module.min.js': 'MIT (three.js 0.160.1, vendor/three.LICENSE)' },
  pins: 'Not stored here: the registry (promptugal.news/api/v1/sites.json) lists them once security@\'s review passes; until then this version is a preview.',
  label: 'synthetic presenter', files: list }, null, 1) + '\n'));

// 2. The pinned folder: write it once; never change it.
const pinned = join(OUT, 'v' + VERSION);
if (existsSync(pinned)) {
  const have = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : have.push(relative(pinned, p).split('\\').join('/')); } }; walk(pinned);
  const diff = [...new Set([...have, ...files.keys()])].filter((f) => !files.has(f) || !have.includes(f) || !readFileSync(join(pinned, f)).equals(files.get(f)));
  if (diff.length) { console.error(`v${VERSION} is published and would change (${diff.slice(0, 6).join(', ')}${diff.length > 6 ? ', ...' : ''}): bump VERSION instead`); process.exit(1); }
  console.log(`v${VERSION}: published, unchanged`);
} else {
  for (const [f, b] of files) { mkdirSync(join(pinned, f, '..'), { recursive: true }); writeFileSync(join(pinned, f), b); }
  console.log(`v${VERSION}: published (${files.size} files)`);
}

// 3. The moving folders, copies of the newest version in their line, and versions.json.
const vlist = readdirSync(OUT).filter((d) => /^v\d+\.\d+\.\d+$/.test(d)).map((d) => d.slice(1).split('.').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
const newest = (pred) => vlist.filter(pred).pop();
for (const [name, pred] of [['latest', () => true], ['v' + MA, (v) => v[0] === +MA], [`v${MA}.${MI}`, (v) => v[0] === +MA && v[1] === +MI]]) {
  const v = newest(pred); rmSync(join(OUT, name), { recursive: true, force: true }); cpSync(join(OUT, 'v' + v.join('.')), join(OUT, name), { recursive: true });
  console.log(`${name}/ = v${v.join('.')}`);
}
const vjson = join(OUT, 'versions.json'), old = existsSync(vjson) ? JSON.parse(readFileSync(vjson, 'utf8')).versions : {};
old[VERSION] = old[VERSION] || { published: DATE, path: `v${VERSION}/`, entry: `v${VERSION}/presenters.js` };
writeFileSync(vjson, JSON.stringify({ name: 'presenters', about: `The PrompTugal.news presenters library: twelve synthetic presenters built by code. Pinned folders v<x.y.z>/ never change; v<x.y>/, v<x>/ and latest/ move to the newest. Docs: latest/index.html. ${esc('Made by agents from PrompTugal.news.')}`,
  base: 'https://bulletins.promptugal.news/lib/presenters/', latest: vlist.at(-1).join('.'), aliases: { latest: vlist.at(-1).join('.'), ['v' + MA]: newest((v) => v[0] === +MA).join('.'), [`v${MA}.${MI}`]: newest((v) => v[0] === +MA && v[1] === +MI).join('.') }, versions: old }, null, 1) + '\n');
