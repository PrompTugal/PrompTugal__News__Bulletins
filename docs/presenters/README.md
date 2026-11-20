# Synthetic presenters as data: how they are made

This explains how bulletins.promptugal.news makes synthetic presenters for its video bulletins, so that a person, or another model such as ChatGPT, can rebuild it, extend it or do it differently.

- **Asked for by:** Dinis Cruz, 20 November 2026, in bulletins.b@'s session: "define almost a DSL for this, and then you just basically programmatically create the agents".
- **Written by:** bulletins.b@PrompTugal.dinis.
- **Licence:** code Apache-2.0, text CC BY 4.0.

What it produces today, all at bulletins.promptugal.news/lab/:
- `presenters/index.html`: twelve presenters, each driven live in the browser by one voice and one set of actions.
- `presenters/presenters.mp4`: the twelve side by side, 27.7 s, 1280x720.
- `video/200-animated.mp4` and `video/play.html`: one full bulletin with a presenter.

## The idea in one paragraph

A presenter is **data, not a picture**. A short description (`presenters.json`) says what kind of figure it is and how it looks, in words such as `"hair": {"style": "curly"}` or `"render": "hatch"`. Code compiles that description into drawn parts and a **rig**: where the head pivots, where the eyes and mouth are, which arm points. A separate **director** turns the bulletin's script and voice into **actions**: speak, blink, nod, look, point and emote. At any moment `t`, the actions fold into one **state**, such as `{mouth: 0.6, blink: 0, nod: 0.3, arm: 1, …}`. Every presenter knows how to show any state. So one script drives a hologram, a teletext mosaic, a hand-drawn robot and a 3D cube in exactly the same way, and **every frame is a pure function of t**. That is what makes the video reproducible and quick to render.

## The four layers

```
bulletin facts ─► checked sentences ─► voice (+ transcript check) ─► timeline.json
                                                                      │
presenters.json ──compile──► parts + rig                              │
        (layer 1)              (layer 2)                              ▼
                                   │                     director ─► actions   (layer 3)
                                   │                                  │
                                   └──────► apply(state) ◄── stateAt(actions, t, loudness)   (layer 4)
                                                 │
                            browser (live, audio-driven)  or  Playwright frame t ─► ffmpeg ─► MP4
```

| Layer | What it is | File |
|---|---|---|
| 1. Spec | What a presenter is, in high-level words | `src/lab/presenters/presenters.json` |
| 2. Parts and rig | Drawable shapes, plus the points that move | `compile()` in `src/lab/presenters/presenters.js` |
| 3. Actions | What the presenter does, and when | `direct()` in `presenters.js` |
| 4. State | Everything folded at one moment | `stateAt()` in `presenters.js`; each presenter's `apply(state)` |

## Layer 1: the presenter language (spec)

Each presenter is one object:

```json
{ "id": "rowan", "name": "Rowan", "category": "cartoon",
  "tags": ["line cartoon", "ginger beard"],
  "kind": "humanoid", "render": "line", "backdrop": "office",
  "credit": "After the founder in RiskMandate's cast; a new drawing.",
  "looks": { "skin": "#f0c8a0", "hair": { "style": "curly", "color": "#c8642a" }, "beard": "#c8642a",
             "outfit": { "style": "shirt", "color": "#1a7f5a" }, "prop": "tablet", "ink": "#0d0d0c" } }
```

**`kind`** chooses the body plan, and each body plan has its own `looks` words:

| kind | looks |
|---|---|
| `humanoid` | `skin`; `hair.style` (short, side, quiff, curly, grey, bald) and `hair.color`; `beard` (a colour, or absent); `glasses` (a colour); `outfit.style` (suit, jumper, shirt) with `color`, `shirt`, `tie` and `lapel`; `prop` (tablet, mic, pencil); `eyeColor`; `lip`; `ink` |
| `boxbot` | `head.w`, `head.h`, `head.color`, `head.screen`; `face` (dots, or clock); `antenna` (true or false) and `antennaColor`; `hat` (hardhat, beret) and `hatColor`; `glasses`; `badge` (text); `body.shape` (box, tunic) and `body.color`; `handColor`; `prop` (magnifier, card, keys); `ink` |
| `owl` | `color`, `belly`, `glasses`, `ink` |
| `mosaic` | a teletext face as `grid` rows of palette letters, `palette`, `cell`, `mouthRow`, and three `mouths` (closed, half, open), each a pair of rows |
| `cube3d` | `size`, `colors` per face; drawn in real CSS 3D |

**`render`** chooses the drawing style. It applies to any body plan:

| render | What it does |
|---|---|
| `flat` | Flat fills and a thin ink outline (the book's cover style) |
| `line` | Flat fills and a thick ink outline (a clean line cartoon) |
| `hatch` | Hand-drawn: each outline drawn twice with a seeded wobble, and fills hatched (the storyboards' style) |
| `realistic` | Radial gradients for light and shade, highlights in the eyes, no outline |
| `hologram` | A cyan-to-blue see-through gradient, scan lines, a moving light band, flicker and a glow |
| `teletext` | Used with `mosaic`; blocks only |
| `3d` | Used with `cube3d` |

**`backdrop`** names a CSS background: grid-navy, studio, soft-studio, black, paper, zx, office, dusk or gradient.

**`credit`** is required whenever a presenter follows someone else's style.

## Layer 2: parts and rig (what the spec compiles to)

`Presenters.compile(spec)` returns `{ parts, rig }`.

- A **part** is one shape: `{ shape: 'ellipse'|'rect'|'path'|'grid'|'text', layer: 'body'|'head'|'arm'|'front', fill, stroke, sw, …geometry }`. Its geometry is in a 240 × 320 box. Parts on the `head` layer move with the head, and parts on the `arm` layer move with the pointing arm.
- The **rig** holds the points that actions move:
  - `headPivot` [x, y];
  - `eyes` [{cx, cy, r}];
  - `mouth` {cx, cy, w, h, color};
  - `shoulder` [x, y], the pivot of the arm that points;
  - for a mosaic, which rows hold the mouth.

You can skip the body plans and write parts directly. That is the low-level form of the language, for one-off characters.

## Layer 3: the action language

An action is `{ t, dur, do, … }`, in seconds:

| do | Fields | Effect |
|---|---|---|
| `speak` | none | While active, the mouth opens with the voice's loudness |
| `blink` | none | The eyes close and open (a 0.16 s bump) |
| `nod` | `amount` | The head dips and comes back |
| `look` | `dir`: camera or content | The pupils, and for the cube the whole body, turn |
| `point` | `dir`: content | The arm rises towards the story and comes back |
| `emote` | `mood`: smile | The resting mouth curves into a smile |

`Presenters.direct(timeline)` writes the actions from the bulletin's timeline, by rules:
- **speak** through every segment;
- **look** at the camera, then at the content, on alternate segments;
- **smile** in the opening and the closing;
- **nod** on every number as it is spoken;
- **point** at the content when a sentence starts, and again when its bars appear;
- **blink** every 2.6 to 4.4 s, with a seeded random interval, so it is the same every run.

You can write actions by hand instead, or add your own to the list.

## Layer 4: state at time t

`Presenters.stateAt(actions, t, loudness)` returns:

`{ t, mouth 0..1, blink 0..1, tilt (degrees), nod 0..1, look -1..1, arm 0..1, smile 0..1, bob -1..1 }`

`build(spec, element)` draws the presenter and returns `{ apply(state) }`. Each body plan maps the state onto its rig:
- `humanoid`, `boxbot` and `owl`: SVG transforms (the head rotates about `headPivot`; the eyes scale vertically; the pupils shift; the mouth ellipse opens; the smile curve bends).
- `mosaic`: swaps between three mouth rows.
- `cube3d`: rotates the cube in CSS 3D.

Nothing reads the clock or uses a random number at draw time. The same t always gives the same frame.

## The voice and the timeline (made once per bulletin)

1. **`bulletins/video.mjs <page>`** picks up to three of the page's sentences that the check has kept, puts dates and units into spoken form by rule, and asks `openai/gpt-audio-mini` through OpenRouter to read them in the stock voice "alloy". The model's own transcript of what it said must match the script word for word, or nothing is published. Cost: about 0.002 USD for 30 seconds. The voice is labelled synthetic on every frame and in the closing words.
2. **`bulletins/video2.mjs <page>`** reads the voice's loudness every 1/25 s and gives each word a start time. These are estimated from each segment's share of the words and from word length; they are not measured. It also finds the bars to grow and writes `src/lab/video/timeline.json`:
   ```json
   { "duration": 27.7, "fps": 25,
     "segs": [{ "kind": "line", "show": "…", "start": 4.6, "end": 12.4,
                "words": [{ "w": "IPMA", "start": 4.75 }],
                "bars": [{ "v": 20.5, "place": "Faro", "word": 4 }],
                "src": "…", "links": [] }],
     "amp": [0.0, 0.31] }
   ```
   It then renders the full bulletin.
3. **`bulletins/presenters-video.mjs`** renders the side-by-side wall.

## Rendering

- **The pages:** both pages load `presenters.js`, which builds the presenters, and `gallery.js`, which runs them. In the browser, the audio element's `currentTime` is t. For the video, a page exposes `window.renderAt(t)`.
- **The video:** Node serves `src/` on localhost and starts headless Chromium with Playwright. For every frame f it calls `renderAt(f / 25)` and takes a screenshot. ffmpeg joins the PNGs with the voice (`libx264`, `yuv420p`, `+faststart`).
- **Speed:** twelve presenters, 692 frames, 67 s on one container CPU, with no GPU.
- **Dependencies:** none beyond Node's built-ins, Playwright's Chromium and ffmpeg. No npm packages, no network at render time, and every script is under `script-src 'self'`.

## To add a presenter

1. Add an object to `presenters.json`, with a new `id`, a `kind`, `looks`, a `render` and a `backdrop`.
2. Open `/lab/presenters/` and press play.
3. To make it a new body plan, add a function next to `humanoid()` in `presenters.js`. It returns `{ parts, rig }` and is registered in `build()` and `compile()`.
4. Run `node bulletins/presenters-video.mjs` to render the wall.

## Rules every presenter follows

- **Synthetic, and labelled:** "Synthetic presenter" and "synthetic voice" on screen, and in the video's metadata. EU AI Act Article 50 transparency duties apply from 2 August 2026.
- **No one's likeness:** every presenter is an original character. Following a style, such as the storyboards, the book or RiskMandate's cast, means a new drawing in that style, credited. It is never a trace or a copy.
- **No female figure in this round,** at Dinis's word ("I don't want to use a women figure").
- **Only checked words:** the presenter says only sentences the bulletin's check kept, read word for word.

## Known limits (honest)

- Word timings are estimated, not measured. A forced aligner (WhisperX, BSD-2) would fix this. Mouth shapes follow loudness, not phonemes; Rhubarb Lip Sync (MIT) would give real visemes.
- These presenters are stylised. For near-photo-real ones, see the research in `docs/research/2026-11-20-synthetic-presenter-tools.md`, which compares Kling AI Avatar and Hedra. Both take our own image and our own voice, and cost about $1.50 to $1.70 per 30 s.
- The mosaic presenter does not blink yet.
- The cube is the only true 3D presenter. three.js with VRM would be next.

## A prompt for another model

> You are building synthetic news presenters as data. Read https://github.com/PrompTugal/PrompTugal__News__Bulletins/blob/dev/docs/presenters/README.md, then src/lab/presenters/presenters.json and src/lab/presenters/presenters.js in the same repository. Keep the four layers: spec, parts and rig, actions, and state at t. Keep every frame a pure function of t. Write three new presenters as JSON specs in the same language: one more realistic human (male), one non-human or shape, and one in a style of your choice. If a spec needs a new body plan, write it as a function that returns { parts, rig }. Do not copy anyone's likeness. Label every presenter as synthetic. Return the JSON, any new code, and a list of the actions each presenter supports.

## Credits

- **Storyboards:** the style of "The Guide" and "The Agent" follows storyboards.sgit.ai's cast (content CC BY 4.0, code Apache-2.0). The drawings here are new code.
- **The book:** the style of "Conductor" and "Researcher" follows the cover of *One Human, Nine Agents, Nineteen Hours* by Dinis Cruz (the-ultimate-insider.book.sgit.ai, CC BY 4.0).
- **RiskMandate:** "Rowan" and "The Caretaker" follow RiskMandate's cast (riskmandate.ai/stories/cast.json), as new drawings in a clean line-cartoon style.
- **Map:** designer@'s ptmap.
- **Voice:** OpenRouter's `openai/gpt-audio-mini`, stock voice "alloy".
