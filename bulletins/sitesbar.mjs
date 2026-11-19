// The PrompTugal sites bar, v1.1.1 (Dinis, 18 Nov 2026, main repo board/guidance/2026-11-18-the-sites-bar.md;
// 1.1.1 cleared by security@'s ruling of 19 Nov, 01:30 UTC, relayed by conductor.b@).
// The vendored files live in src/assets/sites-bar/1.1.1/, pinned below in SRI form (sha256-<base64> of the whole file),
// compared in full at every build, and compared in full with the registry's bar.integrity when it names this version.
// At build: read promptugal.news/api/v1/sites.json, render the bar's HTML with the vendored renderer.
// If the renderer refuses the registry it returns '' and the pages are published without a bar (never a
// hand-made one). If the registry cannot be read, the last good bar is kept (data/sites-bar/last.html).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, getJSON, writeJSON } from './core.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

export const BAR_VERSION = '1.1.1';
export const BAR_DIR = `assets/sites-bar/${BAR_VERSION}`;
const PINS = {
  render: ['sites-bar-render.mjs', 'sha256-qi/wub3SbA90q6Ab+p5TtTd6ewAuMtiDA1L6e3nzou4='],
  css: ['sites-bar.css', 'sha256-xz+fEE+rY1AK+9NgKEz+qBRUgeuirUoTBuDWfXFPB1U='],
  js: ['sites-bar.js', 'sha256-CocgHABQfdAOZrH/4dwXFz0kdfQtd8dfQfUNG9Cd4zM='],
};
const HERE = 'bulletins.promptugal.news';
const LAST = join(ROOT, 'data', 'sites-bar', 'last.html');

export function verifyPins() {
  for (const [f, want] of Object.values(PINS)) {
    const got = 'sha256-' + createHash('sha256').update(readFileSync(join(ROOT, 'src', BAR_DIR, f))).digest('base64');
    if (got !== want) throw new Error(`sites bar ${f}: its sha256 does not match its pin`);
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
  // The registry's own pins must equal ours, in full, when it names this version; a newer version waits for a review.
  if (reg?.bar?.version === BAR_VERSION) for (const [k, [f, want]] of Object.entries(PINS)) {
    if (reg.bar.integrity?.[k] !== want) throw new Error(`sites bar ${f}: the registry's pin is not ours`);
  } else console.log(`sites bar: the registry names ${String(reg?.bar?.version).slice(0, 12)}, we keep ${BAR_VERSION} until it is reviewed`);
  const html = render(reg, { here: HERE });
  if (!html) { console.log('sites bar: the renderer refused the registry; published without a bar'); return ''; }
  mkdirSync(join(ROOT, 'data', 'sites-bar'), { recursive: true });
  writeFileSync(LAST, html + '\n');
  writeJSON(join(ROOT, 'data', 'sites-bar', 'last.json'), { version: BAR_VERSION, registry_version: reg.version || null, read_at: new Date().toISOString(), sites: (reg.sites || []).length });
  return html;
}
