// The PrompTugal sites bar, v1.1.0 (Dinis, 18 Nov 2026, main repo board/guidance/2026-11-18-the-sites-bar.md;
// cleared by conductor.b@ on 19 Nov, 00:55 UTC, after security@'s review of these exact files).
// The vendored files live in src/assets/sites-bar/1.1.0/, pinned by sha256 below and checked at every build.
// At build: read promptugal.news/api/v1/sites.json, render the bar's HTML with the vendored renderer.
// If the renderer refuses the registry it returns '' and the pages are published without a bar (never a
// hand-made one). If the registry cannot be read, the last good bar is kept (data/sites-bar/last.html).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, getJSON, writeJSON } from './core.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

export const BAR_VERSION = '1.1.0';
export const BAR_DIR = `assets/sites-bar/${BAR_VERSION}`;
const PINS = {
  'sites-bar-render.mjs': 'b9b50ae32fd5dc234ba6e9b4660061afb25554b542a1c779f68d1d8c61a98dbc',
  'sites-bar.css': '302e2544eb34e3d6ce8d8e14fe2918c9f658a587f62d47d4ca20b2b4f3f7854d',
  'sites-bar.js': 'bc97a820a8f4fbda60ff65c3073be6fe79b2d1d3ee954257e3a59bca7429e9b0',
};
const HERE = 'bulletins.promptugal.news';
const LAST = join(ROOT, 'data', 'sites-bar', 'last.html');

export function verifyPins() {
  for (const [f, want] of Object.entries(PINS)) {
    const got = createHash('sha256').update(readFileSync(join(ROOT, 'src', BAR_DIR, f))).digest('hex');
    if (got !== want) throw new Error(`sites bar ${f}: sha256 does not match its pin`);
  }
}

export async function loadBar() {
  verifyPins();
  const { render } = await import(pathToFileURL(join(ROOT, 'src', BAR_DIR, 'sites-bar-render.mjs')).href);
  let reg;
  try { reg = await getJSON('https://promptugal.news/api/v1/sites.json'); }
  catch (e) {
    const kept = existsSync(LAST) ? readFileSync(LAST, 'utf8') : '';
    console.log(`sites bar: registry not read (${String(e.message).slice(0, 80)}); ${kept ? 'kept the last bar' : 'no bar'}`);
    return kept;
  }
  const html = render(reg, { here: HERE });
  if (!html) { console.log('sites bar: the renderer refused the registry; published without a bar'); return ''; }
  mkdirSync(join(ROOT, 'data', 'sites-bar'), { recursive: true });
  writeFileSync(LAST, html + '\n');
  writeJSON(join(ROOT, 'data', 'sites-bar', 'last.json'), { version: BAR_VERSION, registry_version: reg.version || null, read_at: new Date().toISOString(), sites: (reg.sites || []).length });
  return html;
}
