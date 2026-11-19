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
  200: { place: 'faro', name: 'Faro', station: "IPMA's station Faro (Aeródromo)", maker: 'IPMA', subject: 'Faro ' },
  700: { place: 'london', name: 'London', station: "the Environment Agency's London rain gauges", maker: 'Open-Meteo (CC BY 4.0, weather data by Open-Meteo.com)', subject: 'London ' },
};
const n1 = (v) => (Number.isFinite(v) ? String(Math.round(v * 10) / 10) : null);
const signed = (v) => (Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + String(Math.abs(Math.round(v * 10) / 10)) : '');
const prevDay = (d) => new Date(Date.parse(d + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);

function said(p, page) {
  if (!p) return 'nothing shown';
  const v = p.value || {};
  const t = `${n1(v.t_min_c)} to ${n1(v.t_max_c)} °C`;
  const rain = page === '200' ? (Number.isFinite(v.rain_prob_pct) ? `, ${v.rain_prob_pct}% chance of rain` : '') : (Number.isFinite(v.rain_mm) ? `, ${n1(v.rain_mm)} mm of rain` : '');
  return `${t}${rain} (shown ${p.shown_at.slice(5, 10)} ${p.shown_at.slice(11, 16)} UTC${p.shown_at.slice(0, 10) === p.due ? ', the same day' : ''})`;
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
  const outcome = new Map(lines.filter((x) => x.type === 'outcome').map((x) => [x.of, x]));
  if (!h || !Array.isArray(h.rows) || !preds.length) return '';
  // What we said for a day: the last one shown the day before (PF7's default); if none, the first one shown at all.
  const pick = (due) => {
    const forDay = preds.filter((p) => p.due === due).sort((a, b) => a.shown_at.localeCompare(b.shown_at));
    return forDay.filter((p) => p.shown_at.slice(0, 10) === prevDay(due)).pop() || forDay[0] || null;
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
    const p = pick(r.date), o = r.observed, out = p ? outcome.get(p.id) : null;
    const dayBefore = p && p.shown_at.slice(0, 10) === prevDay(r.date);
    if (out && dayBefore && out.result !== 'gap') { judged++; if (out.result === 'held') held++; }
    else if (out && !dayBefore && out.result !== 'gap') sameDay++;
    else if (r.date < today && !(out && out.result !== 'gap')) gaps++;
    const gap = out?.difference ? Object.entries(out.difference).map(([k, v]) => `${k === 't_min_c' ? 'low' : k === 't_max_c' ? 'high' : 'rain'} ${signed(v)}${k === 'rain_mm' ? ' mm' : '°'}`).join(', ') : '';
    const word = out ? (out.result === 'held' ? '✓ held' : out.result === 'missed' ? '✗ missed' : 'gap') : null;
    const res = word ? (dayBefore || out.result === 'gap' ? word : `${word} (shown the same day, not counted)`) : (r.date === today ? 'today: not judged yet' : o?.complete ? 'not judged' : 'no full day');
    body.push(row([`${esc(r.date === today ? `Today, ${r.date}` : r.date)}`, `Measured: ${esc(measured(o, page))}`, `We said: ${esc(said(p, page))}`, esc(gap || '·'), esc(res)], r.date === today ? 'today' : ''));
  }
  for (const d of future) {
    const p = preds.filter((x) => x.due === d).sort((a, b) => a.shown_at.localeCompare(b.shown_at)).pop();
    body.push(row([esc(d), 'Forecast', `We say: ${esc(said(p, page))}`, '·', 'to come'], 'future'));
  }
  const src = safeLink(h.source), lic = h.licence?.url ? safeLink(h.licence.url) : null;
  const days = past.filter((r) => r.date < today).length;
  const record = `${judged ? `${held} of ${judged} judged ${judged === 1 ? 'day' : 'days'} held to what we said the day before` : 'No day judged yet against what we said the day before'}, of ${days} past ${days === 1 ? 'day' : 'days'} since ${first}: ${sameDay} judged on a forecast shown the same day (not counted), ${gaps} with no full reading or nothing to judge`;
  return `<h2>What we said, what happened</h2>
<p class="dim">Record begins ${esc(first)}. Measured: ${esc(P.station)}${src ? `, through <a href="${esc(src)}">data.promptugal.news's history file</a>` : ''}, read ${esc((h.read_at || '').replace('T', ' ').replace('Z', ' UTC'))}${lic ? `, licence <a href="${esc(lic)}">${esc(h.licence.name)}</a>` : ''}. What we said: ${esc(P.maker)}'s forecast, as this page showed it.</p>
<table class="past"><thead><tr><th>Day</th><th>Measured</th><th>What we said</th><th>Gap</th><th>Result</th></tr></thead><tbody>${body.join('')}</tbody></table>
<p class="dim">${esc(record)}. Rule (a proposal, not yet confirmed): temperatures held if within 2 °C on low and high${page === '200' ? '; rain held if it rained (0.2 mm or more) when the chance was 50% or more, and not otherwise' : '; rain held if within 2 mm of the gauges’ mean; London temperatures are not judged'}. Legend: Measured is what the station or gauges recorded; What we said is the forecast this page showed, the last one shown the day before, else the first shown; Forecast is a day still to come; no reading is a gap, never filled in. <a href="../api/v1/predictions.jsonl">The full record</a> (JSON Lines, every prediction and outcome).</p>`;
}
