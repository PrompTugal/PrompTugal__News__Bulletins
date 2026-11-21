# Presenters version 2 (Claude)

**The full technical, implementation and usage debrief for the team is `docs/presenters/v2-claude-debrief.md`.** This README is the short version that lives with the code.

**Status: a proposal on a lab branch.** Built by presenters.v2-claude@PrompTugal.dinis (Claude, in a chat session with a sandbox) on 20 November 2026, from the brief in `docs/presenters/briefs/` that bulletins.b@PrompTugal.dinis wrote at Dinis Cruz's request. Dinis decides what is kept. Code Apache-2.0, text CC BY 4.0.

Dinis's words (20 November 2026): "create a much more high definition version of this ... multiple views and multiple examples of those 12 characters ... a lot more features ... think like a game designer. Imagine these are characters on a game. And it's all JavaScript ... third-party libraries, that's okay".

Every character here is a **synthetic presenter**: an original figure built by code from `characters.json`. None is the likeness of a real person. There is no female figure in this set, at Dinis's word.

## What is in this folder

| File | What it is |
|---|---|
| `index.html` + `showcase.js` | The showcase: the twelve on one stage for 114 s. Play, pause, scrub, speed, camera on one character, zoom |
| `sheet.html` + `sheet.js` | The model sheet: for each character 6 views, 8 expressions, 9 mouth shapes, 8 key poses and its specials |
| `playground.html` + `playground.js` | Pick a character and a move, set its parameters, trigger it, stack more; the live state as numbers |
| `characters.json` | Layer 1: the twelve, in version 1's presenter language with more words |
| `moves.json` | The move set: 69 moves, 9 mouth shapes, 8 expressions |
| `choreography.json` | The showcase as data: 118 cues, 49 camera shots, the voice's place |
| `visemes.json` | Mouth cues for version 1's voice, made offline with Rhubarb Lip Sync |
| `engine/` | The code, in 14 modules (below) |
| `render.mjs` | Exports `showcase.mp4` with Playwright and ffmpeg, frame by frame |
| `tools/` | `determinism.mjs` (the proof below), `make-choreography.mjs` (wrote `choreography.json`), `pack.mjs` (each page as one self-contained file), `variants.json` (trial looks for Rowan and Rui), and developer screenshot tools |
| `images/` | Screenshots used by the debrief |
| `vendor/` | three.js 0.160.1 and its licence |
| `PLAN.md`, `THIRD_PARTY.md`, `COMPARISON.md` | The plan as first proposed, the libraries, and version 1 beside version 2 |
| `dev.html` + `dev.js` | A developer page for posing any character with any cues; `?variants=1` shows the trial looks. Not a deliverable |

## The one decision that shapes it

Version 1 draws each presenter as a flat front view. Here every presenter is a **3D puppet on one shared skeleton**, and each presenter's **drawing style is a shader** on that puppet. So a turnaround is the model turned (no view can drift off-model), a move is written once for twelve bodies, and the style stays the character's identity: Duarte is still flat fills and a thin ink line, The Guide is still hatched and boiling, Ceefax is still nothing but teletext blocks.

## How it extends version 1's four layers

```
characters.json ──build──► parts + skeleton + face rig          (layers 1 and 2: bodies.js, geometry.js, face.js, materials.js, rig.js)
moves.json ─┐
            ├─ director ─► actions per character                  (layer 3: director.js)
choreography.json ─┘                │
                                    ▼
             fold(actions, t) ─► pose (69 numbers) ─► springs ─► rig.apply(pose)   (layer 4: state.js, springs.js, rig.js)
                                                                    │
                       browser (clock picks t)   or   render.mjs (t = frame / 60) ─► ffmpeg ─► MP4
```

| Layer | Version 1 | Version 2 |
|---|---|---|
| 1. Spec | `presenters.json` | `characters.json`: the same ids, names, kinds, looks, backdrops and credits, plus `slot`, `free` (the hand without a prop), `fidget`, `gait`, `specials`, `springs` |
| 2. Parts and rig | SVG shapes, 4 rig points | Primitives merged per joint; a skeleton of about 20 joints; eyes with lids, brows, a mouth mesh |
| 3. Actions | `{ t, dur, do }`, 6 verbs, written by `direct()` | The same shape, 69 verbs. Cues `{ t, who, do, ...parameters }` in `choreography.json`; the director adds breathing, weight shifts and seeded blinks by rule, as `direct()` did |
| 4. State at t | `stateAt()` gives 8 numbers | `fold()` gives 69 channels, with layering and cross-fades; then springs |

### The modules

| Module | Role |
|---|---|
| `math.js` | Easing curves, a seeded generator, hashes. Nothing reads a clock |
| `channels.js` | The 69 channels and the body part each belongs to; `mirror()` for left and right |
| `moves.js` | Evaluates a move at its local time. `pose` and `keys` moves are data; `fn` moves are one function each |
| `state.js` | `fold()`: where the character stands, then each active action by weight on the parts it drives, then additive values |
| `springs.js` | Secondary motion on a fixed 1/120 s grid from t = 0, with a checkpoint every second |
| `director.js` | Cues to actions; locomotion chained from where the last one ended; blinks and idles; camera shots; beats |
| `geometry.js` | Capsules, rounded boxes, a sculpted head, decals, and the `Kit` that merges parts per joint |
| `materials.js` | The styles as shaders: flat, line, hatch, realistic, hologram, teletext, 3d; and the ink outline |
| `face.js` | Eyeballs and lids, screen eyes, brows, and the mouth mesh that shows any blend of mouth shapes |
| `bodies.js` | The five body plans: humanoid, boxbot, owl, cube3d, mosaic |
| `rig.js` | `build(spec)` gives a character with `apply(pose, springs, t)`: the only place channels become joint angles |
| `teletext.js` | Ceefax: the figure is drawn off-screen at sextant size and every 2 × 3 cell is forced to one of eight colours on black |
| `stage.js` | Scene, lights, floor, camera, which characters are drawn; `render()` |
| `timeline.js` | The page clock: the only reader of real time, and it only chooses t |

## How each character is drawn

| id | Name | Body plan | Style | Specials |
|---|---|---|---|---|
| holo | Tejo | humanoid on a projector base | hologram: rim light, scan lines, sweep band, flicker, slice glitch, dissolve, glow shell, rising motes | glitch, rematerialise, scanSweep |
| anchor | Duarte | humanoid, tablet, tie on springs | flat: flat fills, one cel band, thin ink | straightenTie |
| realist | Rui | humanoid, sculpted head | realistic: matt physically based materials, 3,600 combed hair strands and stubble as one instanced mesh | microExpression |
| teletext | Ceefax | blocky humanoid seen only as a mosaic | teletext: 24 × 20 cells of 2 × 3 sextants, 8 colours | pageFlip, colourCycle |
| guide | The Guide | humanoid, glasses, pencil | hatch: paper fill, tone-driven cross-hatching, double outline redrawn 8 times a second | sketchOn |
| agent | The Agent | boxbot, tunic, antenna on springs | hatch | antennaSpark |
| conductor | Conductor | boxbot, clock face, card, ZX stripes | flat | clockSpin (the hands are its eyes: they carry look, blink and mood) |
| researcher | Researcher | boxbot, glasses, magnifier | flat | magnify |
| rowan | Rowan | humanoid, curls and beard, tablet | line: thick ink with weight | cartoonTake |
| caretaker | The Caretaker | boxbot, badge, three keys on springs | line | keyJingle |
| owl | Mocho | owl: wings are its arms | flat | headTurn270, wingFlap (and it flies in and out) |
| cube | Cubo | cube; gloves appear only while it gestures | 3d: lit, rounded, glossy | rollEdge, bounce |

## The move set

69 moves, grouped as in `moves.json`: version 1's six (6), idle (4), locomotion (8), gestures (11), head (4), face (3), reactions (6), stage (3), specials (24). Eleven are pure data (`pose` or `keys`); the rest name one function in `moves.js`.

**Blending.** Every action has a weight that fades in and out (0.16 s and 0.22 s unless its move says otherwise). Actions are folded in start order. A later action wins, but only on the body parts it drives and the channels it writes, so the legs keep walking while an arm waves. Additive moves (breathe, nod, shake, the head bob of speech) are summed on top.

**The principles of animation, where they are in the code.** Anticipation and overshoot: `poseEnv()` and the `inBack`, `outBack` and `outElastic` curves. Squash and stretch: the `r_sy` channel, volume-preserving, scaled by each body's `elastic` number in `moves.js` (a robot barely deforms, Cubo deforms a lot). Follow-through: `springs.js`. Overlapping action: `lookAt` moves eyes, then head, then chest. Arcs: joints rotate. Timing: `flinch` is fast in and slow out. Staging: shots and the `only` list in `choreography.json`.

## To add a character

1. Add an object to `characters.json`: a new `id`, a `kind` (humanoid, boxbot, owl, cube3d or mosaic), `looks`, a `render` style, a `backdrop`, a `slot` [x, z] on the stage, and optionally `free`, `fidget`, `gait`, `specials` and `springs`.
2. Open `sheet.html`: it appears with every view, expression and pose. Open `playground.html` to move it.
3. Add it to the groups in `choreography.json` if it should join the showcase.
4. For a new body plan, add one function to `bodies.js` that returns `{ J, d, kit, face, rest }` on `skeleton(d)`, and register it in `BODIES`; add its `KIND` line in `moves.js`.

## To add a move

- **As data:** add an entry to `moves.json` with `kind: "pose"` (a pose to go to and return from; written for the right arm, with `sym: true` to mirror it to both, or a `side` parameter) or `kind: "keys"` (keyframes `[u, pose, ease]`). List the `parts` it drives. Nothing else: it appears in the playground.
- **With arithmetic:** add `kind: "fn"` to `moves.json` and one function to `FN` in `moves.js`: `(u, tl, a, c) => ({ channel: value, add: { channel: value } })`. It must keep no state between calls.
- Call it from `choreography.json`: `{ "t": 12, "who": "front", "do": "myMove", "stagger": 0.1 }`.

## To run it locally

```
git clone https://github.com/PrompTugal/PrompTugal__News__Bulletins && cd PrompTugal__News__Bulletins
git checkout lab/presenters-v2-claude            # once the branch is pushed; the folder also drops into dev
cd src && python3 -m http.server 8000            # then open http://localhost:8000/lab/presenters/v2-claude/
cd .. && node src/lab/presenters/v2-claude/render.mjs                       # showcase.mp4, 1920 x 1080, 60 fps
node src/lab/presenters/v2-claude/render.mjs --from 86.2 --to 90.2          # a part of it
node src/lab/presenters/v2-claude/tools/determinism.mjs                     # the proof below
```

Needs Node 20 or later, Playwright's Chromium and ffmpeg. Used here: Node 22.23.5, Playwright 1.63.0, ffmpeg 6.1.1 (source: the tools' own version output in this session). The pages need WebGL and must be served over http; they do not open from `file://`. They carry `Content-Security-Policy: default-src 'self'; script-src 'self'` in a meta tag: no inline script, no inline style, text set with `textContent` only.

## Libraries

three.js 0.160.1 (MIT), vendored, is the only library the pages load. Rhubarb Lip Sync 1.13.0 (MIT), Playwright (Apache-2.0) and ffmpeg are used offline. Details, commands and what was not used: `THIRD_PARTY.md`.

## Determinism

- A pose is closed-form: `fold(actions, t)` reads only the action list and t. Blinks are placed once by a seeded generator.
- Springs are integrated on a fixed 1/120 s grid that always starts at rest at t = 0. A seek restores the nearest one-second checkpoint and steps from there: the same grid points and the same arithmetic as a run from 0.
- Shaders take t as a uniform. Flicker, line boil and glitch are hashes of `floor(t × rate)`.
- No `Date.now()`, `Math.random()` or `performance.now()` in anything the pages load (searched for). `timeline.js` reads `requestAnimationFrame`'s timestamp, and only to choose t.

**The proof** (`tools/determinism.mjs`, run again on 21 November 2026 after Rui and Rowan were given look D): each time rendered twice at 1920 × 1080, every render in its own browser launch, SHA-256 of the PNG, first 16 digits shown.

| t (s) | first launch | second launch | same |
|---|---|---|---|
| 0 | e7a99e6137a21c4c | e7a99e6137a21c4c | yes |
| 7.3 | eaccea4707d63a5c | eaccea4707d63a5c | yes |
| 42 | 1062d40b22adb533 | 1062d40b22adb533 | yes |

This holds for one machine and one renderer (here software WebGL). Two different GPUs may differ in the last bit of a pixel.

## How long a render took, and on what machine

Machine: one core of an Intel Xeon at 2.10 GHz, 3 GB of memory, no GPU; Chromium's software WebGL (SwiftShader). Source: `render.mjs`'s own log and a profile run in this session.

- **What was exported (on 20 November, before the changes to Rui and Rowan; neither is in shot):** 4.0 s of the lip-sync passage (t = 86.2 to 90.2), 240 frames at 1920 × 1080 and 60 fps, PNG frames, with the voice: `showcase-excerpt-lipsync-1920x1080-60fps.mp4`. The last 49 frames took 0.84 s each; encoding took 10 s.
- **A frame with all twelve on screen** took about 1.3 s to draw and 0.23 s to photograph.
- **The whole showcase was not exported.** It is 6,840 frames. At those rates that is roughly two to two and a half hours on this machine (an estimate, not a measurement), and the sandbox stops any command after 300 seconds. `render.mjs` keeps its frames and skips those already made, so it can be run again until it finishes; on a machine with a GPU, add `--gpu`.

## Known limits (honest)

- **Not released.** Nothing is committed or pushed: the sandbox has no credentials and no signing key, so the repository's signature check cannot pass from here. The leak scan was run on the folder (result in the hand-over message). The files are delivered to drop in.
- **No sub-agents.** The brief suggests them; a chat session has none. One session did all of it, and craft is uneven as a result.
- **The weakest model is Rui.** The brief asks for the most realistic figure code can make. What is here is stylised: a sculpted head, matt lit materials and combed hair strands, but the skin has no detail, the eyes are small and the hair is thin at the sides. It is not near photo-real. (On 21 November Dinis chose look D for both from five trial looks in `tools/variants.json`: Rui fully matt with a longer quiff, a goatee and bigger eyes; Rowan with stubble and a moustache in place of the full beard.)
- **Flat styles on 3D forms.** Five characters the brief files under "vector" are toon-shaded 3D. They keep their look from the front; from the side a painted flat style can look like a toy.
- **The puppets are jointed, not skinned.** Limbs are rigid parts that overlap at the joints. Fingers have one segment. Extreme poses can show the joins.
- **Walks are simple.** Feet are driven by angles, not planted by inverse kinematics, so they can slide a little.
- **Cubo's gestures use floating gloves** that appear only while an arm channel is in use. That is a choice; a cube with no hands could not count or point.
- **Ceefax lives on a panel.** The mosaic is true to teletext (one colour per cell, on black), but the panel is a flat page: seen from the side it is a thin slab.
- **Poses were tuned by eye on a few bodies.** `holdUp` and `handsOnHips` are approximate on some characters, and hands can pass through a prop or a body.
- **Lip-sync:** the mouth shapes come from the sound. The sentences shown under each speaker are placed by the pauses I measured in the voice, not by forced alignment. The passage uses the opening, the first sentence and the closing of version 1's bulletin; the second sentence (the temperatures) is left out to keep the showcase under two minutes.
- **Name tags are busy in the wide shots.** They can be switched off on the page, but the export keeps them, because every character must be labelled.
- **Software rendering is slow** (above). Live, on a GPU, the pages should run at the display's rate; that was not measured here, because the sandbox has no GPU.
- **Not looked at:** every cell of the model sheet. I read back the sections for Duarte and Rui, and the showcase at about 60 chosen times; the other ten characters' sheet sections were drawn but not inspected one by one.
- **Not done from the plan:** a `v1`-style wall or split video; a director that writes actions from a bulletin's `timeline.json` (version 1's `direct()`); the plan's "about 80 channels" came out as 69.

## Comparison with version 1

See `COMPARISON.md`. In short: any view instead of one, 69 moves instead of 6, 69 channels instead of 8, mouth shapes from the sound instead of loudness, locomotion, layering, springs, a camera, and one library where version 1 had none; and it renders about ten times more slowly without a GPU.

## Credits

- **Storyboards:** The Guide and The Agent follow the style of storyboards.sgit.ai's cast (content CC BY 4.0). New models.
- **The book:** Conductor and Researcher follow the cover of *One Human, Nine Agents, Nineteen Hours* by Dinis Cruz (the-ultimate-insider.book.sgit.ai, CC BY 4.0). New models.
- **RiskMandate:** Rowan and The Caretaker follow RiskMandate's cast (riskmandate.ai/stories/cast.json). New models.
- **Version 1:** bulletins.b@PrompTugal.dinis: the four layers, the presenter language, the twelve characters and the voice.
- **Voice:** OpenRouter's `openai/gpt-audio-mini`, stock voice "alloy": synthetic, and labelled so.
- **three.js** authors (MIT); **Rhubarb Lip Sync** by Daniel Wolf (MIT).
