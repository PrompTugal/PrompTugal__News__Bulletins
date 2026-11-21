// Publishes the presenter briefs (docs/presenters/briefs/*.md) as pages at /lab/presenters/briefs/ (Dinis, 20 Nov
// 2026: "put all these pages on the website"), each beside its Markdown, so a person can read it or hand the raw
// file to a model. Run: node bulletins/briefs-pages.mjs
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, esc } from './core.mjs';
import { LABEL } from './render.mjs';
import { md } from './md.mjs';

const FROM = join(ROOT, 'docs', 'presenters', 'briefs'), TO = join(ROOT, 'src', 'lab', 'presenters', 'briefs');
mkdirSync(TO, { recursive: true });
const BRIEFS = [
  { id: 'common', title: 'The common brief', about: 'The full specification for presenters version 2 in high definition: version 1, the twelve characters, what version 2 must do, the contract, the deliverables and how it is judged.' },
  { id: 'chatgpt', title: 'The brief for ChatGPT', about: 'What to attach and the prompt to paste into ChatGPT.' },
  { id: 'claude', title: 'The brief for a Claude Code session', about: 'The prompt for a new Claude Code session in this repository.' },
];
const css = `body{margin:0;background:#000;color:#eee;font:16px/1.6 "DejaVu Sans",sans-serif}.wrap{max-width:900px;margin:0 auto;padding:16px}
h1,h2,h3,h4{font-family:"DejaVu Sans Mono",monospace;color:#ff0}h1{border-bottom:3px solid #4a7dff;padding-bottom:6px}h2{margin-top:32px;border-bottom:1px solid #333}
a{color:#7cf}code{font-family:"DejaVu Sans Mono",monospace;background:#111a26;padding:1px 4px;border-radius:3px;color:#bff7ff}pre{background:#0b1220;border-left:3px solid #30d5ff;padding:10px;overflow:auto}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}th,td{border:1px solid #333;padding:5px 7px;vertical-align:top;text-align:left}th{background:#111a26;color:#ff0}
blockquote{margin:10px 0;padding:8px 12px;border-left:3px solid #ff0;background:#141414}hr{border:0;border-top:1px dashed #444;margin:24px 0}.nav{background:#4a7dff;color:#000;padding:8px 12px;font-family:"DejaVu Sans Mono",monospace;font-weight:700}.nav a{color:#000}.dim{color:#9aa;font-size:13px}
.card{display:block;border:1px solid #333;border-left:4px solid #ff0;padding:10px 14px;margin:12px 0;text-decoration:none;color:#eee}.card b{color:#ff0;font-family:"DejaVu Sans Mono",monospace}`;
const page = (title, desc, body) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}: PrompTugal.news Bulletins</title><meta name="description" content="${esc(desc)} ${esc(LABEL)}.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>${css}</style></head><body><div class="nav">PrompTugal.news Bulletins · Lab · <a href="./">Presenter briefs</a> · <a href="../">the gallery</a> · <a href="../v1/">version 1</a> · <a href="../explainer.mp4">the explainer</a> · <a href="../v2-claude/">version 2 (Claude), the result</a></div>
<div class="wrap">${body}<p class="dim">${esc(LABEL)}. Text CC BY 4.0, code Apache-2.0.</p></div></body></html>\n`;
const md2 = (t) => md(t.replace(/^---$/gm, '<!--hr-->')).replace(/<p>&lt;!--hr--&gt;<\/p>/g, '<hr>');
for (const b of BRIEFS) {
  const text = readFileSync(join(FROM, `${b.id}.md`), 'utf8');
  copyFileSync(join(FROM, `${b.id}.md`), join(TO, `${b.id}.md`));
  // Links between the briefs point at their pages here.
  const html = md2(text).replace(/<code>(common|chatgpt|claude)\.md<\/code>/g, '<a href="$1.html"><code>$1.md</code></a>');
  writeFileSync(join(TO, `${b.id}.html`), page(b.title, b.about, `<p class="dim">Raw Markdown, to hand to a model: <a href="${b.id}.md">${b.id}.md</a></p>${html}`));
}
// One self-contained file for ChatGPT: the prompt, then everything it refers to, so a single link or upload is enough.
const prompt = readFileSync(join(FROM, 'chatgpt.md'), 'utf8').split(/^## The prompt \(paste from here\)$/m)[1].split(/^## After ChatGPT answers$/m)[0].trim()
  .replace('Read the attached `common.md` first.', 'Read the common brief below (part 2) first.')
  .replace('Use the attached `presenters.json` and `presenters.js`', 'Use version 1\'s `presenters.json` and `presenters.js` (parts 4 and 5 below)');
const fence = (lang, t) => '````' + lang + '\n' + t.replace(/\n$/, '') + '\n````';
const bundle = ['# Presenters version 2, for ChatGPT: everything in one file',
  `Written by bulletins.b@PrompTugal.dinis on ${new Date().toISOString().slice(0, 10)} at Dinis Cruz's request. This file holds the prompt and everything it refers to: (1) the prompt, (2) the common brief, (3) version 1's design, (4) version 1's twelve presenters as data, (5) version 1's engine. Upload it, or paste it, and say: "Follow part 1." Pictures are optional: https://riskmandate.ai/stories/images/meet-the-cast.webp, https://the-ultimate-insider.book.sgit.ai/assets/cover-a.svg and a frame of https://bulletins.promptugal.news/lab/presenters/presenters.mp4.`,
  '## Part 1. The prompt', prompt,
  '## Part 2. The common brief (common.md)', readFileSync(join(FROM, 'common.md'), 'utf8').replace(/^# /m, '### ').replace(/^## /gm, '#### '),
  '## Part 3. Version 1\'s design (docs/presenters/README.md)', readFileSync(join(ROOT, 'docs', 'presenters', 'README.md'), 'utf8').replace(/^# /m, '### ').replace(/^## /gm, '#### '),
  '## Part 4. Version 1\'s presenters (src/lab/presenters/presenters.json)', fence('json', readFileSync(join(ROOT, 'src', 'lab', 'presenters', 'presenters.json'), 'utf8')),
  '## Part 5. Version 1\'s engine (src/lab/presenters/presenters.js)', fence('js', readFileSync(join(ROOT, 'src', 'lab', 'presenters', 'presenters.js'), 'utf8')),
].join('\n\n') + '\n';
writeFileSync(join(TO, 'chatgpt-all-in-one.md'), bundle);

// The same for Claude: works in Claude chat (no repository: build and return the files) and in a Claude Code session
// with the repository (follow the prompt's branch, sub-agent and release steps).
const cprompt = readFileSync(join(FROM, 'claude.md'), 'utf8').split(/^## The prompt \(paste from here\)$/m)[1].trim();
const file = (rel) => readFileSync(join(ROOT, ...rel.split('/')), 'utf8');
const cbundle = ['# Presenters version 2, for Claude: everything in one file',
  `Written by bulletins.b@PrompTugal.dinis on ${new Date().toISOString().slice(0, 10)} at Dinis Cruz's request. This file holds the prompt and everything it refers to. Upload it, or paste it, and say: "Follow part 1."`,
  '**Where you are decides how you deliver:**\n- **In a Claude Code session with the repository PrompTugal/PrompTugal__News__Bulletins:** follow part 1 exactly as written: its branch, its folder, its sub-agents, its checks and its release steps. The files here are copies; the repository is the source.\n- **In Claude chat, without the repository:** the files part 1 asks you to read are parts 2 to 8 below. Plan first, then build every deliverable in common brief section 4, writing each file in full, ready to drop into `src/lab/presenters/v2-claude/`. Use artifacts if you have them, so the showcase can be seen running. For every library, give the exact npm package, version and file to vendor, plus the command that fetches it. Say plainly what you could not run or test.',
  '## Part 1. The prompt', cprompt,
  '## Part 2. The common brief (docs/presenters/briefs/common.md)', file('docs/presenters/briefs/common.md').replace(/^# /m, '### ').replace(/^## /gm, '#### '),
  '## Part 3. The team rules (CLAUDE.md)', file('CLAUDE.md').replace(/^# /m, '### ').replace(/^## /gm, '#### '),
  '## Part 4. Version 1\'s design (docs/presenters/README.md)', file('docs/presenters/README.md').replace(/^# /m, '### ').replace(/^## /gm, '#### '),
  '## Part 5. Version 1\'s presenters (src/lab/presenters/presenters.json)', fence('json', file('src/lab/presenters/presenters.json')),
  '## Part 6. Version 1\'s engine (src/lab/presenters/presenters.js)', fence('js', file('src/lab/presenters/presenters.js')),
  '## Part 7. How they are driven (src/lab/presenters/gallery.js and explain.js)', fence('js', file('src/lab/presenters/gallery.js')) + '\n\n' + fence('js', file('src/lab/presenters/explain.js')),
  '## Part 8. How video is exported (bulletins/presenters-video.mjs)', fence('js', file('bulletins/presenters-video.mjs')),
].join('\n\n') + '\n';
writeFileSync(join(TO, 'claude-all-in-one.md'), cbundle);

writeFileSync(join(TO, 'index.html'), page('Presenter briefs', 'Briefs for presenters version 2 in high definition, for ChatGPT and for Claude.', `<h1>Presenters version 2: the briefs</h1>
<p>Three briefs for a high-definition version 2 of the twelve synthetic presenters: one common specification, and a prompt each for ChatGPT and for a Claude Code session, so their results can be compared side by side with <a href="../v1/">version 1</a>. Written by bulletins.b@PrompTugal.dinis on 20 November 2026 at Dinis Cruz's request.</p>
<a class="card" href="chatgpt-all-in-one.md"><b>For ChatGPT: everything in one file</b><br>The prompt, the common brief, version 1's design, its twelve presenters and its engine, in one Markdown file: upload it or give ChatGPT the link, and say "Follow part 1".<br><span class="dim">chatgpt-all-in-one.md (${Math.round(bundle.length / 1024)} KB)</span></a>
<a class="card" href="claude-all-in-one.md"><b>For Claude: everything in one file</b><br>The prompt, the common brief, the team rules, version 1's design, its twelve presenters, its engine and how they are driven and exported, in one Markdown file. Works in Claude chat (Claude returns the files) and in a Claude Code session with the repository (Claude follows the branch and release steps). Upload it or give the link, and say "Follow part 1".<br><span class="dim">claude-all-in-one.md (${Math.round(cbundle.length / 1024)} KB)</span></a>
${BRIEFS.map((b) => `<a class="card" href="${b.id}.html"><b>${esc(b.title)}</b><br>${esc(b.about)}<br><span class="dim">Markdown: ${b.id}.md</span></a>`).join('\n')}`));
console.log('briefs: src/lab/presenters/briefs/ (' + BRIEFS.map((b) => b.id).join(', ') + ')');
