/* playground.js: pick a character and a move, set its parameters, trigger it, stack more. The page keeps a list of
 * cues exactly like choreography.json's and hands it to the same director the showcase uses, so what is tried here
 * can be pasted there. The state panel shows the pose the rig is applying in this very frame, as version 1's
 * explainer did with its eight numbers. */
import { Stage } from './engine/stage.js';
import { Director } from './engine/director.js';
import { Clock } from './engine/timeline.js';
import { CH, PARTS } from './engine/channels.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const MARK = [0, 0.7], GROUPS = ['version 1', 'idle', 'locomotion', 'gesture', 'head', 'face', 'reaction', 'special'];

async function main() {
  const get = (f) => fetch(f, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(f + ' did not load'); return r.json(); });
  const [data, moves, vis] = await Promise.all(['characters.json', 'moves.json', 'visemes.json'].map(get));
  const specs = data.presenters, frame = $('frame'), canvas = $('c');
  const stage = new Stage(canvas, specs, { flat: true });
  const base = [{ t: 0, who: 'all', do: 'place', to: MARK }];
  const dir = new Director({ specs, moves, chor: { duration: 3600, cues: base, auto: { idle: true, blink: true, fidget: false } }, chars: stage.byId, tracks: vis });
  let id = specs[0].id, move = 'wave', orbit = 18, dist = 1, lift = 0, W = 0, H = 0, mine = [];
  const hash = location.hash.slice(1); if (specs.some((s) => s.id === hash)) id = hash;

  // The state panel: one row per channel, grouped by body part.
  const rows = {};
  for (const [part, names] of Object.entries(PARTS)) { $('state').append(h('h3', null, part)); for (const n of names) { const r = h('div', 'zero'), bar = h('span', 'bar'), fill = h('i'), v = h('span', 'v', '0.00'); bar.append(fill); r.append(h('span', null, n), bar, v); $('state').append(r); rows[n] = { r, fill, v, last: null }; } }

  function resize() { const r = frame.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; stage.setSize(Math.max(2, Math.round(W * dpr)), Math.max(2, Math.round(H * dpr))); frame.style.setProperty('--u', (W / 1920 * 1.5) + 'px'); }
  function renderAt(t) {
    const f = dir.frame(t, [id]), p = f.poses[id], c = stage.byId[id], Hh = c.height, o = orbit * Math.PI / 180, d = (2.3 + Hh * 1.7) * dist;
    const x = p[CH.r_x], z = p[CH.r_z];
    const up = Math.max(0, p[CH.r_y]) * 0.75;      // follow a jump most of the way, so the figure still leaves the floor on screen
    stage.setCamera({ pos: [x + Math.sin(o) * d, Hh * (0.62 + lift) + up, z + Math.cos(o) * d], look: [x, Hh * 0.52 + up, z], fov: 28 });
    stage.render(f.poses, f.springs, t, id);
    for (const n in rows) { const r = rows[n], val = p[CH[n]], s = val.toFixed(2); if (s === r.last) continue; r.last = s; r.v.textContent = s; const k = Math.max(-1, Math.min(1, val / (n.startsWith('r_') && n.length === 3 ? 6 : 1.6))); r.fill.style.left = (k < 0 ? 50 + k * 50 : 50) + '%'; r.fill.style.width = Math.abs(k) * 50 + '%'; r.r.className = Math.abs(val) < 0.005 ? 'zero' : ''; }
    $('strapT').textContent = 't = ' + t.toFixed(2); $('clock').textContent = t.toFixed(2) + ' s';
    const live = mine.filter((a) => t >= a.t && t <= a.t + a.dur).map((a) => a.do); $('beat').textContent = live.length ? live.join(' + ') : ''; 
    for (const a of mine) if (a.li) a.li.className = t < a.t ? '' : t <= a.t + a.dur ? 'live' : 'done';
  }
  const clock = new Clock(3600, (t, c) => { renderAt(t); $('play').textContent = c.playing ? 'Pause' : 'Play'; });

  // 1. Characters.
  for (const s of specs) { const o = h('option', null, s.name); o.value = s.id; $('char').append(o); }
  function pickChar(v) {
    id = v; $('char').value = v; const s = stage.byId[id].spec; $('who').textContent = s.name;
    $('charNote').textContent = `${s.kind}, drawn as ${s.render}. Its own moves are outlined in yellow.` + (s.credit ? ' ' + s.credit : '');
    $('sub').textContent = s.name + ', a synthetic presenter'; buildMoves(); clock.seek(clock.t);
  }
  $('char').addEventListener('change', (e) => pickChar(e.target.value));

  // 2. Moves, grouped as in moves.json.
  function buildMoves() {
    const box = $('moves'); box.textContent = ''; const own = new Set(stage.byId[id].spec.specials || []);
    for (const g of GROUPS) {
      const names = Object.keys(moves.moves).filter((n) => moves.moves[n].group === g && n !== 'place' && !moves.moves[n].auto && (g !== 'special' || true));
      if (!names.length) continue; const wrap = h('div'), set = h('div', 'set'); wrap.append(h('h3', null, g), set);
      names.sort((a, b) => (own.has(b) ? 1 : 0) - (own.has(a) ? 1 : 0));
      for (const n of names) { const b = h('button', own.has(n) ? 'own' : '', n); b.type = 'button'; b.setAttribute('aria-pressed', String(n === move)); b.addEventListener('click', () => pickMove(n)); set.append(b); }
      box.append(wrap);
    }
  }
  // 3. Parameters, built from the move's own description.
  let inputs = {};
  function pickMove(n) {
    move = n; for (const b of $('moves').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.textContent === n));
    const m = moves.moves[n], box = $('params'); box.textContent = ''; inputs = {};
    box.append(h('p', 'about', `${n} (${m.kind === 'fn' ? 'one function' : 'pure data: ' + m.kind}). ${m.about}`));
    const add = (key, el) => { const l = h('label', null, key); l.htmlFor = 'p_' + key; el.id = 'p_' + key; box.append(l, el); inputs[key] = el; };
    const dur = h('input'); dur.type = 'number'; dur.min = 0.1; dur.max = 20; dur.step = 0.1; dur.value = m.dur || (m.loco ? '' : 3); dur.placeholder = 'from the distance'; add('dur', dur);
    for (const [k, p] of Object.entries(m.params || {})) {
      let el;
      if (p.type === 'choice') { el = h('select'); for (const o of p.options) { const op = h('option', null, o === '' ? '(none)' : o); op.value = o; el.append(op); } el.value = p.default; }
      else if (p.type === 'number') { el = h('input'); el.type = 'number'; el.min = p.min; el.max = p.max; el.step = p.step; el.value = p.default; }
      else { el = h('input'); el.type = 'text'; el.value = p.default.join(', '); el.title = p.default.length === 2 ? 'x, z on the stage, in metres' : 'x, y, z on the stage, in metres'; }
      add(k, el);
    }
  }
  function trigger(name = move, over = null) {
    const m = moves.moves[name], cue = { t: Math.round((clock.t + 0.05) * 1000) / 1000, who: id, do: name };
    if (over) Object.assign(cue, over);
    else for (const [k, el] of Object.entries(inputs)) {
      if (k === 'dur') { if (el.value !== '' && +el.value > 0) cue.dur = +el.value; continue; }
      const p = m.params[k]; if (p.type === 'number') cue[k] = +el.value; else if (p.type === 'choice') { if (el.value !== p.default) cue[k] = el.value; } else { const v = el.value.split(',').map(Number).filter((x) => x === x); if (v.length >= 2) cue[k] = v; }
    }
    dir.addCue(cue);
    const act = dir.actionsOf(id).find((a) => a.name === name && Math.abs(a.t - cue.t) < 1e-6), rec = { ...cue, dur: act ? act.dur : cue.dur || 1 };
    if (!mine.length) $('stack').textContent = '';
    rec.li = h('li'); rec.li.append(h('span', null, `${stage.byId[id].spec.name}: ${name}`), h('span', null, `${cue.t.toFixed(2)} s, ${rec.dur.toFixed(2)} s long`)); $('stack').prepend(rec.li); mine.push(rec);
    const t0 = mine[0].t; $('cues').value = mine.map((a) => { const { li, ...c } = a; return JSON.stringify({ ...c, t: Math.round((c.t - t0) * 1000) / 1000 }); }).join(',\n');
    if (!clock.playing) clock.play();
  }
  $('go').addEventListener('click', () => trigger());
  $('clear').addEventListener('click', () => { mine = []; dir.clearCues((c) => base.includes(c)); $('stack').textContent = ''; $('stack').append(h('li', 'done', 'Nothing triggered yet. Pick a move and press Trigger.')); $('cues').value = ''; clock.seek(clock.t); });
  $('home').addEventListener('click', () => trigger('walk', { to: MARK }));
  $('front').addEventListener('click', () => { orbit = 0; lift = 0; dist = 1; clock.seek(clock.t); });
  $('play').addEventListener('click', () => clock.toggle());
  $('speed').addEventListener('change', (e) => { clock.speed = +e.target.value; });
  $('idle').addEventListener('click', (e) => { const v = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(v)); e.currentTarget.textContent = v ? 'Idle on' : 'Idle off'; dir.chor.auto.idle = v; dir.chor.auto.blink = v; dir.changedFrom = clock.t; dir.build(); clock.seek(clock.t); });
  // The camera: drag to orbit, wheel to move in and out.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, orbit, lift]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; orbit = drag[2] - (e.clientX - drag[0]) * 0.4; lift = Math.max(-0.5, Math.min(0.9, drag[3] + (e.clientY - drag[1]) * 0.004)); if (!clock.playing) clock.seek(clock.t); });
  canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(0.35, Math.min(2.2, dist * (e.deltaY > 0 ? 1.08 : 0.93))); if (!clock.playing) clock.seek(clock.t); }, { passive: false });
  window.addEventListener('resize', () => { resize(); clock.seek(clock.t); });

  resize(); pickChar(id); pickMove(move);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) clock.seek(1); else clock.play();
  window.playground = { clock, dir, trigger, pickChar, pickMove, renderAt }; window.playgroundReady = true;
}
main().catch((e) => { const b = $('err'); b.hidden = false; b.textContent = 'The playground could not start: ' + (e && e.message ? e.message : e) + '. It needs WebGL, and the files must be served over http (see README.md).'; throw e; });
