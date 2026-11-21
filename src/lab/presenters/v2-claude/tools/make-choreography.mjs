// Writes ../choreography.json. The JSON file is what the pages read and it can be edited by hand; this script only
// saves arithmetic when a section is made longer or shorter, because every later time moves with it.
// Run: node tools/make-choreography.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cues = [], camera = [], beats = [];
const r2 = (x) => Math.round(x * 1000) / 1000;
const cue = (t, who, what, o = {}) => cues.push({ t: r2(t), who, do: what, ...o });
const cam = (t, o) => camera.push({ t: r2(t), ...o });
const beat = (t, title, sub = '', chapter = '') => beats.push({ t: r2(t), title, ...(sub ? { sub } : {}), ...(chapter ? { chapter } : {}) });
const WIDE = { pos: [0, 1.95, 10.6], look: [0, 1.12, -1], fov: 28 };
const BACK = -2.2;

const groups = {
  lr: ['teletext', 'agent', 'guide', 'conductor', 'holo', 'owl', 'anchor', 'cube', 'researcher', 'realist', 'caretaker', 'rowan'],   // left to right
  back: ['teletext', 'guide', 'holo', 'anchor', 'realist', 'rowan'], front: ['agent', 'conductor', 'owl', 'researcher', 'caretaker', 'cube'],
  humans: ['holo', 'anchor', 'realist', 'guide', 'rowan'], bots: ['agent', 'conductor', 'researcher', 'caretaker'],
  nomid: ['teletext', 'agent', 'guide', 'conductor', 'holo', 'anchor', 'researcher', 'realist', 'caretaker', 'rowan'],
  nocube: ['teletext', 'agent', 'guide', 'conductor', 'holo', 'owl', 'anchor', 'researcher', 'realist', 'caretaker', 'rowan'],
  others: ['teletext', 'agent', 'guide', 'conductor', 'holo', 'owl', 'anchor', 'researcher', 'realist', 'caretaker', 'rowan'],
};

/* ---------- 1. Entrance: each arrives in its own way. ---------- */
let T = 0;
beat(T, 'Entrance', 'Each arrives in its own way', 'Entrance');
cam(T, { pos: [0, 2.9, 14.2], look: [0, 1.2, -1], fov: 28 }); cam(8.4, { ...WIDE, ease: 'inOut' });
cue(0, 'holo', 'dissolved', { dur: 1.5 }); cue(1.5, 'holo', 'materialise', { dur: 1.9 }); cue(3.5, 'holo', 'nod');
cue(0, 'teletext', 'blank', { dur: 2.3 }); cue(2.3, 'teletext', 'pageIn', { dur: 1.8 }); cue(4.3, 'teletext', 'wave', { dur: 1.8 });
cue(0, 'guide', 'blank', { dur: 3.3 }); cue(3.3, 'guide', 'sketchOn', { dur: 2.6 }); cue(6.0, 'guide', 'brows');
cue(0, 'anchor', 'place', { to: [8.3, BACK] }); cue(0.4, 'anchor', 'walk', { to: 'slot', speed: 1.9 }); cue(4.5, 'anchor', 'nod'); cue(4.4, 'anchor', 'emote', { mood: 'smile', dur: 2 });
cue(0, 'realist', 'place', { to: [8.6, BACK] }); cue(1.9, 'realist', 'walk', { to: 'slot', speed: 1.8 }); cue(5.3, 'realist', 'nod');
cue(0, 'rowan', 'place', { to: [9.6, BACK] }); cue(5.9, 'rowan', 'run', { to: 'slot', speed: 3.4 }); cue(7.5, 'rowan', 'tada', { dur: 2.0 });
cue(6.6, 'realist', 'flinch', { dir: 'left', dur: 1.2 }); cue(7.7, 'guide', 'facepalm', { dur: 1.9 }); cue(7.6, 'anchor', 'lookAt', { target: [4.5, 2.2, BACK], dur: 1.8 });
cue(0, 'conductor', 'place', { to: [-7.2, 0] }); cue(0.3, 'conductor', 'walk', { to: 'slot', speed: 1.6 }); cue(3.8, 'conductor', 'brows');
cue(0, 'agent', 'place', { to: [-7.6, 0] }); cue(1.8, 'agent', 'walk', { to: 'slot', speed: 1.6 }); cue(4.4, 'agent', 'wave', { dur: 1.8 });
cue(0, 'researcher', 'place', { to: [7.2, 0] }); cue(0.9, 'researcher', 'walk', { to: 'slot', speed: 1.6 }); cue(4.4, 'researcher', 'tilt');
cue(0, 'caretaker', 'place', { to: [7.8, 0] }); cue(2.4, 'caretaker', 'walk', { to: 'slot', speed: 1.6 }); cue(5.1, 'caretaker', 'wave', { dur: 1.8 });
cue(0, 'owl', 'hide', { dur: 3.0 }); cue(3.0, 'owl', 'flyIn', { dur: 2.4 }); cue(5.5, 'owl', 'fidget', { dur: 1.6 });
cue(0, 'cube', 'place', { to: [5.58, 1.3] }); cue(2.5, 'cube', 'walk', { to: 'slot', dur: 4.4 }); cue(7.0, 'cube', 'hop'); cue(7.0, 'cube', 'emote', { mood: 'delighted', dur: 1.6 });
cue(8.6, 'all', 'look', { dir: 'camera' });
T = 9.6;

/* ---------- 2. Idle. ---------- */
beat(T, 'Idle', 'Breathing, weight shifts, blinks, and a habit each', 'Idle');
cam(T, { pos: [-3.4, 1.9, 7.2], look: [-2.9, 1.15, -1.2], fov: 28, cut: true }); cam(T + 5.2, { pos: [3.4, 1.9, 7.2], look: [2.9, 1.15, -1.2], fov: 28, ease: 'inOut' });
cue(T + 0.2, 'lr', 'fidget', { dur: 2.4, stagger: 0.26 }); cue(T + 0.1, ['guide', 'holo', 'researcher', 'rowan'], 'lookAround', { dur: 2.2 }); cue(T + 3.0, ['teletext', 'agent', 'conductor', 'owl'], 'lookAround', { dur: 2.2 });
T += 5.4;

/* ---------- 3. Gestures. ---------- */
beat(T, 'Gestures', 'Wave', 'Gestures');
cam(T, { ...WIDE, cut: true });
cue(T + 0.1, 'lr', 'wave', { dur: 2.2, stagger: 0.12 }); T += 3.7;
beat(T, 'Gestures', 'Point at any target; a double-take; a shrug');
cam(T, { ...WIDE }); cam(T + 1.0, { pos: [0.6, 1.7, 8.6], look: [0.6, 0.95, -0.6], fov: 28 }); cam(T + 4.2, { pos: [0.6, 1.7, 8.6], look: [0.6, 0.95, -0.6], fov: 28 }); cam(T + 5.0, { ...WIDE });
cue(T, 'others', 'pointAt', { target: [0.9, 0.55, 1.3], dur: 2.5, stagger: 0.03 }); cue(T + 0.5, 'cube', 'doubleTake', { dur: 1.6 }); cue(T + 2.1, 'cube', 'shrug', { dur: 1.7 });
cue(T + 2.6, ['owl', 'rowan', 'caretaker', 'agent'], 'laugh', { dur: 1.9 }); T += 4.6;
beat(T, 'Gestures', 'Count on fingers; thumbs up');
cue(T, 'back', 'count', { n: 3, dur: 2.5 }); cue(T + 0.4, 'front', 'thumbsUp', { dur: 1.9 }); T += 2.7;
beat(T, 'Gestures', 'Shrug; open palms');
cue(T, 'back', 'shrug', { dur: 1.7 }); cue(T, 'front', 'openPalms', { dur: 1.8 }); T += 2.0;
beat(T, 'Gestures', 'Present; hold up a prop');
cue(T, ['anchor', 'rowan', 'guide', 'conductor', 'researcher', 'caretaker'], 'holdUp', { dur: 2.0 }); cue(T, ['holo', 'realist', 'teletext', 'agent', 'owl', 'cube'], 'present', { dur: 2.0 }); T += 2.2;
beat(T, 'Gestures', 'Hands on hips; arms crossed; thinking');
cue(T, ['anchor', 'realist', 'conductor', 'caretaker'], 'handsOnHips', { dur: 2.3 }); cue(T, ['rowan', 'holo', 'agent', 'teletext'], 'armsCrossed', { dur: 2.3 }); cue(T, ['guide', 'researcher', 'owl', 'cube'], 'think', { dur: 2.3 }); T += 2.5;

/* ---------- 4. Jumps and spins. ---------- */
beat(T, 'Jumps and spins', 'Anticipation, flight, landing: squash and stretch', 'Jumps and spins');
cam(T, { ...WIDE }); cam(T + 2.0, { pos: [0, 2.3, 12.6], look: [0, 1.5, -1], fov: 28 });
cue(T + 0.1, 'lr', 'jump', { stagger: 0.085 }); T += 2.3;
beat(T, 'Jumps and spins', 'Spin; hop');
cue(T, 'lr', 'spin', { stagger: 0.07 }); T += 2.2;
cue(T, 'front', 'hop'); cue(T + 0.34, 'back', 'hop'); cue(T + 0.68, 'front', 'hop'); cue(T + 1.02, 'back', 'hop'); T += 1.8;
beat(T, 'Jumps and spins', 'Crouch to stand; turn on the spot');
cam(T, { pos: [0, 2.3, 12.6], look: [0, 1.5, -1], fov: 28 }); cam(T + 1.5, { ...WIDE });
cue(T, 'all', 'crouchToStand', { dur: 1.9, stagger: 0.02 }); T += 2.0;
cue(T, 'lr', 'turn', { yaw: 180, dur: 0.8, stagger: 0.04 }); cue(T + 1.5, 'lr', 'turn', { yaw: 0, dur: 0.8, stagger: 0.04 }); T += 2.9;

/* ---------- 5. Specials: one close-up each. ---------- */
const special = (who, name, parts, shot, sub) => {
  const len = parts.reduce((s, p) => s + p[1], 0);
  beat(T, name, sub, who === 'holo' ? 'Specials' : '');
  const only = groups.back.includes(who) ? { only: 'back' } : who === 'owl' ? { only: 'nocube' } : {};
  cam(T, { focus: who, cut: true, ...shot, ...only }); cam(T + len + 0.25, { focus: who, ...shot, ...only, dist: (shot.dist ?? 4.2) * 0.9, orbit: (shot.orbit || 0) + (shot.sweep ?? 8), ease: 'linear' });
  let t = T + 0.2; for (const [move, dur, p] of parts) { cue(t, who, move, { dur, ...(p || {}) }); t += dur; }
  T += len + 0.45;
};
special('holo', 'Tejo', [['glitch', 1.2], ['rematerialise', 2.3], ['scanSweep', 1.4]], { dist: 5.0, h: 0.6, lh: 0.55, orbit: -14, sweep: 22 }, 'Glitch, re-materialise, scan-line sweep');
special('teletext', 'Ceefax', [['pageFlip', 2.1], ['colourCycle', 1.9]], { dist: 6.4, h: 0.85, lh: 0.8, orbit: 6, sweep: -8 }, 'Page flip, colour cycling');
special('conductor', 'Conductor', [['clockSpin', 2.4]], { dist: 3.0, h: 0.84, lh: 0.8, orbit: 10, sweep: -14 }, 'Clock spin: the hands are its eyes');
special('researcher', 'Researcher', [['magnify', 2.6]], { dist: 3.0, h: 0.84, lh: 0.8, orbit: -12, sweep: 10 }, 'Magnify');
special('caretaker', 'The Caretaker', [['keyJingle', 2.3]], { dist: 3.4, h: 0.72, lh: 0.66, orbit: 16, sweep: -10 }, 'Key jingle: the keys hang on springs');
special('owl', 'Mocho', [['headTurn270', 2.6], ['wingFlap', 1.8]], { dist: 4.3, h: 0.78, lh: 0.62, orbit: -10, sweep: 16 }, 'A 270° head turn, and a wing flap');
special('cube', 'Cubo', [['rollEdge', 2.4], ['bounce', 1.8]], { dist: 5.2, h: 1.5, lh: 0.9, orbit: 12, sweep: -10 }, 'Roll over an edge, and bounce');
special('agent', 'The Agent', [['antennaSpark', 1.7]], { dist: 3.2, h: 0.86, lh: 0.84, orbit: -14, sweep: 10 }, 'Antenna spark');
special('guide', 'The Guide', [['sketchOff', 1.1], ['sketchOn', 2.5]], { dist: 4.4, h: 0.62, lh: 0.56, orbit: 10, sweep: -8 }, 'Sketch-on: the lines draw themselves in');
special('anchor', 'Duarte', [['straightenTie', 2.2]], { dist: 2.5, h: 0.86, lh: 0.82, orbit: -12, sweep: 10 }, 'Straighten the tie');
special('realist', 'Rui', [['microExpression', 2.6]], { dist: 1.7, h: 0.915, lh: 0.905, orbit: 12, sweep: -10 }, 'A micro-expression');
special('rowan', 'Rowan', [['cartoonTake', 1.9]], { dist: 5.0, h: 0.72, lh: 0.7, orbit: -8, sweep: 8 }, 'A cartoon take');

/* ---------- 6. Lip-sync: version 1's voice, with visemes made offline by Rhubarb. ---------- */
const V = T + 0.3, face = { dist: 1.65, h: 0.91, lh: 0.9 };
const voice = { src: '../../video/200.m4a', track: 'voice200', label: 'synthetic voice', parts: [{ at: r2(V), from: 0, to: 12.6 }, { at: r2(V + 12.7), from: 22.7, to: 27.65 }] };
const say = (who, from, to, o = {}) => { const base = from < 20 ? V - 0 : V + 12.7 - 22.7; cue(base + from, who, 'speak', { track: 'voice200', offset: from, dur: r2(to - from), ...o }); return base + from; };
beat(T, 'Lip-sync', 'Synthetic voice. Mouth shapes A to H and X, from the sound', 'Lip-sync');
cam(T, { focus: 'anchor', cut: true, ...face, orbit: -10, only: 'back' }); cam(V + 5.15, { focus: 'anchor', ...face, dist: 1.5, orbit: 4, ease: 'linear', only: 'back' });
say('anchor', 0, 5.0); beat(V, 'Duarte', 'P200. The Algarve.'); cue(V - 0.2, 'anchor', 'emote', { mood: 'smile', dur: 5 }); cue(V + 2.3, 'anchor', 'nod', { amount: 0.6 });
cam(V + 5.2, { focus: 'realist', cut: true, ...face, orbit: 12, only: 'back' }); cam(V + 8.9, { focus: 'realist', ...face, dist: 1.5, orbit: 0, ease: 'linear', only: 'back' });
say('realist', 5.2, 8.95); beat(V + 5.2, 'Rui', 'IPMA forecasts a 100% chance of rain tomorrow,'); cue(V + 6.3, 'realist', 'nod', { amount: 0.5 }); cue(V + 6.0, 'realist', 'brows', { amount: 0.6 });
cam(V + 8.95, { focus: 'holo', cut: true, ...face, dist: 1.9, orbit: -12, only: 'back' }); cam(V + 12.5, { focus: 'holo', ...face, dist: 1.7, orbit: 2, ease: 'linear', only: 'back' });
say('holo', 8.95, 12.4); beat(V + 8.95, 'Tejo', '2026-11-21, in Faro, Portimão, Loulé and Sagres.'); cue(V + 10.0, 'holo', 'nod', { amount: 0.5 }); cue(V + 9.2, 'holo', 'scanSweep', { dur: 3.0, times: 2 });
const V2 = V + 12.7;
cam(V2, { pos: [0, 1.5, 8.6], look: [0, 0.92, -0.4], fov: 28, cut: true, only: 'nomid' }); cam(V2 + 2.9, { pos: [0, 1.45, 7.9], look: [0, 0.92, -0.4], fov: 28, ease: 'linear', only: 'nomid' });
say('bots', 22.7, 25.55); beat(V2, 'The four agents', "Made by agents from PrompTugal.news's data."); cue(V2 + 0.6, 'bots', 'openPalms', { dur: 2.0, stagger: 0.05 });
cam(V2 + 3.0, { ...WIDE, cut: true });
say('all', 25.7, 27.4); beat(V2 + 3.0, 'All twelve', 'Voice: synthetic.'); cue(V2 + 3.0, 'all', 'look', { dir: 'camera' });
T = V2 + 4.95;

/* ---------- 7. Finale, and out the way they came. ---------- */
beat(T, 'Finale', '', 'Finale');
cam(T, { ...WIDE }); 
cue(T + 0.1, 'lr', 'celebrate', { dur: 2.2, stagger: 0.03 }); T += 2.6;
cam(T, { ...WIDE }); cam(T + 6.5, { pos: [0, 2.9, 14.2], look: [0, 1.2, -1], fov: 28, ease: 'inOut' });
cue(T, 'lr', 'bow', { dur: 2.2, stagger: 0.02 }); T += 2.6;
beat(T, 'Synthetic presenters', 'Made by code from data. No real person.');
cue(T, 'anchor', 'walk', { to: [8.6, BACK], yaw: 90, speed: 2.2 }); cue(T + 0.5, 'realist', 'walk', { to: [8.6, BACK], yaw: 90, speed: 2.2 }); cue(T, 'rowan', 'run', { to: [9.6, BACK], yaw: 90, speed: 3.6 });
cue(T + 0.2, 'conductor', 'walk', { to: [-7.4, 0], yaw: -90, speed: 2.0 }); cue(T, 'agent', 'walk', { to: [-7.8, 0], yaw: -90, speed: 2.0 });
cue(T + 0.2, 'researcher', 'walk', { to: [7.4, 0], yaw: 90, speed: 2.0 }); cue(T, 'caretaker', 'walk', { to: [7.8, 0], yaw: 90, speed: 2.0 });
cue(T + 0.2, 'owl', 'flyOut', { dur: 1.9 }); cue(T + 2.1, 'owl', 'hide', { dur: 20 });
cue(T + 0.1, 'cube', 'walk', { to: [6.36, 1.3], dur: 3.3 });
cue(T + 0.9, 'guide', 'sketchOff', { dur: 1.5 }); cue(T + 2.4, 'guide', 'blank', { dur: 20 });
cue(T + 1.5, 'teletext', 'pageOut', { dur: 1.2 }); cue(T + 2.7, 'teletext', 'blank', { dur: 20 });
cue(T + 0.3, 'holo', 'wave', { dur: 1.9 }); cue(T + 2.3, 'holo', 'dematerialise', { dur: 1.5 }); cue(T + 3.8, 'holo', 'dissolved', { dur: 20 });
T += 4.6;

const out = {
  about: "The showcase of the version 2 presenters (Claude): entrance, idles, gestures, jumps and spins, each character's special, a lip-sync passage on version 1's voice, a finale and an exit. Cues are { t, who, do, ...parameters }; who is an id, a group or a list; stagger delays each member in turn. Camera shots are either { pos, look } or framed on characters with { focus, dist, orbit, h, lh }; cut: true jumps, otherwise the camera eases from the shot before. Written by tools/make-choreography.mjs; may be edited by hand. Proposal by presenters.v2-claude@PrompTugal.dinis, 20 November 2026.",
  version: '2.0.0-claude', duration: Math.ceil(T), fps: 60,
  auto: { idle: true, blink: true, fidget: false },
  voice, groups, beats, camera: camera.sort((a, b) => a.t - b.t), cues: cues.sort((a, b) => a.t - b.t),
};
const line = (o) => JSON.stringify(o).replace(/":/g, '": ').replace(/,"/g, ', "');
let s = '{\n' + ['about', 'version', 'duration', 'fps', 'auto', 'voice'].map((k) => `  "${k}": ${line(out[k])}`).join(',\n');
s += ',\n  "groups": {\n' + Object.entries(groups).map(([k, v]) => `    "${k}": ${JSON.stringify(v)}`).join(',\n') + '\n  }';
for (const k of ['beats', 'camera', 'cues']) s += `,\n  "${k}": [\n` + out[k].map((o) => '    ' + line(o)).join(',\n') + '\n  ]';
s += '\n}\n'; JSON.parse(s);
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'choreography.json'), s);
console.log(`choreography.json: ${out.duration} s, ${cues.length} cues, ${camera.length} shots, ${beats.length} beats; lip-sync starts at ${r2(V)}`);
