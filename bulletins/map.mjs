// The shared map (Dinis, about 17:40 UTC 19 Nov 2026, main repo board/guidance/2026-11-19-cameras-as-links-and-the-map.md):
// Portugal big, London small. designer@'s ptmap 1.0.0, cleared by security@ (main repo b5fc4fdef,
// board/team/security/reviews/2026-11-19-1937-ptmap-1.0.0.md), vendored from PrompTugal__News__Website
// design/shared-map/v1.0.0/ into src/assets/ptmap/1.0.0/, never loaded from another host. Its outline is Natural Earth
// (public domain) via world-atlas (ISC); the ISC notice is carried in ptmap.js. No EU inset: this site has no EU data.
// The build stops if a vendored file does not match its pin, or if the registry lists 1.0.0 with other pins.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getJSON } from './core.mjs';

export const MAP_VERSION = '1.0.0';
export const MAP_DIR = `assets/ptmap/${MAP_VERSION}`;
// The pins are read from the registry (promptugal.news/api/v1/sites.json, map), never stored here, as for the sites bar.
const FILES = ['ptmap.js', 'ptmap.css'];
const SRI = /^sha(256|384|512)-[A-Za-z0-9+/]{43,88}={0,2}$/;
const SITE = 'https://bulletins.promptugal.news';
// Places this site has pages for. The coordinates are approximate city centres, set by bulletins.b@ (a stopgap
// until ontologist@'s data/site/places-registry.json carries "at"); they only place a dot.
export const MAP_DATA = {
  label: 'Places with a bulletin on this site',
  current: null,
  places: [
    { id: 'faro', name: 'Algarve (Faro), page 200', at: [-7.93, 37.02], href: `${SITE}/200/` },
    { id: 'lisboa', name: 'Lisbon, page 300', at: [-9.14, 38.72], href: `${SITE}/300/` },
  ],
  london: { href: `${SITE}/700/` },
  eu: null,
};

const digest = (f, algo) => `${algo}-` + createHash(algo).update(readFileSync(join(ROOT, 'src', MAP_DIR, f))).digest('base64');
let ON = false;
export const mapOn = () => ON;
// The map is drawn only if the registry lists 1.0.0 with a pin for each file and every vendored file matches its
// pin. If the registry cannot be read or does not list it, the map is left off (logged). A mismatch stops the build.
export async function checkMap() {
  ON = false;
  let reg = null;
  try { reg = await getJSON('https://promptugal.news/api/v1/sites.json'); } catch (e) { console.log('map: off, the registry was not read'); return false; }
  const m = reg?.map;
  const pins = m?.versions?.[MAP_VERSION]?.integrity || m?.versions?.[MAP_VERSION] || (m?.version === MAP_VERSION ? m.integrity : null);
  if (!pins || typeof pins !== 'object') { console.log(`map: off, the registry does not list ptmap ${MAP_VERSION}`); return false; }
  for (const f of FILES) {
    const want = pins[f] ?? pins[f.replace('ptmap.', '')];
    if (typeof want !== 'string' || !SRI.test(want)) throw new Error(`ptmap ${f}: the registry lists ${MAP_VERSION} without a pin in SRI form`);
    if (digest(f, want.slice(0, want.indexOf('-'))) !== want) throw new Error(`ptmap ${f}: does not match the registry's pin`);
  }
  ON = true;
  return true;
}
