// The PrompTugal sites bar, v1.1.1 (Dinis, 18 Nov 2026, main repo board/guidance/2026-11-18-the-sites-bar.md;
// 1.1.1 cleared by security@'s ruling of 19 Nov, 01:30 UTC, relayed by conductor.b@).
// The vendored files live in src/assets/sites-bar/1.1.1/. security@'s ruling of 19 Nov, 04:51 UTC (main repo
// board/team/security/reviews/2026-11-19-0120-ruling-public-keys-in-leak-scans.md, last addendum), option 1:
// no pin is copied into this repository. At every build the expected pins are read from the registry
// (promptugal.news/api/v1/sites.json, bar.integrity) and compared in full with the digest of each vendored file.
// The bar is published only when the registry names this version and every file matches its pin. A mismatch
// stops the build. If the registry cannot be read, or names another version (which waits for a review), the
// pages are published without a bar: an unchecked bar is never published, and never a hand-made one.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, getJSON, writeJSON } from './core.mjs';

export const BAR_VERSION = '1.1.1';
export const BAR_DIR = `assets/sites-bar/${BAR_VERSION}`;
const FILES = { render: 'sites-bar-render.mjs', css: 'sites-bar.css', js: 'sites-bar.js' };
const SRI = /^sha(256|384|512)-[A-Za-z0-9+/]{43,86}={0,2}$/;
const HERE = 'bulletins.promptugal.news';
const STATUS = join(ROOT, 'board', 'team', 'bulletins', 'status.json');

// Records in status.json which pieces are off and why (security@'s ruling, Website 1acd10498: the build log and
// status.json say "<piece> <version> off: the registry names <newer>"). null clears the entry.
function markOff(why) {
  let st; try { st = JSON.parse(readFileSync(STATUS, 'utf8')); } catch { return; }
  const off = (st.off || []).filter((x) => !x.startsWith('sites bar '));
  if (why) off.push(why);
  if (off.length) st.off = off; else delete st.off;
  writeFileSync(STATUS, JSON.stringify(st, null, 1) + '\n');
}
const off = (why) => { const line = `sites bar ${BAR_VERSION} off: ${why}`; console.log(line); markOff(line); return ''; };

// Throws if any vendored file does not match the registry's pin for it, in full.
export function checkAgainstRegistry(reg) {
  for (const [k, f] of Object.entries(FILES)) {
    const want = reg?.bar?.integrity?.[k];
    if (typeof want !== 'string' || !SRI.test(want)) throw new Error(`sites bar ${f}: the registry gives no pin in SRI form`);
    const algo = want.slice(0, want.indexOf('-'));
    const got = `${algo}-` + createHash(algo).update(readFileSync(join(ROOT, 'src', BAR_DIR, f))).digest('base64');
    if (got !== want) throw new Error(`sites bar ${f}: its digest does not match the registry's pin`);
  }
}

export async function loadBar() {
  let reg;
  try { reg = await getJSON('https://promptugal.news/api/v1/sites.json'); }
  catch (e) { return off(`the registry could not be read (${String(e.message).replace(/[^\w .:-]/g, '').slice(0, 60)})`); }
  if (reg?.bar?.version !== BAR_VERSION) return off(`the registry names ${String(reg?.bar?.version).replace(/[^\w.-]/g, '').slice(0, 12)}`);
  checkAgainstRegistry(reg); // before the renderer is imported
  const { render } = await import(pathToFileURL(join(ROOT, 'src', BAR_DIR, FILES.render)).href);
  const html = render(reg, { here: HERE });
  if (!html) return off('the renderer refused the registry');
  markOff(null);
  mkdirSync(join(ROOT, 'data', 'sites-bar'), { recursive: true });
  writeJSON(join(ROOT, 'data', 'sites-bar', 'last.json'), { version: BAR_VERSION, registry_version: reg.version || null, read_at: new Date().toISOString(), sites: (reg.sites || []).length, checked_against: 'promptugal.news/api/v1/sites.json bar.integrity' });
  return html;
}
