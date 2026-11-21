// Developer page (not a deliverable): pose any character with any cues at any t, for screenshots while modelling.
import { Stage } from './engine/stage.js';
import { Director } from './engine/director.js';
const q = new URLSearchParams(location.search), W = +(q.get('w') || 1920), H = +(q.get('h') || 1080);
const [data, moves, vis] = await Promise.all(['characters.json', 'moves.json', 'visemes.json'].map((f) => fetch(f).then((r) => r.ok ? r.json() : {})));
// ?variants=1: instead of the twelve, show the trial looks in tools/variants.json, each a copy of a character with some looks changed.
if (q.has('variants')) { const V = await (await fetch('tools/variants.json')).json(); data.presenters = V.variants.map((v, i) => { const b = JSON.parse(JSON.stringify(data.presenters.find((p) => p.id === v.of))); return { ...b, id: v.id, name: v.name, slot: [(i % 5) * 1.4 - 2.8, 0.6 + Math.floor(i / 5) * 1.6], looks: { ...b.looks, ...v.looks } }; }); }
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const stage = new Stage(canvas, data.presenters); stage.setSize(W, H);
let dir = null; window.stage = stage;
window.setCues = (cues, extra = {}) => { dir = new Director({ specs: data.presenters, moves, chor: { duration: 40, cues, auto: { fidget: false, blink: false, idle: false }, ...extra }, chars: stage.byId, tracks: vis }); return dir.ids.length; };
window.setCues([]);
window.shot = (o = {}) => {
  const t = o.t || 0, f = dir.frame(t);
  let cam = o.cam || { pos: [0, 2.0, 11.5], look: [0, 1.15, -1], fov: 28 };
  if (o.focus) cam = dir.shot({ focus: o.focus, dist: o.dist ?? 4.6, orbit: o.orbit || 0, h: o.ch ?? 0.6, lh: o.lh ?? 0.52, fov: o.fov || 28 }, t);
  stage.setCamera(cam); stage.render(f.poses, o.springs === false ? null : f.springs, t, o.only || null);
};
window.durOf = (id) => (dir.actionsOf(id)[0] || { dur: 1 }).dur;
window.ready = true;
