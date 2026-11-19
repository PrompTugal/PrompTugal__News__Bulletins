// "What we said, what happened" for P200 (Faro) and P700 (London): Dinis, 19 Nov 2026, about 01:17 UTC ("show the
// past, not only the forecast"), drawn to designer@'s rule (main repo board/spec-past-and-forecast.md, PF1 to PF9) in
// its table view, the teletext form of the chart: past days first, then today, then the forecast (PF1); measured and
// forecast told apart in words, not colour alone (PF2, PF3); today marked (PF4); a gap is written as a gap (PF5); the
// record's first day stated (PF6); for each past day what we showed the day before beside what happened, the gap in
// plain units, a miss as plain as a hit (PF7); the track record in one computed line (PF8); a legend, a source line
// with read time and licence, and a link to the full record (PF9). The drawn chart comes later.
// Built from local files only (data/history/*.json from bulletins/outcomes.mjs, data/predictions/predictions.jsonl);
// every value is escaped where it lands. The held and missed rule is bulletins.b@'s proposal until Dinis says.
import { join } from 'node:path';
import { ROOT, readJSON, esc, safeLink } from './core.mjs';
import { readLines } from './predictions.mjs';

const PLACES = {
  200: { place: 'faro', name: 'Faro', station: "IPMA's station Faro (Aeródromo)", maker: 'IPMA', subject: 'Faro, ' },
  700: { place: 'london', name: 'London', station: "the Environment Agency's London rain gauges", maker: 'Open-Meteo (CC BY 4.0, weather data by Open-Meteo.com)', subject: 'London, ' },
};
const n1 = (v) => (Number.isFinite(v) ? String(Math.round(v * 10) / 10) : null);
const signed = (v) => (Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + String(Math.abs(Math.round(v * 10) / 10)) : '');
const prevDay = (d) => new Date(Date.parse(d + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);

// A showing: the temperature line and, shown at the same time, the rain line for the same day.
function said(t, r, page, moment) {
  if (!t) return 'nothing shown';
  const when = moment || t.shown_at;
  const v = t.value || {};
  const rain = r?.value ? (Number.isFinite(r.value.probability) ? `, ${Math.round(r.value.probability * 100)}% chance of rain` : Number.isFinite(r.value.value) ? `, ${n1(r.value.value)} mm of rain` : '') : '';
  return `${n1(v.low)} to ${n1(v.high)} °C${rain} (shown ${when.slice(5, 10)} ${when.slice(11, 16)} UTC${when.slice(0, 10) === t.due ? ', the same day' : ''})`;
}
function measured(o, page) {
  if (!o) return 'no reading';
  if (page === '200') {
    if (!Number.isFinite(o.low_c) || !Number.isFinite(o.high_c)) return 'no reading';
    const r = Number.isFinite(o.rain_mm) ? `, ${n1(o.rain_mm)} mm of rain` : '';
    return `${n1(o.low_c)} to ${n1(o.high_c)} °C${r}${o.complete ? '' : `, so far (${Number.isFinite(o.hours) ? Math.round(o.hours) : '?'} of 24 hours)`}`;
  }
  if (!Number.isFinite(o.rain_mm_mean)) return 'no reading';
  return `${n1(o.rain_mm_mean)} mm of rain (mean of ${Number.isFinite(o.gauges) ? Math.round(o.gauges) : '?'} gauges)${o.complete ? '' : ', so far'}; no observed temperature`;
}

export function pastBlock(page, today = new Date().toISOString().slice(0, 10)) {
  const P = PLACES[page]; if (!P) return '';
  const h = readJSON(join(ROOT, 'data', 'history', `${P.place}.json`), null);
  const lines = readLines();
  const preds = lines.filter((x) => x.type === 'prediction' && String(x.subject).startsWith(P.subject) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(String(x.shown_at)));
  const temps = preds.filter((x) => String(x.subject).includes('low and high'));
  const rains = preds.filter((x) => !String(x.subject).includes('low and high'));
  // A line is only written when its value changes, so what stood at a moment is the latest line shown by then.
  const at = (list, due, moment) => list.filter((x) => x.due === due && x.shown_at <= moment).sort((a, b) => a.shown_at.localeCompare(b.shown_at)).pop() || null;
  const outcome = new Map(lines.filter((x) => x.type === 'outcome').map((x) => [x.of, x]));
  if (!h || !Array.isArray(h.rows) || !temps.length) return '';
  // What we said for a day: the last one shown the day before (PF7's default); if none, the first one shown at all.
  // The moment: the last showing for that day made the day before; if none, the first showing at all. Returns the
  // temperature and rain lines as they stood then, and the moment itself.
  const pick = (due) => {
    const forDay = preds.filter((p) => p.due === due).map((p) => p.shown_at).sort();
    const moment = forDay.filter((t) => t.slice(0, 10) === prevDay(due)).pop() || forDay[0];
    return moment ? { t: at(temps, due, moment), rn: at(rains, due, moment), moment } : { t: null, rn: null, moment: null };
  };
  const first = h.first_day && /^\d{4}-\d{2}-\d{2}$/.test(h.first_day) ? h.first_day : h.rows[0]?.date;
  // Every day from the first to today, a gap row where the file has none (PF5: never filled in).
  const byDate = new Map(h.rows.map((r) => [r.date, r]));
  const past = [];
  for (let d = first; d && d <= today && past.length < 60; d = new Date(Date.parse(d + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10)) past.push(byDate.get(d) || { date: d, observed: null });
  const future = [...new Set(preds.map((p) => p.due).filter((d) => d > today))].sort().slice(0, 3);
  const row = (cells, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  const body = [];
  let judged = 0, held = 0, sameDay = 0, gaps = 0;
  for (const r of past) {
    const { t, rn, moment } = pick(r.date), o = r.observed;
    const outs = [t, rn].filter(Boolean).map((x) => outcome.get(x.id)).filter(Boolean);
    const judgedOuts = outs.filter((x) => x.result !== 'gap');
    const dayBefore = moment && moment.slice(0, 10) === prevDay(r.date);
    // A day counts as held only if every judged part held (temperature, and rain where it is judged).
    if (judgedOuts.length && dayBefore) { judged++; if (judgedOuts.every((x) => x.result === 'held')) held++; }
    else if (judgedOuts.length) sameDay++;
    else if (r.date < today) gaps++;
    const gap = outs.map((x) => x.difference).filter(Boolean).join(', ');
    const part = (x, name) => { const out = x ? outcome.get(x.id) : null; return out ? `${name} ${out.result === 'held' ? '✓ held' : out.result === 'missed' ? '✗ missed' : 'not judged (' + out.gap + ')'}` : null; };
    const words = [part(t, 'temperature'), part(rn, 'rain')].filter(Boolean).join('; ');
    const res = words ? (dayBefore ? words : `${words} (shown the same day, not counted)`) : (r.date === today ? 'today: not judged yet' : o?.complete ? 'not judged' : 'no full day');
    body.push(row([`${esc(r.date === today ? `Today, ${r.date}` : r.date)}`, `Measured: ${esc(measured(o, page))}`, `We said: ${esc(said(t, rn, page, moment))}`, esc(gap || '·'), esc(res)], r.date === today ? 'today' : ''));
  }
  for (const d of future) {
    const moment = preds.filter((x) => x.due === d).map((x) => x.shown_at).sort().pop();
    body.push(row([esc(d), 'Forecast', `We say: ${esc(said(at(temps, d, moment), at(rains, d, moment), page, moment))}`, '·', 'to come'], 'future'));
  }
  const src = safeLink(h.source), lic = h.licence?.url ? safeLink(h.licence.url) : null;
  const days = past.filter((r) => r.date < today).length;
  const record = `${judged ? `${held} of ${judged} judged ${judged === 1 ? 'day' : 'days'} held to what we said the day before` : 'No day judged yet against what we said the day before'}, of ${days} past ${days === 1 ? 'day' : 'days'} since ${first}: ${sameDay} judged on a forecast shown the same day (not counted), ${gaps} with no full reading or nothing to judge`;
  return `<h2>What we said, what happened</h2>
<p class="dim">Record begins ${esc(first)}. Measured: ${esc(P.station)}${src ? `, through <a href="${esc(src)}">data.promptugal.news's history file</a>` : ''}, read ${esc((h.read_at || '').replace('T', ' ').replace('Z', ' UTC'))}${lic ? `, licence <a href="${esc(lic)}">${esc(h.licence.name)}</a>` : ''}. What we said: ${esc(P.maker)}'s forecast, as this page showed it.</p>
<table class="past"><thead><tr><th>Day</th><th>Measured</th><th>What we said</th><th>Gap</th><th>Result</th></tr></thead><tbody>${body.join('')}</tbody></table>
<p class="dim">${esc(record)}. Rule (a proposal, not yet confirmed): temperatures held if within 2 °C on low and high${page === '200' ? '; rain held if it rained (0.2 mm or more) when the chance was 50% or more, and not otherwise' : '; rain held if within 2 mm of the gauges’ mean; London temperatures are not judged'}. Legend: Measured is what the station or gauges recorded; What we said is the forecast this page showed, the last one shown the day before, else the first shown; Forecast is a day still to come; no reading is a gap, never filled in. <a href="../api/v1/predictions.jsonl">The full record</a> (JSON Lines, every prediction and outcome).</p>`;
}
