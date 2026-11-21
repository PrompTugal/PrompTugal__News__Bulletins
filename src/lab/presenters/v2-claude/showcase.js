/* showcase.js: the "all of them in action" page. It loads the three data files, builds the stage and the director,
 * and exposes window.renderAt(t), exactly as version 1's gallery.js did, so the video exporter and the scrub bar
 * drive the same function. */
import { Stage } from './engine/stage.js';
import { Director } from './engine/director.js';
import { Clock } from './engine/timeline.js';
import { CH } from './engine/channels.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search), EXPORT = q.has('export');
if (EXPORT) document.body.classList.add('export');
const fail = (e) => { const b = $('err'); b.hidden = false; b.textContent = 'The showcase could not start: ' + (e && e.message ? e.message : e) + '. It needs WebGL, and the files must be served over http (see README.md).'; throw e; };

async function main() {
  const get = (f) => fetch(f, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(f + ' did not load'); return r.json(); });
  const [data, moves, chor, vis] = await Promise.all(['characters.json', 'moves.json', 'choreography.json', 'visemes.json'].map(get));
  const frame = $('frame'), canvas = $('c');
  const stage = new Stage(canvas, data.presenters);
  const dir = new Director({ specs: data.presenters, moves, chor, chars: stage.byId, tracks: vis });
  const D = dir.duration;

  // Name tags: every character carries its name and the words "synthetic presenter" in every frame.
  const tags = {}; let showTags = true;
  for (const c of stage.chars) {
    const t = document.createElement('div'); t.className = 'tag off';
    const b = document.createElement('b'); b.textContent = c.spec.name; const i = document.createElement('i'); i.textContent = data.label || 'synthetic presenter';
    t.append(b, i); $('tags').append(t); tags[c.id] = t;
    c.tagH = c.tele ? c.spec.looks.rows * 3 * c.spec.looks.sextant : c.height;
    const o = document.createElement('option'); o.value = c.id; o.textContent = c.spec.name; $('focus').append(o);
  }
  let W = 0, H = 0, focus = '', zoom = 1;
  function resize() {
    const r = frame.getBoundingClientRect(), dpr = EXPORT ? 1 : Math.min(window.devicePixelRatio || 1, 3840 / Math.max(1, r.width));
    W = r.width; H = r.height; stage.setSize(Math.max(2, Math.round(W * dpr)), Math.max(2, Math.round(H * dpr)));
    frame.style.setProperty('--u', (EXPORT ? W / 1920 : Math.max(W / 1920, 0.42)) + 'px');   // labels stay readable on a phone
  }
  function renderAt(t) {
    t = Math.max(0, Math.min(D, t));
    const f = dir.frame(t), cam = dir.cameraAt(t, focus || null);
    if (focus && zoom !== 1) for (let i = 0; i < 3; i++) cam.pos[i] = cam.look[i] + (cam.pos[i] - cam.look[i]) / zoom;
    stage.setCamera(cam); stage.render(f.poses, f.springs, t, dir.onlyAt(t, focus || null)); const U = W / 1920;
    for (const c of stage.chars) {
      const el = tags[c.id], p = f.poses[c.id], vis = showTags && c.object.visible && !(c.id === 'holo' && p[CH.fx2] > 0.6) && !(c.id === 'guide' && p[CH.fx1] > 0.8);
      if (!vis) { el.classList.add('off'); continue; }
      // The tag sits at the character's feet, like a name plate; in a close-up that crops the feet it moves above the head.
      let s = stage.project(p[CH.r_x], c.baseY - 0.03, p[CH.r_z], W, H), below = true;
      if (s[1] > H - 46 * U) { s = stage.project(p[CH.r_x], c.baseY + c.tagH * 1.04 + Math.max(0, p[CH.r_y]) + 0.08, p[CH.r_z], W, H); below = false; if (s[1] < 70 * U) s[1] = 70 * U; }
      if (s[2] > 1 || s[0] < -60 || s[0] > W + 60) { el.classList.add('off'); continue; }
      el.classList.remove('off'); el.style.transform = `translate(${s[0].toFixed(1)}px, ${s[1].toFixed(1)}px) translate(-50%, ${below ? '0' : '-100%'})`;
    }
    const b = dir.beatAt(t); $('beat').textContent = b ? b.title : ''; $('sub').textContent = b && b.sub ? b.sub : '';
    $('strapT').textContent = 't = ' + t.toFixed(2); $('clock').textContent = t.toFixed(2) + ' s';
    return t;
  }
  resize(); window.addEventListener('resize', () => { resize(); renderAt(clock.t); });

  // Transport.
  const audio = $('voice'), voice = chor.voice; let sound = true;
  if (voice && !EXPORT) audio.src = voice.src;
  function syncAudio(t, playing) {
    if (!voice) return;
    const part = voice.parts.find((p) => t >= p.at && t < p.at + (p.to - p.from));
    if (!playing || !part || !sound || clock.speed !== 1) { if (!audio.paused) audio.pause(); return; }
    const want = part.from + (t - part.at);
    if (audio.paused) { audio.currentTime = want; audio.play().catch(() => {}); } else if (Math.abs(audio.currentTime - want) > 0.15) audio.currentTime = want;
  }
  const scrub = $('scrub'); scrub.max = D;
  const beatBtns = (chor.beats || []).filter((b) => b.chapter).map((b) => { const li = document.createElement('li'), bt = document.createElement('button'); bt.type = 'button'; bt.textContent = b.chapter; bt.addEventListener('click', () => clock.seek(b.t)); li.append(bt); $('beats').append(li); return [b, bt]; });
  const clock = new Clock(D, (t, c) => {
    renderAt(t); syncAudio(t, c.playing);
    scrub.value = t; $('time').textContent = t.toFixed(2) + ' / ' + D.toFixed(2) + ' s'; $('play').textContent = c.playing ? 'Pause' : 'Play';
    let cur = null; for (const [b, bt] of beatBtns) { if (b.t <= t) cur = bt; bt.removeAttribute('aria-current'); } if (cur) cur.setAttribute('aria-current', 'true');
  });
  $('play').addEventListener('click', () => clock.toggle());
  scrub.addEventListener('input', () => clock.seek(+scrub.value));
  $('speed').addEventListener('change', (e) => { clock.speed = +e.target.value; });
  $('focus').addEventListener('change', (e) => { focus = e.target.value; clock.seek(clock.t); });
  $('zoom').addEventListener('input', (e) => { zoom = +e.target.value; clock.seek(clock.t); });
  const toggle = (id, on, off, fn) => $(id).addEventListener('click', (e) => { const v = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(v)); e.currentTarget.textContent = v ? on : off; fn(v); clock.seek(clock.t); });
  toggle('sound', 'Voice on', 'Voice off', (v) => { sound = v; }); toggle('names', 'Name tags on', 'Name tags off', (v) => { showTags = v; });
  window.addEventListener('keydown', (e) => {
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName) && e.code === 'Space') return;
    if (e.code === 'Space') { e.preventDefault(); clock.toggle(); } else if (e.code === 'ArrowRight') clock.seek(clock.t + 1 / 60); else if (e.code === 'ArrowLeft') clock.seek(clock.t - 1 / 60);
  });
  if (q.has('t')) clock.seek(+q.get('t')); else clock.seek(0);
  // For the exporter and for tests: the same names version 1 used.
  window.renderAt = renderAt; window.showcase = { duration: D, fps: chor.fps || 60, stage, dir, clock, voice };
  window.showcaseReady = true;
}
main().catch(fail);
