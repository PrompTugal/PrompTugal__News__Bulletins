// Freezes version 1 of the presenters and publishes its documentation as a page (Dinis, 20 Nov 2026: "Is there a
// page that defines all this stuff and also has instructions for how to create another version of this? And you
// can call this version 1"). Copies the language's files into src/lab/presenters/v1/ once (never overwrites a
// frozen file that differs: it stops instead), and writes v1/index.html from docs/presenters/README.md with a small
// Markdown reader (headings, paragraphs, lists, tables, code, quotes, links, bold, inline code). No dependencies.
// Run: node bulletins/presenters-v1.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, esc } from './core.mjs';
import { LABEL } from './render.mjs';

const SRC = join(ROOT, 'src', 'lab', 'presenters'), V1 = join(SRC, 'v1');
mkdirSync(V1, { recursive: true });
const FILES = ['presenters.js', 'presenters.json', 'gallery.js', 'explain.js'];
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const frozen = {};
for (const f of FILES) {
  const to = join(V1, f);
  if (existsSync(to) && sha(to) !== sha(join(SRC, f))) { console.log(`v1/${f} is frozen and differs from the working copy: kept as it is`); }
  else if (!existsSync(to)) copyFileSync(join(SRC, f), to);
  frozen[f] = sha(to);
}
copyFileSync(join(ROOT, 'docs', 'presenters', 'README.md'), join(V1, 'README.md'));
writeFileSync(join(V1, 'manifest.json'), JSON.stringify({ name: 'presenters', version: '1.0.0', frozen_on: '2026-11-20', by: 'bulletins.b@PrompTugal.dinis',
  note: 'Version 1 of the presenter language. These files never change; version 2 goes in ../v2/. Each file\'s exact bytes are recorded by git: the commit that first added src/lab/presenters/v1/ (git log --diff-filter=A -- src/lab/presenters/v1/).', files: Object.keys(frozen) }, null, 1) + '\n');

// Markdown to HTML, enough for this document. Text is escaped first; only these few constructs become markup.
const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\*([^*]+)\*/g, '<i>$1</i>')
  .replace(/\[([^\]]+)\]\((https:\/\/[^)\s"]+)\)/g, '<a href="$2">$1</a>')
  .replace(/(^|[\s(])(https:\/\/[^\s)<"]+[^\s)<".,;:])/g, '$1<a href="$2">$2</a>');
function md(src) {
  const out = [], lines = src.split('\n'); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    if (/^\s+```/.test(l)) { const ind = l.match(/^\s+/)[0].length, buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++].slice(ind)); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    const h = l.match(/^(#{1,4}) (.*)$/); if (h) { const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); out.push(`<h${h[1].length} id="${id}">${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); const cells = (r) => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, '|')));
      out.push('<table><thead><tr>' + cells(rows[0]).map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' + rows.slice(2).map((r) => '<tr>' + cells(r).map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>'); continue; }
    if (/^> /.test(l)) { const buf = []; while (i < lines.length && /^> /.test(lines[i])) buf.push(lines[i++].slice(2)); out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
    if (/^(\s*)([-*]|\d+\.) /.test(l)) {
      const ol = /^\d+\./.test(l.trim()), items = [];
      while (i < lines.length && (/^(\s*)([-*]|\d+\.) /.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && !/^\s+```/.test(lines[i])))) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.) (.*)$/);
        if (m) items.push({ d: m[1].length, t: m[3] }); else items[items.length - 1].t += ' ' + lines[i].trim();
        i++;
        if (i < lines.length && /^\s+```/.test(lines[i])) break;
      }
      let html = '', depth = -1; const stack = [];
      for (const it of items) { const lv = it.d >= 2 ? 1 : 0; while (depth < lv) { html += ol && depth < 0 ? '<ol>' : '<ul>'; stack.push(ol && depth < 0 ? 'ol' : 'ul'); depth++; } while (depth > lv) { html += `</${stack.pop()}>`; depth--; } html += `<li>${inline(it.t)}</li>`; }
      while (stack.length) html += `</${stack.pop()}>`;
      out.push(html); continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#|\||```|> |\s*([-*]|\d+\.) )/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}
const body = md(readFileSync(join(ROOT, 'docs', 'presenters', 'README.md'), 'utf8'));
writeFileSync(join(V1, 'index.html'), `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Presenters, version 1: PrompTugal.news Bulletins</title>
<meta name="description" content="Version 1 of the presenter language: how synthetic presenters are described as data, compiled, directed and drawn by code, and how to make version 2. ${esc(LABEL)}.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'">
<style>body{margin:0;background:#000;color:#eee;font:16px/1.6 "DejaVu Sans",sans-serif}.wrap{max-width:900px;margin:0 auto;padding:16px}
h1,h2,h3{font-family:"DejaVu Sans Mono",monospace;color:#ff0}h1{border-bottom:3px solid #4a7dff;padding-bottom:6px}h2{margin-top:32px;border-bottom:1px solid #333}
a{color:#7cf}code{font-family:"DejaVu Sans Mono",monospace;background:#111a26;padding:1px 4px;border-radius:3px;color:#bff7ff}pre{background:#0b1220;border-left:3px solid #30d5ff;padding:10px;overflow:auto}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}th,td{border:1px solid #333;padding:5px 7px;vertical-align:top;text-align:left}th{background:#111a26;color:#ff0}
blockquote{margin:10px 0;padding:8px 12px;border-left:3px solid #ff0;background:#141414}.nav{background:#4a7dff;color:#000;padding:8px 12px;font-family:"DejaVu Sans Mono",monospace;font-weight:700}.nav a{color:#000}
.dim{color:#9aa;font-size:13px}</style></head><body><div class="nav">PrompTugal.news Bulletins · Lab · Presenters v1 · <a href="../">the gallery</a> · <a href="../explainer.mp4">the explainer video</a> · <a href="../presenters-split.mp4">the split video</a> · <a href="manifest.json">manifest</a></div>
<div class="wrap">${body}
<p class="dim">This page is docs/presenters/README.md as frozen with version 1 (${esc(Object.keys(frozen).join(', '))}; their exact bytes are in git). ${esc(LABEL)}.</p></div></body></html>\n`);
console.log('v1: src/lab/presenters/v1/ (index.html, manifest.json, ' + FILES.join(', ') + ', README.md)');
