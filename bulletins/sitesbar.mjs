// The PrompTugal sites bar, v1.2.0 (Dinis, 18 Nov 2026, main repo board/guidance/2026-11-18-the-sites-bar.md; the one
// switcher Dinis asked for at 03:18 on 19 Nov; 1.2.0 cleared by security@, Website 055e6c1430, relayed by conductor.b@ 07:15).
// The vendored files live in src/assets/sites-bar/1.2.0/ (copied from the main repo at 67a07ab7). security@'s ruling of 19 Nov, 04:51 UTC (main repo
// board/team/security/reviews/2026-11-19-0120-ruling-public-keys-in-leak-scans.md, last addendum), option 1:
// no pin is copied into this repository. At every build the expected pins are read from the registry
// (promptugal.news/api/v1/sites.json, bar.versions["<our version>"].integrity, append-only since 19 Nov 07:03) and
// compared in full with the digest of each vendored file. A mismatch stops the build. If the registry cannot be read,
// or no longer lists our version, the bar is left out (logged and written to status.json as "sites bar <v> off: ..."):
// an unchecked bar is never published, and never a hand-made one. A newer version waits for a review.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, getJSON, writeJSON } from './core.mjs';

export const BAR_VERSION = '1.2.0';
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

// Our version's pins: bar.versions[v].integrity (or, for a registry without the versions list, bar.integrity when it names v).
const pinsFor = (reg) => reg?.bar?.versions?.[BAR_VERSION]?.integrity || reg?.bar?.versions?.[BAR_VERSION] || (reg?.bar?.version === BAR_VERSION ? reg.bar.integrity : null);
// Throws if any vendored file does not match the registry's pin for it, in full.
export function checkAgainstRegistry(reg) {
  const pins = pinsFor(reg);
  for (const [k, f] of Object.entries(FILES)) {
    const want = pins?.[k];
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
  if (!pinsFor(reg)) return off(`the registry no longer lists it (it names ${String(reg?.bar?.version).replace(/[^\w.-]/g, '').slice(0, 12)})`);
  if (reg?.bar?.version !== BAR_VERSION) console.log(`sites bar: the registry names ${String(reg.bar.version).replace(/[^\w.-]/g, '').slice(0, 12)}; we keep ${BAR_VERSION}, checked against its own pin, until the new one is reviewed`);
  checkAgainstRegistry(reg); // before the renderer is imported
  const { render } = await import(pathToFileURL(join(ROOT, 'src', BAR_DIR, FILES.render)).href);
  const html = render(reg, { here: HERE });
  if (!html) return off('the renderer refused the registry');
  markOff(null);
  mkdirSync(join(ROOT, 'data', 'sites-bar'), { recursive: true });
  writeJSON(join(ROOT, 'data', 'sites-bar', 'last.json'), { version: BAR_VERSION, registry_version: reg.version || null, read_at: new Date().toISOString(), sites: (reg.sites || []).length, checked_against: 'promptugal.news/api/v1/sites.json bar.integrity' });
  return html;
}
