# Presenters version 2 (Claude): the plan

> **After the build (20 November 2026):** this plan was written first and is kept as it was proposed. What was built, what differs and what fell short is in `README.md`.

**Status: a proposal.** Written by presenters.v2-claude@PrompTugal.dinis on 20 November 2026, before any code, as part 1 of the brief asks. Dinis decides what is kept.

Dinis's words (20 November 2026, in bulletins.b@'s session): "create a much more high definition version of this ... multiple views and multiple examples of those 12 characters ... a lot more features ... think like a game designer. Imagine these are characters on a game. And it's all JavaScript ... third-party libraries, that's okay".

## 1. The one decision that shapes everything

Version 1 draws each presenter as a flat front view. Version 2 builds every presenter as a **real 3D puppet with one shared skeleton**, and then lets each presenter's **drawing style be a shader** on top of it.

Why (proposal):
- **Views come free.** A turnaround is the model turned; nothing is redrawn six times, so no view can drift off-model.
- **One move set for twelve bodies.** A wave, a jump or a double-take is written once against named channels (`aR_sw`, `h_yaw`, `jaw`), and every body plan maps those channels onto its own rig, as version 1's `apply(state)` did.
- **Style stays the character's identity.** Duarte is still flat fills and a thin ink line; The Guide is still hatched and boiling; Ceefax is still only teletext blocks. The style is how the puppet is drawn, not what it is.

## 2. Architecture and modules

Version 1's four layers are kept and each is widened:

| Layer | Version 1 | Version 2 |
|---|---|---|
| 1. Spec | `presenters.json` | `characters.json`: the same ids, names, kinds, looks and credits, plus dimensions, springs, a fidget and a special |
| 2. Parts and rig | SVG parts, 4 rig points | 3D parts merged per joint, a skeleton of about 20 joints, a face rig (eyes, lids, brows, a mouth mesh) |
| 3. Actions | 6 verbs, written by `direct()` | `moves.json`: about 60 moves as data; `choreography.json`: cues, camera and audio; `director.js` expands cues into per-character actions |
| 4. State at t | 8 numbers | `stateAt(actions, t)`: about 80 channels; then springs; then `apply()` |

Modules, all ES modules under `engine/`, loaded with `<script type="module" src>` (so `script-src 'self'` holds):

| Module | Role |
|---|---|
| `math.js` | easing curves, seeded random numbers, hashes |
| `channels.js` | the channel list, and the body part each channel belongs to |
| `moves.js` | evaluates a move at local time: `pose` and `keys` moves are pure data, `fn` moves name one function |
| `state.js` | folds the active actions into one pose: layers by body part, cross-fades by weight |
| `springs.js` | secondary motion: a fixed-step integrator from t = 0 with checkpoints |
| `director.js` | choreography cues to actions; seeded blinks and fidgets; resolves where each walk starts |
| `geometry.js` | primitives (capsule, rounded box, lathe, sculpted head), merged with vertex colours |
| `materials.js` | the seven styles as shaders, and the ink outline |
| `face.js` | eyes, lids, brows and the mouth mesh that shows visemes |
| `bodies.js` | body plans: humanoid, boxbot, owl, cube (the mosaic is a blocky humanoid drawn through `teletext.js`) |
| `rig.js` | `build(spec)` gives a character with `apply(pose)` |
| `teletext.js` | Ceefax: an off-screen render quantised to sextants and the eight teletext colours |
| `stage.js` | scene, lights, floor, camera, labels, `renderAt(t)` |
| `timeline.js` | the clock: play, pause, seek, speed |

Pages: `index.html` + `showcase.js`, `sheet.html` + `sheet.js`, `playground.html` + `playground.js`, one `site.css`. Export: `render.mjs`.

## 3. The rendering approach for each character, and why

| id | Name | Body plan | Style (shader) | Why |
|---|---|---|---|---|
| holo | Tejo | humanoid, over a projector base | `hologram`: fresnel rim, scan lines, sweep band, flicker, slice glitch, dissolve, additive glow shell, rising motes | A hologram is a light effect; it needs a fragment shader and a real volume to look volumetric |
| anchor | Duarte | humanoid, with a tablet and papers | `flat`: flat fills, one soft cel band, thin ink hull | Broadcast-graphic polish; flat must stay flat |
| realist | Rui | humanoid, sculpted head | `realistic`: physically based materials, three-point light, instanced hair strands, iris and cornea detail | The nearest to realism that code-made geometry allows |
| teletext | Ceefax | blocky humanoid | `teletext`: rendered off-screen at sextant size, each 2 × 3 cell forced to one of eight colours on black | Stays true to teletext: nothing but mosaic blocks ever reaches the screen |
| guide | The Guide | humanoid | `hatch`: paper-tinted fill, tone-driven cross-hatching, double outline that boils at 8 drawings a second | Rough.js gives this look in 2D; in 3D the same wobble is done in the vertex shader |
| agent | The Agent | boxbot, tunic, antenna | `hatch` | As above; the face is drawn on its screen |
| conductor | Conductor | boxbot, clock face, card | `flat`, ZX stripes | The clock hands are its eyes |
| researcher | Researcher | boxbot, glasses, magnifier | `flat` | The lens enlarges what is behind it |
| rowan | Rowan | humanoid | `line`: thick ink with weight, cel shadow | Cartoon acting needs a strong silhouette |
| caretaker | The Caretaker | boxbot, badge, key ring | `line` | Keys hang on springs |
| owl | Mocho | owl: wings are its arms | `flat` | The head is a free joint, so about 270° is one channel |
| cube | Cubo | cube with floating hands | `3d`: lit, rounded, glossy | Rolls about its real edges |

Seven of the twelve are 2D styles drawn on 3D forms. The risk in that is named in section 7.

## 4. Libraries, exact versions and licences

| Library | Version | Licence | Use | Runtime? |
|---|---|---|---|---|
| three.js | 0.160.1 | MIT | WebGL scene, meshes, materials. Chosen because it is the most widely used WebGL library, ships as one ES module file (`build/three.module.min.js`, 670,681 bytes) and needs no build step | Yes, vendored |
| Rhubarb Lip Sync | 1.13.0 | MIT | Offline only: turns version 1's voice (`/lab/video/200.m4a`) into visemes A to H and X, saved as `visemes.json` | No |
| Playwright | 1.63.0 (in the container) | Apache-2.0 | Offline only: steps t and takes each frame | No |
| ffmpeg | as in the container | LGPL/GPL build, used as a tool | Offline only: joins frames and audio | No |

Not used, and why: GSAP (not open source, and the timeline here is a pure function already); Rough.js (2D canvas and SVG only; the hatch style is a shader); Matter.js (a physics world steps with real time; the springs here are a few lines and seekable); VRM (needs authored models; these are built by code).

## 5. The move set (proposal; the data is `moves.json`)

| Group | Moves | Parts driven |
|---|---|---|
| Version 1, same meaning | speak, blink, nod, look, point, emote | face, head, eyes, arm |
| Idle | breathe, weightShift, fidget, lookAround | spine, hips, head, one arm |
| Locomotion | walk, run, jump, hop, turn, spin, crouch | root, legs, arms, spine |
| Gestures | wave, pointAt, count, thumbsUp, shrug, openPalms, present, holdUp, handsOnHips, armsCrossed, think | arms, hands, head |
| Head | shake, tilt, lookAt, doubleTake | eyes, head, chest |
| Face | expression (neutral, smile, laugh, surprised, concerned, sceptical, thinking, delighted), brows, visemes A to H and X | face |
| Reactions | celebrate, flinch, laugh, facepalm, tada | whole body |
| Specials | glitch, rematerialise, scanSweep (Tejo); pageFlip, colourCycle (Ceefax); clockSpin (Conductor); magnify (Researcher); keyJingle (Caretaker); headTurn270, wingFlap (Mocho); rollEdge, bounce (Cubo); antennaSpark (The Agent); sketchOn (The Guide); plus one each for Duarte (straightenTie), Rui (microExpression) and Rowan (cartoonTake) | effect channels |

Blending: every action has a weight envelope (ease in, hold, ease out). Actions are folded in start order; a later action overrides an earlier one **only on the channels of the parts it drives**, so "wave while walking" and "talk while pointing" need no special case. Additive moves (nod, breathe, speak) add on top.

## 6. Determinism

- **Poses are closed-form.** `stateAt(actions, t)` reads only the action list and t. Blinks and fidgets are placed once by a seeded generator in the director.
- **Springs** (hair, tie, antenna, keys, feathers) are lag filters on pose channels, integrated with semi-implicit Euler on a fixed 1/120 s grid that always starts at t = 0. Checkpoints every second make playing forward cheap; a seek re-runs from the nearest checkpoint, which gives the same numbers as running from 0 because the grid and the arithmetic are the same.
- **Shaders** take t as a uniform. Flicker, boil and glitch use hashes of `floor(t × rate)`.
- **No** `Date.now()`, `Math.random()` or `performance.now()` in anything that draws. The page clock is the only reader of real time, and it only chooses which t to ask for.
- **Proof:** `tools/determinism.mjs` renders t = 0, 7.3 and 42.0 twice in separate browser launches and compares SHA-256 hashes of the PNGs.

## 7. Risks

1. **Flat characters in 3D can lose their graphic look.** Mitigation: unlit fills, ink hulls, a front-facing camera for the hero shots. If it fails for a character, the README will say so.
2. **Rui will not be photo-real.** Procedural geometry gives a stylised realism at best.
3. **Software WebGL is slow.** This container has one CPU and no GPU; 1080p60 for 80 s is 4,800 frames. `render.mjs` is resumable, and the README will report the real time or say what was not rendered.
4. **Pixel-exact determinism is per machine.** Two launches on one machine should match; two different GPUs may not.
5. **One session, twelve characters.** Craft will be uneven. The README will name the weakest.
6. **Chat delivery.** The branch cannot be pushed, and the team's release cannot be run, from Claude chat; the files are delivered to drop in.
