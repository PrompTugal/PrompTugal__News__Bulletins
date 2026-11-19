// Our predictions, kept as shown (Dinis, 19 Nov 2026, about 01:17 UTC: "show the past"; about 03:15 UTC: "the predictions
// are one collection"). Append-only JSON Lines in data/predictions/predictions.jsonl, in the library's form
// (library.promptugal.news/api/v1/predictions/form.json, library.b@ 8f8117b). A line is added when a published
// sentence quotes a forecast fact that carries a `pred` (bulletins/collect.mjs: Faro on P200, London on P700),
// and only when its value differs from the last line for the same subject and due day. No line is ever rewritten
// or deleted; a correction would be a new line with `corrects`. Outcome lines come later, from observations.
// No model and no key are used here. Usage: node bulletins/predictions.mjs (run.mjs calls it after writing).
import { existsSync, readFileSync, appendFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJSON, clean, sha } from './core.mjs';

const FILE = join(ROOT, 'data', 'predictions', 'predictions.jsonl');
const SITE = 'bulletins.promptugal.news';
const PAGES = { 200: 'IPMA', 700: 'Open-Meteo' }; // page -> who made the forecast
const MAX_LINES_PER_RUN = 50, MAX_BYTES = 5 * 1024 * 1024;
const minute = (iso) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(iso)) ? String(iso).slice(0, 16) + 'Z' : null);
const https = (u) => { if (typeof u !== 'string' || /[\s"'<>\\]/.test(u)) return null; try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password ? x.href : null; } catch { return null; } };
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
// A number is quoted when it stands alone: no digit, point or minus just before it, no digit or decimal part after.
const quoted = (n, text) => new RegExp(`(?<![0-9.\\-])${reEsc(n)}(?![0-9]|\\.[0-9])`).test(text);
const okValue = (v) => v && typeof v === 'object' && Object.keys(v).length && Object.entries(v).every(([k, x]) => ['t_min_c', 't_max_c', 'rain_prob_pct', 'rain_mm'].includes(k) && Number.isFinite(x) && x >= -60 && x <= 500);

// The last value kept for each subject and due day. A line that does not parse is skipped, never repaired.
function lastValues() {
  const last = new Map();
  if (!existsSync(FILE)) return last;
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    let x; try { x = JSON.parse(line); } catch { continue; }
    if (x?.type === 'prediction' && typeof x.subject === 'string' && typeof x.due === 'string') last.set(`${x.subject}|${x.due}`, JSON.stringify(x.value ?? null));
  }
  return last;
}

export function keepPredictions() {
  if (existsSync(FILE) && statSync(FILE).size > MAX_BYTES) { console.log('predictions: file over 5 MB, nothing appended'); return 0; }
  const last = lastValues();
  const out = [];
  pages: for (const [page, maker] of Object.entries(PAGES)) {
    const s = readJSON(join(ROOT, 'data', 'scripts', `${page}.json`), null);
    const shown = minute(s?.written);
    if (!s || !shown || !Array.isArray(s.kept)) continue;
    const byId = new Map((s.facts || []).map((f) => [f.id, f]));
    for (const sent of s.kept) for (const id of sent.facts || []) {
      const f = byId.get(id), p = f?.pred;
      if (!p || !okValue(p.value) || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.due)) || typeof p.subject !== 'string') continue;
      // Quoted means every number of the value appears in the published sentence; on any doubt, nothing is kept.
      const nums = Object.values(p.value).map(String);
      if (!nums.every((n) => quoted(n, sent.text))) continue;
      const licence = https(f.licence?.url) ? { name: clean(f.licence.name, 160), url: https(f.licence.url) } : null;
      const source = https(f.source);
      if (!licence || !source) continue;
      const key = `${p.subject}|${p.due}`, val = JSON.stringify(p.value);
      if (last.get(key) === val) continue;
      last.set(key, val);
      out.push({ type: 'prediction', id: `bul-${page}-${p.due}-${sha(key + shown + val).slice(0, 12)}`, site: SITE,
        page: `https://${SITE}/${page}/`, shown_at: shown, said_by: `${maker}, quoted by ${SITE}`, source, licence,
        kind: 'forecast', subject: clean(p.subject, 160), due: p.due, said: clean(sent.text, 320), value: p.value });
      if (out.length >= MAX_LINES_PER_RUN) break pages;
    }
  }
  if (out.length) {
    mkdirSync(join(ROOT, 'data', 'predictions'), { recursive: true });
    // A last line left without its newline gets one first, so the new line never joins it.
    const torn = existsSync(FILE) && statSync(FILE).size > 0 && !readFileSync(FILE, 'utf8').endsWith('\n');
    appendFileSync(FILE, (torn ? '\n' : '') + out.map((x) => JSON.stringify(x) + '\n').join(''), { flag: 'a' });
  }
  console.log(`predictions: ${out.length} new line(s)`);
  return out.length;
}

if (process.argv[1] && process.argv[1].endsWith('predictions.mjs')) keepPredictions();
