// A small Markdown reader for our own documents (headings, paragraphs, lists, tables, code, quotes, links, bold,
// inline code). Text is escaped first; only these constructs become markup. No dependencies.
import { esc } from './core.mjs';

// Markdown to HTML, enough for this document. Text is escaped first; only these few constructs become markup.
const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\*([^*]+)\*/g, '<i>$1</i>')
  .replace(/\[([^\]]+)\]\((https:\/\/[^)\s"]+)\)/g, '<a href="$2">$1</a>')
  .replace(/(^|[\s(])(https:\/\/[^\s)<"]+[^\s)<".,;:])/g, '$1<a href="$2">$2</a>');
export function md(src) {
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

