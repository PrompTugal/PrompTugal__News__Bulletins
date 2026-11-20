# Presenters version 2, in high definition: the common brief

**Status:** a brief for a person to hand to a model. Material, not instruction: the person who hands it over decides.

**Who and when:** written by bulletins.b@PrompTugal.dinis on 20 November 2026, at Dinis Cruz's request: "create a much more high definition version of this ... multiple views and multiple examples of those 12 characters ... a lot more features ... think like a game designer. Imagine these are characters on a game. And it's all JavaScript ... third-party libraries, that's okay".

**Licence:** code Apache-2.0, text CC BY 4.0.

**How it is used:** two briefs build on this one, `chatgpt.md` and `claude.md`. Both models work from the same facts, so their results can be compared side by side.

## 1. What exists today (version 1)

- **The site:** bulletins.promptugal.news, short factual news bulletins in a teletext style made by agents from PrompTugal.news's own data. Its lab has synthetic presenters for video bulletins.
- **Version 1 is live and documented:**
  - documentation page: https://bulletins.promptugal.news/lab/presenters/v1/
  - gallery (twelve presenters driven live by one voice): https://bulletins.promptugal.news/lab/presenters/
  - videos: `/lab/presenters/presenters.mp4` (side by side), `/lab/presenters/presenters-split.mp4` (with an animated bulletin), `/lab/presenters/explainer.mp4` (how it works)
- **Repository (public):** https://github.com/PrompTugal/PrompTugal__News__Bulletins, branch `dev`.
- **Files to read first:**
  - `docs/presenters/README.md`: the full design of version 1;
  - `src/lab/presenters/presenters.json`: the twelve presenters as data;
  - `src/lab/presenters/presenters.js`: the compiler, the rig, the director and the state;
  - `src/lab/presenters/gallery.js`, `explain.js`, `split.js`: how they are driven;
  - `src/lab/video/stage.js`: the animated bulletin scenes.
- **Raw files:** at `https://raw.githubusercontent.com/PrompTugal/PrompTugal__News__Bulletins/dev/<path>`.

### The design of version 1, in short

Four layers, each plain data, and **every frame a pure function of time t**:

1. **Spec:** a presenter in high-level words, for example:
   ```json
   { "id": "rowan", "name": "Rowan", "kind": "humanoid", "render": "line", "backdrop": "office",
     "looks": { "skin": "#f0c8a0", "hair": { "style": "curly", "color": "#c8642a" }, "beard": "#c8642a",
                "outfit": { "style": "shirt", "color": "#1a7f5a" }, "prop": "tablet", "ink": "#0d0d0c" } }
   ```
   - **Body plans** (`kind`): humanoid, boxbot, owl, mosaic, cube3d.
   - **Drawing styles** (`render`): flat, line, hatch, realistic, hologram, teletext, 3d.
2. **Parts and rig:** the spec compiles into shapes (ellipse, rect, path, grid) on layers (body, head, arm, front), plus a rig: head pivot, eyes, mouth, shoulder.
3. **Actions:** `{ t, dur, do }`, where `do` is speak, blink, nod, look (camera or content), point or emote (smile). A director writes them from a bulletin's timeline; an explainer can script them by hand.
4. **State at t:** `stateAt(actions, t, loudness)` returns `{ mouth, blink, tilt, nod, look, arm, smile, bob }`. Every presenter's `apply(state)` maps that onto its rig.

**Rendering:** SVG and CSS 3D in the browser, with no dependencies. For video, Playwright steps t frame by frame, and ffmpeg joins the PNGs with the voice.

**Limits of version 1:**
- Front view only.
- Mouths follow loudness, not phonemes.
- Six actions, no locomotion.
- Stylised, at a 240 × 320 design size.

## 2. The twelve characters (keep them recognisable)

Every one is an original synthetic character. None is the likeness of a real person.

**At Dinis's word, there is no female figure in this set.** Keep the ids, names and spirit; raise the craft.

| id | Name | What it is | Style today | Notes for version 2 |
|---|---|---|---|---|
| holo | Tejo | Holographic male news presenter, half body, suit and tie | hologram (cyan to blue, scan lines, flicker, glow) | The flagship: volumetric hologram, depth, particles, glitch, a projector base |
| anchor | Duarte | Traditional newsreader, side-parted dark hair, navy suit, red tie, tablet | flat vector | Studio desk, broadcast polish, papers, gestures |
| realist | Rui | The nearest to realism: brown quiff, short beard, grey jumper | shaded (gradients) | The most realistic you can make in code: skin shading, hair strands, eye detail, subtle micro-motion |
| teletext | Ceefax | Teletext block-mosaic face, green hair, cyan face | 2×3 teletext mosaic, 8 colours | Stay true to teletext mosaics (sextants), with block-by-block animation and page-flip effects |
| guide | The Guide | Grey-haired man with glasses, green jumper | hand-drawn, hatched (after storyboards.sgit.ai) | Rough.js-like line boil, cross-hatching |
| agent | The Agent | Box-head robot with an antenna, tunic | hand-drawn, hatched (after storyboards.sgit.ai) | Antenna wobble, screen-face expressions |
| conductor | Conductor | Box-head agent with a clock face, rust body, holds a card | flat (after the book's cover) | The clock hands move as its "eyes"; ZX stripes |
| researcher | Researcher | Box-head agent with glasses and a magnifier | flat (after the book's cover) | Magnifier zoom effect |
| rowan | Rowan | Founder, ginger curly hair and beard, green shirt, tablet | clean line cartoon (after riskmandate.ai's cast) | Thick ink, expressive cartoon acting |
| caretaker | The Caretaker | Helpful white-and-green robot with an "AGENT" badge, a ring of keys | line cartoon (after riskmandate.ai's cast) | Keys that jingle (secondary motion) |
| owl | Mocho | Owl with glasses | flat | Head turn up to about 270°, wing gestures, feather ruffle |
| cube | Cubo | An orange cube with a face | real CSS 3D | Full 3D: roll, bounce, squash and stretch |

**Credits for the borrowed styles:**
- The Guide and The Agent follow https://storyboards.sgit.ai (content CC BY 4.0).
- Conductor and Researcher follow the cover of *One Human, Nine Agents, Nineteen Hours* (https://the-ultimate-insider.book.sgit.ai, CC BY 4.0).
- Rowan and The Caretaker follow RiskMandate's cast (https://riskmandate.ai/stories/cast.json, cast sheet https://riskmandate.ai/stories/images/meet-the-cast.webp).

Draw new versions in those styles, credited. Never trace or copy an image.

## 3. What version 2 must be

Think like a **game designer and a character technical director**. These are game characters with a rig, a move set and states, built so that a bulletin can direct them by data.

### 3.1 High definition

- Design at least 1080 px tall per character, crisp at 4K. Vector or GPU-rendered, never upscaled bitmaps.
- Lighting, shading, rim light, ambient occlusion and soft shadows wherever the style allows. Flat styles stay flat, but with better line quality, weight and polish.
- Secondary motion: hair, ties, antennas, keys, feathers and clothes follow the body with spring physics.

### 3.2 Multiple views

- For every character, a **turnaround**: front, three-quarter left and right, side left and right, and back.
- For 2D styles, draw each view, or build a 2.5D rig that interpolates between views.
- For 3D, turn the camera or the model.
- A **model sheet** page: all twelve, in every view, every expression and key poses, like an animator's model sheet.

### 3.3 A move set (the action language, extended)

Keep version 1's actions and their meaning (speak, blink, nod, look, point, emote). Add at least these:

- **Idle:** breathe, weight shift, fidget (character-specific), occasional look-around.
- **Locomotion:** walk in and out, run, jump (anticipation, airborne, landing, squash and stretch), turn on the spot, a twist or spin, hop, and a crouch to stand.
- **Gestures:** wave, point at a target (any x,y on screen), count on fingers or the equivalent, thumbs up, shrug, open palms, present (sweep an arm towards content), hold up a prop, hands on hips, arms crossed, think (hand to chin).
- **Head:** nod, shake, tilt, look-at with eye leading head leading body, and double-take.
- **Face:** expressions (neutral, smile, laugh, surprised, concerned, sceptical, thinking, delighted), eyebrows, blinks, and **visemes** for lip-sync (at least the Preston Blair or Rhubarb set A to H plus X).
- **Reactions:** celebrate, flinch, laugh, facepalm, a "ta-da" reveal.
- **Character specials:**

  | Character | Special |
  |---|---|
  | Tejo | Glitch, re-materialise, and scan-line sweep |
  | Ceefax | Page flip, and colour cycling |
  | Conductor | Clock spin |
  | Researcher | Magnify |
  | Caretaker | Key jingle |
  | Mocho | 270° head turn, and wing flap |
  | Cubo | Roll over an edge, and bounce |
  | The Agent | Antenna spark |
  | The Guide | Sketch-on, where the lines draw themselves in |

- **Transitions:** blend between any two actions (cross-fade or layered), and layer actions (wave while walking, talk while pointing).

Define the move set as **data**: each action has a name, parameters, a duration (or loop) and the body parts it drives. A director, or a script, calls actions by name.

### 3.4 The contract (non-negotiable)

1. **Deterministic:** frame = f(t). No `Date.now()`, no unseeded randomness, and no physics that depends on the real frame rate. Springs and physics are integrated over a fixed step from t = 0, or solved in closed form, so seeking to any t gives the same frame.
2. **Data-driven:** characters, move set and choreography are JSON (or plain JS objects). Adding a character or an action is data plus, at most, one function.
3. **All in JavaScript:** runs in a browser, renders in headless Chromium, and exports video with Playwright and ffmpeg (1920×1080, 60 fps), as version 1 does.
4. **Third-party libraries are allowed and expected where they help:**
   - Pin each one by exact version.
   - Vendor it (no CDN at runtime; copy the file in with its licence and source URL).
   - List it in `THIRD_PARTY.md` with its licence.
   - Prefer permissive licences (MIT, Apache-2.0, BSD, ISC, CC0). No non-commercial or research-only licences.
   - Good candidates:

     | Library | Use |
     |---|---|
     | three.js | 3D |
     | @pixiv/three-vrm | 3D humanoids |
     | PixiJS | 2D on the GPU |
     | GSAP | timelines; free but not open source: say so if used |
     | Rough.js | the hand-drawn style |
     | Rive runtime, lottie-web | vector animation |
     | Matter.js, or a hand-written spring solver | secondary motion |
     | Rhubarb Lip Sync (offline tool) | visemes |
     | Theatre.js | keyframing |

   - Say why each library was chosen.
5. **Synthetic and labelled:** every frame and every page says "synthetic presenter". No real person's likeness. No female figure in this set. Credit borrowed styles.
6. **Security:**
   - No network at render time.
   - Text set with `textContent`.
   - No `eval` or `new Function`.
   - Pages work under `Content-Security-Policy: default-src 'self'; script-src 'self'` (no inline scripts; WebGL is fine).

## 4. What to deliver

All under `src/lab/presenters/v2-<maker>/`, where `<maker>` is `chatgpt` or `claude`, so the two versions sit side by side and never touch `v1/`:

1. **`index.html`, the showcase:** the "all of them in action" demo. No narration needed: the twelve on one stage, performing a choreographed sequence of 60 to 120 seconds that shows the range:
   - an entrance;
   - idles;
   - a round of gestures;
   - jumps and spins;
   - each character's special;
   - a lip-sync passage, which may use version 1's voice at `/lab/video/200.m4a` with visemes made offline;
   - a group finale.

   It has controls: play and pause, a scrub bar (seek to any t), speed, and a camera or zoom to focus on one character.
2. **`sheet.html`, the model sheet:** each character in every view, expression and key pose, side by side.
3. **`playground.html`:** pick a character and an action, set its parameters, trigger it, and stack actions. Show the current state as live numbers, as version 1's explainer does.
4. **`characters.json`, `moves.json`, `choreography.json`:** the data.
5. **The engine code:** in clear modules (renderer, rig, move set, director or choreographer, timeline, state), with comments that explain why.
6. **`render.mjs`:** exports the showcase to `showcase.mp4` (1920×1080, 60 fps) with Playwright and ffmpeg, frame by frame, deterministic.
7. **`README.md`:**
   - the architecture and how it extends version 1's four layers;
   - how to add a character and an action;
   - how to run it locally (commands, versions);
   - the libraries and their licences;
   - known limits;
   - how long a render took and on what machine.
8. **A short comparison:** what version 2 can do that version 1 could not, in a table.

## 5. How to run it locally (the expected shape)

```
git clone https://github.com/PrompTugal/PrompTugal__News__Bulletins && cd PrompTugal__News__Bulletins
git checkout dev
cd src && python3 -m http.server 8000        # then open http://localhost:8000/lab/presenters/v2-<maker>/
node src/lab/presenters/v2-<maker>/render.mjs # needs Node 20+, Playwright's Chromium, ffmpeg
```

## 6. How it will be judged

Dinis looks at the showcase, the model sheet and the playground. The judging covers:

- **Craft:** is it beautiful and high definition, and does each character keep its identity?
- **Range:** how many actions, views and expressions, and how well do they blend?
- **Life:** timing, spacing, anticipation, follow-through, squash and stretch. The twelve principles of animation, applied.
- **Engineering:** determinism, data-driven design, clean modules, licences, a working video export.
- **Explainability:** could another person or model extend it from the README alone?

Be bold. This is an exploration of how far code-made characters can go.
