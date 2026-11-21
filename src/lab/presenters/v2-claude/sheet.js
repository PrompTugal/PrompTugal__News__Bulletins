/* sheet.js: the model sheet. One hidden WebGL canvas draws each cell in turn and the picture is copied into the
 * cell's own 2D canvas, so 400 pictures need one renderer. Every cell is the showcase's own machinery asked a
 * question: "this character, this move, this moment, from this side". Nothing here is a special drawing. */
import { Stage } from './engine/stage.js';
import { Director } from './engine/director.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const VIEWS = [['Front', 0], ['Three-quarter left', 40], ['Side left', 90], ['Back', 180], ['Side right', -90], ['Three-quarter right', -40]];
const FACES = ['neutral', 'smile', 'laugh', 'surprised', 'concerned', 'sceptical', 'thinking', 'delighted'];
const MOUTHS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
const POSES = [['wave', 0.5], ['pointAt', 0.5], ['count', 0.8], ['think', 0.5], ['armsCrossed', 0.5], ['jump', 0.54], ['crouchToStand', 0.45], ['celebrate', 0.6]];
// Where the head is (as a fraction of the height) and how close a head shot stands, per body plan.
const HEAD = { humanoid: [0.915, 1.45], boxbot: [0.82, 2.1], owl: [0.86, 2.3], cube3d: [0.5, 3.0], mosaic: [0.8, 3.3] };
const SIZE = { views: [360, 500], faces: [300, 300], mouths: [240, 200], poses: [330, 460] };

async function main() {
  const get = (f) => fetch(f, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(f + ' did not load'); return r.json(); });
  const [data, moves] = await Promise.all(['characters.json', 'moves.json'].map(get));
  const specs = data.presenters, gl = document.createElement('canvas');
  const stage = new Stage(gl, specs, { alpha: true, set: false, flat: true, shadows: false });
  // One timeline holds every question: each gets its own ten-second slot, so no move overlaps another.
  const cues = [], slot = {}; let T = 0; const next = (key) => { slot[key] = T; T += 10; return slot[key]; };
  VIEWS.forEach(([, deg]) => cues.push({ t: next('v' + deg), who: 'all', do: 'place', to: 'slot', yaw: deg }));
  cues.push({ t: next('front'), who: 'all', do: 'place', to: 'slot', yaw: 0 });
  FACES.forEach((n) => cues.push({ t: next('f' + n), who: 'all', do: 'expression', name: n, dur: 2 }));
  MOUTHS.forEach((n) => cues.push({ t: next('m' + n), who: 'all', do: 'viseme', shape: n, dur: 1 }));
  POSES.forEach(([n]) => cues.push({ t: next('p' + n), who: 'all', do: n, ...(n === 'pointAt' ? { target: [-2.5, 2.2, 3] } : {}) }));
  const special = {}; for (const s of specs) (s.specials || []).forEach((n, i) => { special[s.id + i] = T; cues.push({ t: T, who: s.id, do: n }); T += 10; });
  const dir = new Director({ specs, moves, chor: { duration: T + 10, cues, auto: { idle: false, blink: false, fidget: false } }, chars: stage.byId });
  const jobs = [], dpr = window.innerWidth < 900 ? 0.75 : Math.min(2, window.devicePixelRatio || 1);   // a phone gets smaller drawings: there are about 370 of them
  const cell = (grid, kind, label, job) => { const f = h('figure', 'cell'), c = document.createElement('canvas'); c.width = SIZE[kind][0] * dpr; c.height = SIZE[kind][1] * dpr; c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); f.append(c, h('figcaption', null, label)); grid.append(f); jobs.push({ c, kind, ...job }); };
  for (const s of specs) {
    const sec = h('section', 'char'); sec.id = s.id; const head = h('header');
    head.append(h('h2', null, s.name), h('span', 'kind', `${data.label || 'synthetic presenter'}: ${s.kind}, drawn as ${s.render}`), h('span', 'dim', s.tags.join(', ')));
    if (s.credit) head.append(h('span', 'credit', s.credit)); sec.append(head);
    const a = h('a', null, s.name); a.href = '#' + s.id; $('nav').append(a);
    const H = stage.byId[s.id].height, body = { dist: 2.3 + H * 1.62, h: 0.56, lh: 0.5 }, [fh, fd] = HEAD[s.kind], face = { dist: fd, h: fh + 0.01, lh: fh };
    const bd = 'cells bd-' + s.backdrop;
    sec.append(h('h3', null, 'Turnaround'));
    let g = h('div', bd + ' views'); sec.append(g); VIEWS.forEach(([name, deg]) => cell(g, 'views', `${s.name}: ${name.toLowerCase()}`, { id: s.id, t: slot['v' + deg] + 1, shot: body }));
    sec.append(h('h3', null, 'Expressions'));
    g = h('div', bd + ' faces'); sec.append(g); FACES.forEach((n) => cell(g, 'faces', `${s.name}: ${n}`, { id: s.id, t: slot['f' + n] + 1, shot: face }));
    sec.append(h('h3', null, 'Mouth shapes for lip-sync (Rhubarb A to H, and X for rest)'));
    g = h('div', bd + ' mouths'); sec.append(g); MOUTHS.forEach((n) => cell(g, 'mouths', `${n}: ${moves.visemes[n].sound}`, { id: s.id, t: slot['m' + n] + 0.5, shot: { ...face, dist: fd * 0.8, h: fh - 0.02, lh: fh - 0.03 } }));
    sec.append(h('h3', null, 'Key poses and specials'));
    g = h('div', bd + ' poses'); sec.append(g);
    const wide = { dist: body.dist * 1.2, h: 0.64, lh: 0.6 }, CLOSE = new Set(['microExpression', 'clockSpin', 'magnify', 'headTurn270', 'antennaSpark', 'straightenTie']);
    POSES.forEach(([n, u]) => cell(g, 'poses', `${s.name}: ${n}`, { id: s.id, t: slot['p' + n] + u * (moves.moves[n].dur || 2), shot: wide }));
    (s.specials || []).forEach((n, i) => cell(g, 'poses', `${s.name}: ${n} (special)`, { id: s.id, t: special[s.id + i] + 0.55 * moves.moves[n].dur, shot: CLOSE.has(n) ? { ...face, dist: fd * 1.5 } : wide }));
    $('sheet').append(sec);
  }
  // Draw a few cells per animation frame so the page stays usable while the sheet fills in.
  let i = 0; const total = jobs.length;
  function draw(j) {
    stage.setSize(j.c.width, j.c.height);
    stage.setCamera(dir.shot({ focus: j.id, fov: 26, ...j.shot }, j.t)); stage.render({ [j.id]: dir.poseAt(j.id, j.t) }, null, j.t, j.id);
    j.c.getContext('2d').drawImage(gl, 0, 0);
  }
  function step() { for (let k = 0; k < 4 && i < total; k++) draw(jobs[i++]); $('progress').textContent = i < total ? `drawing ${i} of ${total}` : `${total} drawings`; if (i < total) requestAnimationFrame(step); else window.sheetReady = true; }
  window.sheetDrawAll = () => { while (i < total) draw(jobs[i++]); $('progress').textContent = `${total} drawings`; window.sheetReady = true; };
  requestAnimationFrame(step);
}
main().catch((e) => { const b = $('err'); b.hidden = false; b.textContent = 'The model sheet could not be drawn: ' + (e && e.message ? e.message : e) + '. It needs WebGL, and the files must be served over http (see README.md).'; throw e; });
