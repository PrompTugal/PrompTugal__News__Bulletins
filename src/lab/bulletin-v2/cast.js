/* cast.js: the right half of the version 2 video bulletin (bulletins.b@, 21 Nov 2026). All twelve version 2
 * presenters (../presenters/v2-claude/) on one stage, 640 x 720, directed by cast.json, which
 * bulletins/bulletin-v2.mjs writes from the day's bulletin: who speaks which story, how the others react, and the
 * camera. Every frame is a function of t: window.renderAt(t). Name tags label every character as synthetic. */
import { Stage } from '../presenters/v2-claude/engine/stage.js';
import { Director } from '../presenters/v2-claude/engine/director.js';
import { CH } from '../presenters/v2-claude/engine/channels.js';

const $ = (id) => document.getElementById(id);
const get = (f) => fetch(f, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(f + ' did not load'); return r.json(); });
const V2 = '../presenters/v2-claude/';

async function main() {
  const [data, moves, cast] = await Promise.all([get(V2 + 'characters.json'), get(V2 + 'moves.json'), get('cast.json')]);
  // The bulletin's own stage layout: the twelve closer together, to fit a portrait half of the screen.
  const specs = data.presenters.map((p) => ({ ...p, slot: cast.slots[p.id] || p.slot }));
  const frame = $('frame'), canvas = $('c');
  const stage = new Stage(canvas, specs);
  const dir = new Director({ specs, moves, chor: cast.chor, chars: stage.byId, tracks: cast.tracks });
  const W = 640, H = 720; stage.setSize(W, H);
  const tags = {};
  for (const c of stage.chars) {
    const t = document.createElement('div'); t.className = 'tag';
    const b = document.createElement('b'); b.textContent = c.spec.name; const i = document.createElement('i'); i.textContent = 'synthetic presenter';
    t.append(b, i); $('tags').append(t); tags[c.id] = t;
    c.tagH = c.tele ? c.spec.looks.rows * 3 * c.spec.looks.sextant : c.height;
  }
  function renderAt(t) {
    t = Math.max(0, Math.min(dir.duration, t));
    const f = dir.frame(t), cam = dir.cameraAt(t, null);
    stage.setCamera(cam); stage.render(f.poses, f.springs, t, dir.onlyAt(t, null));
    for (const c of stage.chars) {
      const el = tags[c.id], p = f.poses[c.id];
      if (!c.object.visible) { el.className = 'tag off'; continue; }
      const s = stage.project(p[CH.r_x], c.baseY - 0.03, p[CH.r_z], W, H);
      if (s[2] > 1 || s[0] < -40 || s[0] > W + 40 || s[1] > H - 40) { el.className = 'tag off'; continue; }
      el.className = 'tag' + (cast.speakerAt(t) === c.id ? ' on' : '');
      el.style.transform = `translate(${s[0].toFixed(1)}px, ${s[1].toFixed(1)}px) translate(-50%, 0)`;
    }
    const b = dir.beatAt(t); $('beat').textContent = b ? b.title : '';
    return t;
  }
  // Who is speaking at t, for the highlighted name tag.
  cast.speakerAt = (t) => { let w = null; for (const s of cast.speakers) if (t >= s.from && t < s.to) w = s.who; return w; };
  renderAt(0);
  window.renderAt = renderAt; window.castReady = true;
}
main().catch((e) => { $('beat').textContent = 'The cast could not start: ' + (e && e.message ? e.message : e); throw e; });
