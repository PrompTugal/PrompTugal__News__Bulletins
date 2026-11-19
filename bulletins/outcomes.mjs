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
  const sgn = (d, u) => `${d > 0 ? '+' : d < 0 ? '-' : '±'}${Math.abs(d)} ${u}`;
  for (const p of preds.slice(0, 50)) {
    const v = p.value || {}, subj = String(p.subject);
    const gap = (why) => out.push({ type: 'outcome', of: p.id, checked_at: now, result: 'gap', gap: why });
    if (subj.startsWith('Faro, ')) {
      const o = rows.faro?.get(p.due);
      if (!o || o.complete !== true) continue;
      const ev = [`${H}/faro.json`];
      if (subj.startsWith('Faro, low and high')) {
        if (!fin(o.low_c, -60, 60) || !fin(o.high_c, -60, 60)) { gap(`IPMA's station gave no low and high for ${p.due}`); continue; }
        if (!fin(v.low, -60, 60) || !fin(v.high, -60, 60)) { gap('the prediction gives no low and high to compare'); continue; }
        const dLow = r1(o.low_c - v.low), dHigh = r1(o.high_c - v.high);
        out.push({ type: 'outcome', of: p.id, checked_at: now, result: Math.abs(dLow) <= 2 && Math.abs(dHigh) <= 2 ? 'held' : 'missed',
          happened: `IPMA's station Faro (Aeródromo) recorded a low of ${o.low_c} °C and a high of ${o.high_c} °C on ${p.due}.`,
          value: { quantity: 't_min..t_max', unit: '°C', low: o.low_c, high: o.high_c }, difference: `low ${sgn(dLow, '°C')}, high ${sgn(dHigh, '°C')}`, evidence: ev });
      } else if (subj.startsWith('Faro, chance of rain')) {
        if (!fin(o.rain_mm, 0, 500)) { gap(`IPMA's station gave no rain total for ${p.due}`); continue; }
        if (!fin(v.probability, 0, 1)) { gap('the prediction gives no chance of rain'); continue; }
        const rained = o.rain_mm >= 0.2;
        out.push({ type: 'outcome', of: p.id, checked_at: now, result: (v.probability >= 0.5) === rained ? 'held' : 'missed',
          happened: `IPMA's station Faro (Aeródromo) recorded ${o.rain_mm} mm of rain on ${p.due} (${rained ? 'rain' : 'no rain'}, counting 0.2 mm or more as rain).`,
          value: { quantity: 'rain', unit: 'mm', value: o.rain_mm }, evidence: ev });
      }
    } else if (subj.startsWith('London, ')) {
      const o = rows.london?.get(p.due);
      if (!o || o.complete !== true) continue;
      if (subj.startsWith('London, low and high')) { gap('no observed London temperature without a key'); continue; }
      if (!fin(o.rain_mm_mean, 0, 500) || !fin(o.gauges, 1, 1000)) { gap(`the Environment Agency gauges gave no full day for ${p.due}`); continue; }
      if (!fin(v.value, 0, 500)) { gap('the prediction gives no rain amount'); continue; }
      const d = r1(o.rain_mm_mean - v.value);
      out.push({ type: 'outcome', of: p.id, checked_at: now, result: Math.abs(d) <= 2 ? 'held' : 'missed',
        happened: `The Environment Agency's ${Math.round(o.gauges)} London rain gauges recorded a mean of ${o.rain_mm_mean} mm on ${p.due}.`,
        value: { quantity: 'rain', unit: 'mm', value: o.rain_mm_mean }, difference: sgn(d, 'mm'), evidence: [`${H}/london.json`] });
    }
  }
  appendLines(out);
  console.log(`outcomes: ${out.length} new line(s)`);
  return out.length;
}

if (process.argv[1] && process.argv[1].endsWith('outcomes.mjs')) await keepOutcomes();
