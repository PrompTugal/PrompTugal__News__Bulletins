/* demo.js: the library's live examples. Example 1: all twelve with the defaults. Example 2: three presenters, a
 * short script of cues and a camera, the way another site would use it. Example 3 (0.2.0): a journey, with a crowd of
 * copies, a fall, a pull-up and ropes. Only the library's own mount() and crowd() are called. */
import { mount, crowd, VERSION } from './presenters.js';
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
  const C = crowd({ of: ['agent', 'holo', 'guide', 'caretaker'], n: 16, area: [-6, 1.0, -1.4, 3.6], seed: 3 });
  const trip = await mount($('three'), { presenters: [...C.presenters, 'anchor', 'realist', 'researcher'], slots: { ...C.slots, anchor: [0.4, 0.8], realist: [3.0, 0.8], researcher: [4.4, 2.6] },
    groups: C.groups, flat: true, tags: false, duration: 12,
    beats: [{ t: 0, title: 'ILLUSTRATIVE: not a measured crowd' }],
    camera: [{ t: 0, pos: [-0.6, 3.2, 14.5], look: [-0.6, 0.9, 1.4], fov: 36 }, { t: 3.2, pos: [-0.6, 3.2, 14.5], look: [-0.6, 0.9, 1.4], fov: 36 }, { t: 6, pos: [1.6, 2.0, 9], look: [1.8, 0.8, 1], fov: 34, ease: 'inOut' }],
    cues: [{ t: 0.2, who: 'crowd', do: 'walk', by: [1.4, 0], stagger: 0.06 }, { t: 0.3, who: 'anchor', do: 'carry', dur: 3.2 },
      { t: 0.5, who: 'researcher', do: 'pullUp', dur: 5, times: 3 }, { t: 3.6, who: 'anchor', do: 'fall', dur: 4.4 },
      { t: 0.4, who: 'realist', do: 'turn', yaw: -90 }, { t: 4.4, who: 'realist', do: 'hold', dur: 6.5, haul: 0.6 }, { t: 9, who: 'crowd', do: 'celebrate', stagger: 0.05 }],
    props: [{ kind: 'rope', keys: [{ t: 0, mode: 'coil', on: 'anchor' }, { t: 3.7, mode: 'line', ends: ['anchor.R', 'realist.hands'], length: 2.6 }] },
      { kind: 'rope', keys: [{ t: 0, mode: 'hang', from: [4.4, 3.6, 2.6], length: 3.6 }, { t: 0.9, mode: 'line', ends: [[4.4, 3.6, 2.6], 'researcher.hands'], length: 1.6 }] }] });
  for (const [b, s] of [['p1', all], ['p2', three], ['p3', trip]]) $(b).onclick = () => (s.playing ? s.pause() : s.play());
  window.presentersDemo = { all, three, trip };   // for checking a frame by hand: presentersDemo.trip.renderAt(5)
  window.addEventListener('resize', () => { for (const s of [all, three, trip]) { s.resize(); s.renderAt(s.t); } });
  $('state').textContent = 'Ready: press play.';
}
main().catch((e) => { $('state').textContent = 'The demo could not start: ' + (e && e.message ? e.message : e); throw e; });
