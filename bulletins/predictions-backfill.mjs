// One-off: the forecasts we showed before data/predictions/predictions.jsonl existed (18 Nov 2026 onwards), taken
// from every committed version of data/scripts/200.json and 700.json. They were already kept as shown (the scripts
// are in git); this copies them into the predictions file with their own shown_at, so each can be checked against
// what happened. The numbers are read from our own fixed fact templates (bulletins/collect.mjs), never from model
// text, and a line is kept only if a published sentence of that version quotes every number. Lines are appended;
// none is rewritten. A version whose value did not change from the version before it adds nothing; a line that is
// already in the file (same subject, due day, value and shown_at) is skipped. Run: node bulletins/predictions-backfill.mjs
import { execFileSync } from 'node:child_process';
import { ROOT, clean, sha } from './core.mjs';
import { SITE, https, quoted, okValue, minute, readLines, appendLines } from './predictions.mjs';

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 4 << 20 });
const num = '(-?\\d{1,3}(?:\\.\\d{1,2})?)';
const DATE = '(\\d{4}-\\d{2}-\\d{2})';
const FORMS = {
  200: { maker: 'IPMA', subject: 'Faro daily minimum and maximum temperature (IPMA city forecast)',
    re: new RegExp(`^IPMA forecast for Faro (?:today|tomorrow) \\(${DATE}\\): minimum ${num} °C, maximum ${num} °C, chance of rain ${num}%`),
    value: (m) => ({ t_min_c: +m[2], t_max_c: +m[3], rain_prob_pct: +m[4] }) },
  700: { maker: 'Open-Meteo', subject: 'London daily minimum and maximum temperature and rain (Open-Meteo forecast)',
    re: new RegExp(`^Open-Meteo forecast for London (?:today|tomorrow) \\(${DATE}\\): minimum ${num} °C, maximum ${num} °C, rain ${num} mm\\.`),
    value: (m) => ({ t_min_c: +m[2], t_max_c: +m[3], rain_mm: +m[4] }) },
};

const have = new Set(readLines().filter((x) => x.type === 'prediction').map((x) => `${x.subject}|${x.due}|${JSON.stringify(x.value)}|${x.shown_at}`));
const out = [];
for (const [page, form] of Object.entries(FORMS)) {
  const revs = git('log', '--reverse', '--format=%H', '--', `data/scripts/${page}.json`).split('\n').filter((r) => /^[0-9a-f]{40}$/.test(r)).slice(-200);
  const last = new Map();
  for (const rev of revs) {
    let s; try { s = JSON.parse(git('show', `${rev}:data/scripts/${page}.json`)); } catch { continue; }
    const shown = minute(s?.written);
    if (!shown || !Array.isArray(s.kept) || !Array.isArray(s.facts)) continue;
    const byId = new Map(s.facts.map((f) => [f.id, f]));
    for (const sent of s.kept) for (const id of sent.facts || []) {
      const f = byId.get(id); const m = typeof f?.text === 'string' && f.text.match(form.re);
      if (!m) continue;
      const value = form.value(m), due = m[1];
      if (!okValue(value) || !Object.values(value).map(String).every((n) => quoted(n, String(sent.text)))) continue;
      const source = https(f.source), url = https(f.licence?.url);
      if (!source || !url) continue;
      const key = `${form.subject}|${due}`, val = JSON.stringify(value);
      if (last.get(key) === val) continue;
      last.set(key, val);
      if (have.has(`${key}|${val}|${shown}`)) continue;
      out.push({ type: 'prediction', id: `bul-${page}-${due}-${sha(key + shown + val).slice(0, 12)}`, site: SITE, page: `https://${SITE}/${page}/`,
        shown_at: shown, said_by: `${form.maker}, quoted by ${SITE}`, source, licence: { name: clean(f.licence.name, 160), url },
        kind: 'forecast', subject: form.subject, due, said: clean(sent.text, 320), value });
    }
  }
}
appendLines(out);
console.log(`backfill: ${out.length} prediction line(s) appended`);
