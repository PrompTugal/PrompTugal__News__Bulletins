// tools/pack.mjs: packs each of the three pages into one self-contained HTML file (its scripts bundled, its data and,
// for the showcase, version 1's voice inlined), for viewing without a server, for example as a Claude artifact.
// The packed files are not for the repository: they repeat what the folder already holds, and they carry inline
// scripts, which the site's Content-Security-Policy forbids. Run: node tools/pack.mjs [outDir]
// Needs esbuild (MIT) in a scratch folder: npm install esbuild@0.21.5, then run with NODE_PATH pointing at it, or
// install it next to this repository. Proposal by presenters.v2-claude@PrompTugal.dinis, 21 November 2026.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { throw new Error('esbuild is not installed: npm install esbuild@0.21.5 (in a scratch folder, then set NODE_PATH to its node_modules)'); }
const D = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const J = (f) => JSON.parse(readFileSync(D + f, 'utf8'));
const chor = J('choreography.json'); chor.voice.src = 'data:audio/mp4;base64,' + readFileSync(join(D, '..', '..', 'video', '200.m4a')).toString('base64');
for (const b of chor.beats) if (b.sub) b.sub = b.sub.replace(/'s /g, '’s ');
const ALL = { 'characters.json': J('characters.json'), 'moves.json': J('moves.json'), 'choreography.json': chor, 'visemes.json': J('visemes.json') };
const css = readFileSync(D + 'site.css', 'utf8');
function build(page, script, files, out, title, tail) {
  const js = esbuild.buildSync({ entryPoints: [D + script], bundle: true, format: 'iife', minify: true, legalComments: 'none', write: false, logLevel: 'error' }).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = readFileSync(D + page, 'utf8');
  let body = html.slice(html.indexOf('<div class="wrap">'), html.indexOf('<nav class="fastext"'));
  body = body.replace(/<a href="[^"]*">([^<]*)<\/a>/g, '$1').replace(/(\w)'(s|t)\b/g, '$1’$2').replace(/How it is built: README\.md\. /, '');
  body = body.replace(/<\/div>\s*$/, `  <p class="dim small">${tail}</p>\n</div>`);
  const data = Object.fromEntries(files.map((f) => [f, ALL[f]]));
  writeFileSync(out, `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<style>
${css}
:root { box-sizing: border-box; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); color-scheme: dark; }
html { scroll-padding-top: env(safe-area-inset-top, 0px); }
body { background: #000; }
.wrap { padding-bottom: 24px; }
@media (max-width: 700px) { .transport { grid-template-columns: auto 1fr; } .time { grid-column: 1 / -1; text-align: left; } .tt-head h1 { font-size: 18px; } body { font-size: 14px; } .side { grid-template-columns: minmax(0, 1fr); } .state { grid-template-columns: minmax(0, 1fr); } }
</style>
</head>
<body>
${body}
${page === 'index.html' ? '<audio id="voice" preload="auto"></audio>' : ''}
<script>
(function () { var DATA = ${JSON.stringify(data).replace(/<\//g, '<\\/')}; var real = window.fetch;
  window.fetch = function (u, o) { return Object.prototype.hasOwnProperty.call(DATA, u) ? Promise.resolve(new Response(JSON.stringify(DATA[u]), { headers: { 'content-type': 'application/json' } })) : real.call(window, u, o); }; })();
</script>
<script>
${js}
</script>
</body>
</html>
`);
  console.log(out, (readFileSync(out).length / 1e6).toFixed(2), 'MB');
}
const O = (process.argv[2] || join(tmpdir(), 'presenters-v2-claude-packed')) + '/'; mkdirSync(O, { recursive: true }); const note = 'This page is one of three, each packed into a single file: the showcase, the model sheet and the playground. The delivered folder holds them as linked pages.';
build('index.html', 'showcase.js', ['characters.json', 'moves.json', 'choreography.json', 'visemes.json'], O + 'presenters-v2-claude-showcase.html', 'Presenters version 2 (Claude): the showcase', note);
build('sheet.html', 'sheet.js', ['characters.json', 'moves.json'], O + 'presenters-v2-claude-sheet.html', 'Presenters version 2 (Claude): the model sheet', note);
build('playground.html', 'playground.js', ['characters.json', 'moves.json', 'visemes.json'], O + 'presenters-v2-claude-playground.html', 'Presenters version 2 (Claude): the playground', note);
