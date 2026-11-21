/* channels.js: the shared language between moves and bodies. A pose is one Float64Array with a number per channel.
 * A move writes channels; a body plan reads them. Because twelve very different bodies read the same channels, a move
 * is written once. Version 1's state had 8 numbers; this is the same idea with 69.
 *
 * Sign conventions (the character faces +Z, Y is up, the character's left is +X):
 *   a?_sw  arm swing: + forward and up        a?_out  arm away from the body      a?_tw  twist towards the midline
 *   a?_el  elbow bend                         a?_sh   shoulder shrug              a?_f0..f4  finger curl, thumb first
 *   l?_sw  leg forward   l?_kn  knee bend     crouch  0..1, both legs fold and the hips drop to keep the feet planted
 *   h_pitch + looks down   h_yaw + turns to the character's left   h_roll + tips to the character's right shoulder
 *   fx1..fx3 are effect channels whose meaning belongs to the character (glitch, page reveal, clock spin ...);
 *   hide above 0.5 takes the character off the stage.
 * Angles are radians, lengths are metres, everything is 0 at rest. */
const arm = (s) => ['sw', 'out', 'tw', 'el', 'wx', 'wz', 'sh', 'f0', 'f1', 'f2', 'f3', 'f4'].map((k) => `a${s}_${k}`);
const leg = (s) => ['sw', 'out', 'kn', 'an'].map((k) => `l${s}_${k}`);
export const PARTS = {
  root: ['r_x', 'r_y', 'r_z', 'r_yaw', 'r_pitch', 'r_roll', 'r_sy'],
  legs: [...leg('L'), ...leg('R'), 'crouch', 'hp_x', 'hp_y', 'hp_z'],
  torso: ['sp_x', 'sp_y', 'sp_z', 'ch_x', 'ch_y', 'ch_z'],
  head: ['h_pitch', 'h_yaw', 'h_roll'],
  armL: arm('L'),
  armR: arm('R'),
  eyes: ['lookX', 'lookY'],
  lids: ['blink'],
  mood: ['smile', 'browL', 'browR', 'browAng', 'wide', 'squint'],
  mouth: ['jaw', 'mW', 'mF', 'mL'],
  fx: ['fx1', 'fx2', 'fx3', 'hide'],
};
export const NAMES = Object.values(PARTS).flat();
export const CH = Object.fromEntries(NAMES.map((n, i) => [n, i]));
export const N = NAMES.length;
export const PART_OF = Object.fromEntries(Object.entries(PARTS).flatMap(([p, ns]) => ns.map((n) => [n, p])));
export const newPose = () => new Float64Array(N);
// Mirror a sparse pose left to right, so a move written for the right arm can be asked for on the left.
export function mirror(o) {
  const r = {};
  for (const k in o) {
    let k2 = k, v = o[k];
    if (/^[al]L_/.test(k)) k2 = k[0] + 'R' + k.slice(2); else if (/^[al]R_/.test(k)) k2 = k[0] + 'L' + k.slice(2);
    if (/(_yaw|_roll|_y|_z)$/.test(k) && /^(h_|r_yaw|r_roll|sp_|ch_|hp_)/.test(k) || k === 'lookX' || k === 'r_x') v = -v;
    if (k === 'browL') k2 = 'browR'; else if (k === 'browR') k2 = 'browL';
    r[k2] = v;
  }
  return r;
}
