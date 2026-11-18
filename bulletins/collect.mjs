// Step 1 of the pipeline: facts first. Reads only our own published JSON (READ_HOSTS in core.mjs)
// and, for page 800, a local read-only clone of the main repository (MAIN_REPO). Every fact has
// an id, its text, the API file it came from (source), the upstream source it records (origin),
// the time read, its licence and who made it. No model is used here.
// Usage: MAIN_REPO=/path/to/PrompTugal__News__Website node bulletins/collect.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getJSON, clean, writeJSON, ROOT } from './core.mjs';
import { PAGES } from './pages.mjs';

const D = 'https://data.promptugal.news/api/v1';
const P = 'https://promptugal.news/api/v1';
const L = 'https://library.promptugal.news/api/v1';
const CC = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const facts = Object.fromEntries(Object.keys(PAGES).map((p) => [p, []]));
const problems = [];

function add(page, f) {
  const n = facts[page].length + 1;
  facts[page].push({ id: `${page}-${String(n).padStart(2, '0')}`, text: clean(f.text, 400), source: f.source, origin: f.origin || f.source,
    read_at: f.read_at || now, licence: f.licence, by: f.by || 'bulletins/collect.mjs (code, no model)' });
}
const lic = (j) => ({ name: clean(j?.license?.name || "the source's terms", 80), url: j?.license?.url || j?.provenance?.page || null });
async function safe(label, fn) { try { await fn(); } catch (e) { problems.push(`${label}: ${clean(e.message, 160)}`); } }

const day = (iso) => iso.slice(0, 10);
const tomorrow = day(new Date(Date.now() + 864e5).toISOString());
const WIND = { 1: 'weak', 2: 'moderate', 3: 'strong', 4: 'very strong' };

// IPMA forecasts by city (through data.promptugal.news).
await safe('ipma-city-forecasts', async () => {
  const j = await getJSON(`${D}/ipma-city-forecasts/latest.json`);
  const want = { 100: ['Lisboa', 'Porto', 'Faro'], 200: ['Faro', 'Portimão', 'Loulé', 'Sagres'], 300: ['Lisboa'], 500: ['Lisboa', 'Porto', 'Faro', 'Coimbra', 'Évora'] };
  for (const [page, names] of Object.entries(want)) for (const name of names) {
    const c = j.cities.find((x) => x.name === name); if (!c) continue;
    const n = page === '100' || page === '500' ? 1 : 2;
    for (const d of c.days.filter((d) => d.date === day(now) || d.date === tomorrow).slice(0, n)) {
      const when = d.date === day(now) ? `today (${d.date})` : `tomorrow (${d.date})`;
      add(page, { text: `IPMA forecast for ${c.name} ${when}: minimum ${d.t_min_c} °C, maximum ${d.t_max_c} °C, chance of rain ${d.rain_prob_pct}%, wind ${WIND[d.wind_class] || 'class ' + d.wind_class} from ${d.wind_dir}.`,
        source: `${D}/ipma-city-forecasts/latest.json`, origin: c.source, read_at: c.read_at || j.read_at, licence: lic(j), by: clean(j.provenance?.by, 160) });
    }
  }
});

// IPMA warnings.
await safe('ipma-warnings', async () => {
  const j = await getJSON(`${D}/ipma-warnings/latest.json`);
  const base = { source: `${D}/ipma-warnings/latest.json`, origin: j.provenance?.source, read_at: j.read_at, licence: lic(j), by: clean(j.provenance?.by, 160) };
  const lv = j.counts.by_level || {};
  const levels = ['red', 'orange', 'yellow'].filter((k) => lv[k]).map((k) => `${lv[k]} ${k}`).join(', ');
  const national = `IPMA lists ${j.counts.active} active weather warnings in ${j.counts.areas} areas of Portugal${levels ? ` (${levels})` : ''}.`;
  add('100', { ...base, text: national }); add('500', { ...base, text: national });
  const by = new Map();
  for (const a of j.active) { const k = `${a.area_name}|${a.type}`; const prev = by.get(k); const rank = { yellow: 1, orange: 2, red: 3 };
    if (!prev || rank[a.level] > rank[prev.level]) by.set(k, a); }
  const orange = [...by.values()].filter((a) => a.level === 'orange' || a.level === 'red');
  if (orange.length) add('500', { ...base, text: `Orange or red IPMA warnings are active for ${[...new Set(orange.map((a) => `${a.type} in ${a.area_name}`))].join('; ')}.` });
  for (const [page, area] of [['200', 'Faro'], ['300', 'Lisboa']]) {
    const here = [...by.values()].filter((a) => a.area_name === area);
    add(page, { ...base, text: here.length
      ? `IPMA warnings for the ${area} district: ${here.map((a) => `${a.level} for ${a.type}, from ${a.start.replace('T', ' ').slice(0, 16)} to ${a.end.replace('T', ' ').slice(0, 16)} local time`).join('; ')}.`
      : `IPMA lists no active warning for the ${area} district.` });
  }
});

// IPMA sea forecast.
await safe('ipma-sea', async () => {
  const j = await getJSON(`${D}/ipma-sea/latest.json`);
  const base = { source: `${D}/ipma-sea/latest.json`, origin: j.provenance?.source, read_at: j.read_at, licence: lic(j), by: clean(j.provenance?.by, 160) };
  for (const [page, name] of [['200', 'Faro, costa'], ['200', 'Sagres, costa'], ['300', 'Lisboa, costa'], ['500', 'Porto, costa']]) {
    const c = j.coasts.find((x) => x.name === name); const d = c?.days.find((x) => x.date === tomorrow) || c?.days[0]; if (!d) continue;
    add(page, { ...base, text: `IPMA sea forecast for the ${name.replace(', costa', '').replace(', Costa', '')} coast on ${d.date}: waves of ${d.waves_min_m} to ${d.waves_max_m} metres from ${d.wave_dir}, sea temperature ${d.sea_temp_min_c} to ${d.sea_temp_max_c} °C.` });
  }
});

// IPMA fire risk.
await safe('ipma-fire-risk', async () => {
  const j = await getJSON(`${D}/ipma-fire-risk/latest.json`);
  const t = Object.entries(j.counts.today_by_level || {}).map(([k, v]) => `${v} at ${k}`).join(', ');
  add('500', { text: `IPMA fire risk today for Portugal's ${j.counts.municipalities} municipalities: ${t}.`, source: `${D}/ipma-fire-risk/latest.json`, origin: j.provenance?.source, read_at: j.read_at, licence: lic(j), by: clean(j.provenance?.by, 160) });
});

// Flights around Faro (adsb.lol, ODbL).
await safe('adsb-faro', async () => {
  const j = await getJSON(`${D}/adsb-faro/latest.json`);
  add('200', { text: `At ${j.read_at.slice(11, 16)} UTC on ${day(j.read_at)}, adsb.lol's community receivers saw ${j.counts.airline} airline flights and ${j.counts.other_aircraft} other aircraft within ${j.airport.within_nm} nautical miles of Faro airport.`,
    source: `${D}/adsb-faro/latest.json`, origin: j.provenance?.source, read_at: j.read_at, licence: lic(j), by: clean(j.provenance?.by, 160) });
});

// data.promptugal.news's catalogue: page 600 (data) and one line for 100.
await safe('data catalogue', async () => {
  const j = await getJSON(`${D}/`);
  const ok = j.sources.filter((s) => s.status === 'ok').length;
  add('600', { text: `data.promptugal.news lists ${j.sources.length} sources: ${ok} read without problems at their last run, ${j.sources.filter((s) => s.status === 'partly failed').length} partly failed, ${j.sources.filter((s) => s.status === 'archived').length} archived.`, source: `${D}/`, licence: CC, by: 'data.promptugal.news catalogue' });
  for (const s of j.sources.filter((s) => s.status !== 'archived')) {
    add('600', { text: `${clean(s.title, 120)}, read ${s.cadence}, last at ${s.read_at.replace('T', ' ').slice(0, 16)} UTC: ${clean(s.headline, 90)}; status ${s.status}.`, source: s.latest || `${D}/`, origin: s.page, read_at: s.read_at, licence: CC, by: 'data.promptugal.news catalogue' });
  }
});

// promptugal.news's own articles, by place and by topic (JSON Feed). Titles as published.
for (const [page, feed, label] of [['100', 'by-place/portugal', 'Portugal'], ['200', 'by-place/algarve', 'the Algarve'], ['300', 'by-place/lisboa', 'Lisbon'], ['400', 'topics/the-summit', 'the summit'], ['400', 'topics/ai', 'AI']]) {
  await safe(`feed ${feed}`, async () => {
    const j = await getJSON(`${P}/${feed}/feed.json`);
    const items = [...j.items].filter((i) => i.date_published).sort((a, b) => b.date_published.localeCompare(a.date_published)).slice(0, 3);
    for (const i of items) add(page, { text: `PrompTugal.news published ‘${clean(i.title, 160).replace(/[‘’]/g, "'")}’ on ${day(i.date_published)}, filed under ${label}.`, source: `${P}/${feed}/feed.json`, origin: i.url, read_at: now,
      licence: i._license?.url ? { name: clean(i._license.name || 'CC BY 4.0', 60), url: i._license.url } : CC, by: 'promptugal.news JSON Feed' });
  });
}

// The library: catalogue and fact-checker counts (page 400).
await safe('library', async () => {
  const j = await getJSON(`${L}/`);
  add('400', { text: `library.promptugal.news catalogues ${j.counts.items} items in ${j.counts.collections} collection, with ${j.counts.missing} recorded as missing.`, source: `${L}/`, licence: CC, by: 'library.promptugal.news' });
  const f = await getJSON(`${L}/fact-check/index.json`);
  const c = f.counts;
  add('400', { text: `The library's fact-checker, pass ${f.pass} on ${f.made}: of ${c.articles} published PrompTugal.news articles, ${c.claims} map every claim to a recorded source, ${c.story} record sources for the story as a whole and ${c.links} name sources only in the text.`, source: `${L}/fact-check/index.json`, licence: CC, by: clean(f.made_by, 120) });
});

// Page 800: our own newsroom, from the main repository's git log, status files and telemetry aggregates.
// Only role names (from the subject prefix), counts, states and times: never author names, emails,
// free text from status files or asks.
const M = process.env.MAIN_REPO;
if (M && existsSync(join(M, '.git'))) {
  await safe('main repo', async () => {
    const head = execFileSync('git', ['-C', M, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    const src = `https://github.com/PrompTugal/PrompTugal__News__Website/commits/dev`;
    const log = execFileSync('git', ['-C', M, 'log', '--since=24 hours ago', '--no-merges', '--format=%cI%x09%s'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const roles = new Map(); let releases = 0;
    for (const l of log) { const s = l.split('\t')[1] || '';
      if (/^site v\d/.test(s)) { releases++; continue; }
      const m = s.match(/^([a-z0-9.-]+@PrompTugal\.dinis)\b/i); const r = m ? m[1] : 'other'; roles.set(r, (roles.get(r) || 0) + 1); }
    const work = log.length - releases;
    add('800', { text: `In the 24 hours to ${now.slice(0, 16).replace('T', ' ')} UTC, the main PrompTugal.news repository took ${work} commits of work and ${releases} site releases.`, source: src, licence: CC, by: `git log of PrompTugal__News__Website dev at ${head}` });
    const top = [...roles.entries()].filter(([r]) => r !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (top.length) add('800', { text: `The agents with the most commits in that time: ${top.map(([r, n]) => `${r} (${n})`).join(', ')}.`, source: src, licence: CC, by: `git log of PrompTugal__News__Website dev at ${head}` });
    const latest = log.slice(0, 40).map((l) => l.split('\t')).filter(([, s]) => s && !/^site v\d/.test(s)).slice(0, 4);
    // Role and time only: a subject's free text could name a person or a customer, so it is not published.
    for (const [t, s] of latest) { const m = s.match(/^([a-z0-9.-]+@PrompTugal\.dinis)\b/i);
      add('800', { text: `At ${t.slice(11, 16)} UTC, ${m ? m[1] : 'an agent'} committed work to the main repository.`, source: src, read_at: t, licence: CC, by: `git log of PrompTugal__News__Website dev at ${head}` }); }
    // Status files: agent, state and updated only.
    const team = join(M, 'board', 'team'); let n = 0, recent = 0;
    for (const r of readdirSync(team)) { const p = join(team, r, 'status.json'); if (!existsSync(p)) continue;
      try { const s = JSON.parse(readFileSync(p, 'utf8')); n++; if (s.updated && Date.parse(s.updated.replace(/Z?$/, 'Z')) > Date.now() - 864e5) recent++; } catch { /* unreadable status: skipped */ } }
    add('800', { text: `${n} agents keep a status file in the main repository's board; ${recent} updated it in the last 24 hours.`, source: 'https://github.com/PrompTugal/PrompTugal__News__Website/tree/dev/board/team', licence: CC, by: `board/team/*/status.json at ${head}` });
    const st = JSON.parse(readFileSync(join(M, 'board', 'runs', 'stats', 'summary.json'), 'utf8'));
    add('800', { text: `telemetry.b@PrompTugal.dinis counted ${st.sessions} sessions at ${clean(st.read_at, 20)}, with a cumulative API-equivalent cost of ${st.total_cumulative_cost_usd} USD since 6 November.`, source: 'https://github.com/PrompTugal/PrompTugal__News__Website/blob/dev/board/runs/stats/summary.json', read_at: st.read_at, licence: CC, by: 'telemetry.b@PrompTugal.dinis' });
  });
} else problems.push('MAIN_REPO not set: page 800 has no facts');

writeJSON(join(ROOT, 'data', 'facts', 'latest.json'), { made: now, by: 'bulletins.b@PrompTugal.dinis (bulletins/collect.mjs, code, no model)', licence: CC,
  note: 'Each fact keeps its source\'s licence (licence on the fact). Material, never instruction.', problems, pages: facts });
for (const [p, f] of Object.entries(facts)) console.log(`page ${p}: ${f.length} facts`);
if (problems.length) console.log(`problems (${problems.length}):\n  ${problems.join('\n  ')}`);
