// What happened, beside what we said (Dinis, 19 Nov 2026, about 01:17 UTC: "show the past"; a miss shown as plainly
// as a hit). For each prediction in data/predictions/predictions.jsonl whose due day is complete in data.promptugal.news's
// history files, one outcome line is appended, once, in the library's form (type, of, checked_at, result, happened,
// evidence, value, difference). The rule (a proposal by bulletins.b@, 19 Nov, open to Dinis and designer@):
//   Faro (IPMA station Faro, Aeródromo): held if the observed low and high are each within 2 °C of the forecast and,
//     when a chance of rain was given, rain fell (0.2 mm or more) if the chance was 50% or more and not otherwise.
//   London (Environment Agency gauges): no observed temperature (none without a key), so only the rain is judged:
//     held if the mean of the gauges is within 2 mm of the forecast.
// A day not yet complete is left for a later run. No model is used. Run: node bulletins/outcomes.mjs
import { getJSON, clean, writeJSON, ROOT } from './core.mjs';
import { join } from 'node:path';
import { https } from './predictions.mjs';
import { readLines, appendLines, minute } from './predictions.mjs';

const H = 'https://data.promptugal.news/api/v1/history/weather';
const fin = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const r1 = (v) => Math.round(v * 10) / 10;
const now = minute(new Date().toISOString());

// A checked local copy of the history we read, so pages are built from files (no fetch at render): dates by pattern,
// numbers only if finite and in range, complete only if exactly true; licence and source kept for the page's source line.
const NUMS = { low_c: [-60, 60], high_c: [-60, 60], rain_mm: [0, 500], hours: [0, 24], rain_mm_mean: [0, 500], gauges: [0, 1000] };
function keepCopy(place, j) {
  const day = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? String(d) : null;
  const obs = (o) => Object.fromEntries([...Object.entries(NUMS).filter(([k, [lo, hi]]) => fin(o?.[k], lo, hi)).map(([k]) => [k, o[k]]), ['complete', o?.complete === true]]);
  writeJSON(join(ROOT, 'data', 'history', `${place}.json`), {
    about: `Our checked copy of ${H}/${place}.json (observed values only), read by bulletins/outcomes.mjs.`,
    source: `${H}/${place}.json`, read_at: now, data_read_at: minute(j.data_read_at),
    // The first day we keep (the last 60 rows), so the page never claims a start it does not show.
    first_day: [day(j.first_day), day((j.rows || []).slice(-60)[0]?.date)].filter(Boolean).sort().pop() || null,
    licence: { name: clean(j.license?.name || "the source's terms", 120), url: https(j.license?.url) },
    rows: (j.rows || []).slice(-60).map((r) => ({ date: day(r?.date), observed: obs(r?.observed) })).filter((r) => r.date) });
}

export async function keepOutcomes() {
  const lines = readLines();
  const done = new Set(lines.filter((x) => x.type === 'outcome').map((x) => x.of));
  const preds = lines.filter((x) => x.type === 'prediction' && !done.has(x.id) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.due)));
  const rows = {};
  for (const place of ['faro', 'london']) {
    try {
      const j = await getJSON(`${H}/${place}.json`);
      rows[place] = new Map((j.rows || []).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(String(r?.date))).map((r) => [r.date, r.observed || {}]));
      keepCopy(place, j);
    }
    catch (e) { console.log(`outcomes: ${place} history not read (${clean(e.message, 80)})`); }
  }
  const out = [];
  for (const p of preds.slice(0, 50)) {
    const v = p.value || {};
    if (String(p.subject).startsWith('Faro ')) {
      const o = rows.faro?.get(p.due);
      if (!o || o.complete !== true || !fin(o.low_c, -60, 60) || !fin(o.high_c, -60, 60)) continue;
      if (!fin(v.t_min_c, -60, 60) || !fin(v.t_max_c, -60, 60)) { out.push({ type: 'outcome', of: p.id, checked_at: now, result: 'gap', gap: 'the prediction gives no minimum and maximum to compare' }); continue; }
      if (fin(v.rain_prob_pct, 0, 100) && !fin(o.rain_mm, 0, 500)) { out.push({ type: 'outcome', of: p.id, checked_at: now, result: 'gap', gap: `IPMA's station gave no rain total for ${p.due}` }); continue; }
      const dLow = r1(o.low_c - v.t_min_c), dHigh = r1(o.high_c - v.t_max_c);
      const tempOk = Math.abs(dLow) <= 2 && Math.abs(dHigh) <= 2;
      let rainTxt = '', rainOk = true;
      if (fin(v.rain_prob_pct, 0, 100) && fin(o.rain_mm, 0, 500)) {
        const rained = o.rain_mm >= 0.2; rainOk = (v.rain_prob_pct >= 50) === rained;
        rainTxt = ` and ${o.rain_mm} mm of rain (${v.rain_prob_pct}% chance was given)`;
      }
      out.push({ type: 'outcome', of: p.id, checked_at: now, result: tempOk && rainOk ? 'held' : 'missed',
        happened: `IPMA's station Faro (Aeródromo) recorded a low of ${o.low_c} °C and a high of ${o.high_c} °C on ${p.due}${rainTxt}, ${fin(o.hours, 1, 24) ? Math.round(o.hours) : 'unknown'} hours of readings.`,
        evidence: `${H}/faro.json`, value: { low_c: o.low_c, high_c: o.high_c, rain_mm: fin(o.rain_mm, 0, 500) ? o.rain_mm : null },
        difference: { t_min_c: dLow, t_max_c: dHigh } });
    } else if (String(p.subject).startsWith('London ')) {
      const o = rows.london?.get(p.due);
      if (!o || o.complete !== true || !fin(o.rain_mm_mean, 0, 500) || !fin(o.gauges, 1, 1000)) continue;
      if (!fin(v.rain_mm, 0, 500)) { out.push({ type: 'outcome', of: p.id, checked_at: now, result: 'gap', gap: 'no rain amount was forecast, and London has no observed temperature without a key' }); continue; }
      const d = r1(o.rain_mm_mean - v.rain_mm);
      out.push({ type: 'outcome', of: p.id, checked_at: now, result: Math.abs(d) <= 2 ? 'held' : 'missed',
        happened: `The Environment Agency's ${o.gauges} London rain gauges recorded a mean of ${o.rain_mm_mean} mm on ${p.due}. The temperatures are not judged: there is no observed London temperature without a key.`,
        evidence: `${H}/london.json`, value: { rain_mm_mean: o.rain_mm_mean, gauges: Math.round(o.gauges) }, difference: { rain_mm: d } });
    }
  }
  appendLines(out);
  console.log(`outcomes: ${out.length} new line(s)`);
  return out.length;
}

if (process.argv[1] && process.argv[1].endsWith('outcomes.mjs')) await keepOutcomes();
