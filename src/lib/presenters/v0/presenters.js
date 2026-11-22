/* presenters.js: the PrompTugal.news presenters library, one module to import (bulletins.b@PrompTugal.dinis,
 * 21 Nov 2026, at Dinis's word: "I would like to have the presenter engine as a reusable library").
 * It wraps the version 2 engine (engine/, from src/lab/presenters/v2-claude/ in PrompTugal__News__Bulletins):
 * twelve synthetic presenters built by code, none the likeness of a real person, each always labelled
 * "synthetic presenter". Every frame is a pure function of t, so a page can play it live or render it frame by frame.
 *
 *   import { mount } from './presenters/v0.1.1/presenters.js';
 *   const show = await mount(document.getElementById('stage'), {
 *     presenters: ['anchor', 'holo', 'owl'],                    // ids from data/characters.json; default all twelve
 *     cues: [{ t: 0.5, who: 'anchor', do: 'wave' }, { t: 2, who: 'all', do: 'nod' }],
 *     duration: 8,
 *   });
 *   show.play();               // or show.renderAt(3.2) for one exact frame
 *
 * Code Apache-2.0; text CC BY 4.0; three.js (vendor/) MIT, its notice in vendor/three.LICENSE. */
import { Stage } from './engine/stage.js';
import { Director } from './engine/director.js';
import { CH } from './engine/channels.js';

export const VERSION = '0.1.1';
export const LABEL = 'synthetic presenter';
export { Stage, Director, CH };

const here = (f) => new URL(f, import.meta.url).href;
const getJSON = (u) => fetch(u, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(u + ' did not load (' + r.status + ')'); return r.json(); });

/* The data the engine runs on: the twelve characters, the 69 moves (with the mouth shapes and expressions), and the
 * showcase's choreography and mouth cues as worked examples. Fetched from beside this file. */
export async function loadData() {
  const [characters, moves, choreography, visemes] = await Promise.all(['characters', 'moves', 'choreography', 'visemes'].map((n) => getJSON(here('data/' + n + '.json'))));
  return { characters, moves, choreography, visemes };
}

/* A wide shot that frames whoever is on stage. */
function wideShot(specs) {
  const xs = specs.map((s) => s.slot[0]), span = Math.max(1.5, Math.max(...xs) - Math.min(...xs));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  return { t: 0, pos: [cx, 2.0, 4.2 + span * 1.25], look: [cx, 1.05, -1], fov: 28 };
}

/* mount(el, options): puts a stage in el (a block element; it takes el's size) and returns a show.
 * options:
 *   presenters  ids to put on stage, in order (default: all twelve)
 *   slots       { id: [x, z] } to move them (default: each character's own slot; z from -3.4 to -1.25 is the riser)
 *   cues        [{ t, who, do, ...params, stagger }]  who: an id, a list, 'all' or a group name; do: a move in data/moves.json
 *   camera      [{ t, pos, look, fov, ease } | { t, focus, dist, h, lh, orbit, cut, only }] (default: one wide shot)
 *   beats       [{ t, title }] captions; groups { name: [ids] }; duration (s, default 10)
 *   tracks      { name: { mouthCues: [{ start, end, value: 'A'..'H' | 'X' }] } } for the speak move
 *   audio       a URL: played with the show, which then follows the audio's clock
 *   tags        true (default): name tags. The corner label "synthetic presenter" is always drawn and cannot be turned off.
 *   background  a CSS colour for the stage (default '#060914'); auto { idle, blink, fidget } (default idle and blink on)
 * The show: { renderAt(t), play(), pause(), seek(t), duration, playing, stage, director, data, resize(), destroy() } */
export async function mount(el, o = {}) {
  if (!el || !el.appendChild) throw new Error('mount: give it an element');
  const data = o.data || await loadData();
  const all = data.characters.presenters, ids = o.presenters || all.map((p) => p.id);
  const specs = ids.map((id) => { const p = all.find((x) => x.id === id); if (!p) throw new Error('mount: no presenter "' + id + '"'); return { ...p, slot: (o.slots && o.slots[id]) || p.slot }; });
  const duration = o.duration || 10;
  const chor = { version: 'lib-' + VERSION, duration, auto: { idle: true, blink: true, fidget: false, ...(o.auto || {}) }, groups: { all: ids, ...(o.groups || {}) },
    beats: o.beats || [], camera: (o.camera && o.camera.length) ? o.camera : [wideShot(specs)], cues: (o.cues || []).slice().sort((a, b) => a.t - b.t) };

  const box = document.createElement('div'); box.className = 'ptp';
  box.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;font-family:"DejaVu Sans",system-ui,sans-serif';
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'display:block;width:100%;height:100%';
  const tagLayer = document.createElement('div'); tagLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const label = document.createElement('div'); label.textContent = specs.length + ' ' + LABEL + (specs.length > 1 ? 's' : '') + ' · made by code, no real person';
  label.style.cssText = 'position:absolute;left:8px;top:6px;color:#fff;background:#000a;padding:2px 6px;font:700 11px "DejaVu Sans Mono",monospace;pointer-events:none';
  const beat = document.createElement('div'); beat.style.cssText = 'position:absolute;left:8px;bottom:8px;background:#ff0;color:#000;font:700 13px "DejaVu Sans Mono",monospace;padding:2px 6px;display:none';
  box.append(canvas, tagLayer, label, beat); el.appendChild(box);

  const stage = new Stage(canvas, specs, { background: o.background });
  const director = new Director({ specs, moves: data.moves, chor, chars: stage.byId, tracks: o.tracks || {} });
  const tags = {};
  if (o.tags !== false) for (const c of stage.chars) {
    const t = document.createElement('div'); t.style.cssText = 'position:absolute;left:0;top:0;text-align:center;color:#fff;font:700 11px "DejaVu Sans",sans-serif;text-shadow:0 0 3px #000,0 0 2px #000;white-space:nowrap';
    const b = document.createElement('b'); b.textContent = c.spec.name; const i = document.createElement('i'); i.textContent = LABEL; i.style.cssText = 'display:block;font:400 9px "DejaVu Sans",sans-serif;color:#cde';
    t.append(b, i); tagLayer.append(t); tags[c.id] = t;
    c.tagH = c.tele ? c.spec.looks.rows * 3 * c.spec.looks.sextant : c.height;
  }
  let W = 0, H = 0;
  function resize() { W = Math.max(1, box.clientWidth); H = Math.max(1, box.clientHeight); stage.setSize(W, H); }
  resize();

  function renderAt(t) {
    t = Math.max(0, Math.min(director.duration, t));
    const f = director.frame(t);
    stage.setCamera(director.cameraAt(t, null)); stage.render(f.poses, f.springs, t, director.onlyAt(t, null));
    for (const c of stage.chars) {
      const el2 = tags[c.id]; if (!el2) continue; const p = f.poses[c.id];
      if (!c.object.visible) { el2.style.display = 'none'; continue; }
      // Above the head, so a front row never covers a back row's name.
      const s = stage.project(p[CH.r_x], c.baseY + (c.tagH || 1.6) + 0.08, p[CH.r_z], W, H);
      if (s[2] > 1 || s[0] < -40 || s[0] > W + 40 || s[1] < 0) { el2.style.display = 'none'; continue; }
      el2.style.display = ''; el2.style.transform = `translate(${s[0].toFixed(1)}px, ${s[1].toFixed(1)}px) translate(-50%, -100%)`;
    }
    const b = director.beatAt(t); beat.textContent = b ? b.title : ''; beat.style.display = b ? '' : 'none';
    show.t = t; return t;
  }

  const audio = o.audio ? Object.assign(new Audio(o.audio), { preload: 'auto' }) : null;
  let raf = 0, t0 = 0, from = 0;
  const clock = () => audio ? audio.currentTime : from + (performance.now() - t0) / 1000;
  function tick() { const t = clock(); renderAt(t); if (t >= director.duration) { show.pause(); return; } raf = requestAnimationFrame(tick); }
  const show = {
    t: 0, duration: director.duration, playing: false, stage, director, data, renderAt, resize,
    play() { if (show.playing) return; if (show.t >= director.duration) show.seek(0); show.playing = true; from = show.t; t0 = performance.now(); if (audio) { audio.currentTime = show.t; audio.play().catch(() => {}); } raf = requestAnimationFrame(tick); },
    pause() { show.playing = false; cancelAnimationFrame(raf); if (audio) audio.pause(); },
    seek(t) { renderAt(t); from = show.t; t0 = performance.now(); if (audio) audio.currentTime = show.t; },
    destroy() { show.pause(); stage.renderer.dispose(); box.remove(); },
  };
  renderAt(0);
  return show;
}
