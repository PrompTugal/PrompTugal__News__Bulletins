/* demo.js: the library's live examples. Example 1: all twelve with the defaults. Example 2: three presenters, a
 * short script of cues and a camera, the way another site would use it. Only the library's own mount() is called. */
import { mount, VERSION } from './presenters.js';
const $ = (id) => document.getElementById(id);
$('ver').textContent = VERSION;
async function main() {
  const all = await mount($('one'), { duration: 12, cues: [
    { t: 0.6, who: 'all', do: 'wave', stagger: 0.12 },
    { t: 3.5, who: 'all', do: 'expression', name: 'delighted', dur: 3, stagger: 0.05 },
    { t: 4, who: ['agent', 'conductor', 'researcher', 'caretaker', 'cube', 'owl'], do: 'celebrate', stagger: 0.1 },
    { t: 8, who: 'all', do: 'bow', stagger: 0.08 } ] });
  const three = await mount($('two'), { presenters: ['anchor', 'holo', 'owl'], duration: 10,
    slots: { anchor: [-1.2, 0], holo: [0, -0.4], owl: [1.2, 0] },
    beats: [{ t: 0, title: 'Hello' }, { t: 3, title: 'A point' }, { t: 6.5, title: 'Goodbye' }],
    camera: [{ t: 0, pos: [0, 1.6, 6.5], look: [0, 1.0, 0], fov: 30 }, { t: 3, focus: 'holo', dist: 3.4, ease: 'inOut' }, { t: 6.5, pos: [0, 1.6, 6.5], look: [0, 1.0, 0], fov: 30, ease: 'inOut' }],
    cues: [{ t: 0.4, who: 'anchor', do: 'wave' }, { t: 1.2, who: 'owl', do: 'wingFlap' }, { t: 3.2, who: 'holo', do: 'point' },
      { t: 4.4, who: 'holo', do: 'glitch' }, { t: 6.8, who: 'all', do: 'bow', stagger: 0.15 }] });
  for (const [b, s] of [['p1', all], ['p2', three]]) $(b).onclick = () => (s.playing ? s.pause() : s.play());
  window.addEventListener('resize', () => { all.resize(); three.resize(); all.renderAt(all.t); three.renderAt(three.t); });
  $('state').textContent = 'Ready: press play.';
}
main().catch((e) => { $('state').textContent = 'The demo could not start: ' + (e && e.message ? e.message : e); throw e; });
