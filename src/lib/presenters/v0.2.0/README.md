# Presenters library, version 0.2.0

The PrompTugal.news presenters as a library: twelve **synthetic presenters**, built and animated by code in the browser with three.js. Each is an original character, not the likeness of a real person, and each is always labelled "synthetic presenter". There is no female figure in this set, at Dinis's word. Made by bulletins.b@PrompTugal.dinis on 21 November 2026, at Dinis Cruz's word the same day: "Yes, I would like to have the presenter engine as a reusable library using our current library publishing flow". The engine is version 2 (Claude) of the presenter language. It was adopted on 21 November and already draws the day's video bulletin at bulletins.promptugal.news/lab/bulletin-v2/.

Code: Apache-2.0. Text and data: CC BY 4.0. three.js 0.160.1 (`vendor/`): MIT, notice in `vendor/three.LICENSE`.

## Versions and addresses

| Folder | What it holds | Changes? |
|---|---|---|
| `v0.2.0/` | This version (and `v0.1.1/`, `v0.1.0/` before it) | **Never.** The publisher refuses to change a published version |
| `v0.2/` | The newest 0.2.x | Moves to each new 0.2.x |
| `v0.1/` | The newest 0.1.x (0.1.1) | Moves to each new 0.1.x |
| `v0/` | The newest 0.x.y | Moves to each new 0.x.y |
| `latest/` | The newest version | Moves to each new version |
| `versions.json` | Every version, its date and its files | Grows |

The base is https://bulletins.promptugal.news/lib/presenters/. A site that ships should use a pinned version, `v0.2.0/`. `latest/` is for trying things out.

**How a site takes it (our library flow, as for the shared map and the sites bar):**
1. Copy the whole version folder into your own site, for example as `/assets/presenters/0.2.0/`. Don't load it from bulletins.promptugal.news.
2. Check every file against the pins listed for this version in the registry (promptugal.news/api/v1/sites.json). Pins are never stored in this repository. Until dev@ lists the pins after security@'s review reads "passed", treat the version as a preview. Use it in the lab, not on a published page.
3. Serve it with `script-src 'self'`. It makes no request outside its own folder, and its data fetches are credential-free.

## Use it

```html
<div id="stage" style="width:640px;height:360px"></div>
<script type="module">
  import { mount } from '/assets/presenters/0.2.0/presenters.js';
  const show = await mount(document.getElementById('stage'), {
    presenters: ['anchor', 'holo', 'owl'],
    duration: 8,
    cues: [{ t: 0.5, who: 'anchor', do: 'wave' }, { t: 2, who: 'all', do: 'nod', stagger: 0.1 }],
  });
  show.play();
</script>
```

That is all the code a site needs. `mount` makes the canvas, the name tags and the label inside your element, and takes the element's size.

### `mount(element, options)` returns a show

| Option | Meaning | Default |
|---|---|---|
| `presenters` | ids to put on stage, in order | all twelve |
| `slots` | `{ id: [x, z] }` positions on the floor (z from -3.4 to -1.25 stands on the riser) | each character's own |
| `cues` | `[{ t, who, do, ...params, stagger }]`. `who` is an id, a list, `'all'` or a group; `do` is a move | none |
| `camera` | shots, `{ t, pos, look, fov, ease }` or `{ t, focus, dist, h, lh, orbit, cut, only }` | one wide shot |
| `beats` | `[{ t, title }]`, a caption in the corner | none |
| `groups` | `{ name: [ids] }` for `who` | `all` |
| `duration` | seconds | 10 |
| `tracks` | `{ name: { mouthCues: [{ start, end, value }] } }`, mouth shapes A to H and X (Rhubarb's), for `speak` | none |
| `audio` | a URL to play with the show; the show then follows the audio's clock | none |
| `tags` | name tags above each head | `true` |
| `background`, `auto` | stage colour; automatic `{ idle, blink, fidget }` | `'#060914'`; idle and blink |

The corner label "*n* synthetic presenters · made by code, no real person" is always drawn and cannot be turned off.

The show: `play()`, `pause()`, `seek(t)`, `renderAt(t)` (one exact frame; every frame is a pure function of t, so the same t always gives the same picture), `t`, `duration`, `playing`, `resize()`, `destroy()`, and `stage`, `director` and `data` for advanced use.

Also exported: `loadData()` (the four data files), `Stage`, `Director`, `CH` (the pose channels), `VERSION` and `LABEL`.

### Journeys: falls, ropes and crowds (0.2.0)

Made for sherpa.d@AgentiCCells.dinis's journey stories. sherpa.d, 22 Nov 2026, relaying Dinis: "the Sherpa's journeys as fun animated stories: a crowd of walkers that climbs a path, falls into a ravine, is helped over with a rope and gets to the summit". Every figure keeps its full detail; there is no low-detail crowd (Dinis ruled out lower detail on 22 Nov).

```js
import { mount, crowd } from '/assets/presenters/0.2.0/presenters.js';
const show = await mount(el, {
  ...crowd({ of: ['agent', 'holo', 'guide', 'caretaker'], n: 20, area: [-4.5, -1, 4.5, 3], seed: 1 }),
  flat: true, tags: false, duration: 12,
  cues: [{ t: 0.2, who: 'crowd', do: 'walk', by: [1, 0], stagger: 0.05 }, { t: 3.5, who: 'agent~5', do: 'fall', dur: 4 }],
  props: [{ kind: 'rope', keys: [{ t: 0, mode: 'coil', on: 'holo~2' }, { t: 5, mode: 'line', ends: ['holo~2.hands', 'agent~5.hands'], length: 2.4 }] }],
});
```

- **Crowds:** `crowd({ of, n, area, seed })` makes up to 40 copies, named `id~1`, `id~2` and so on, spread over `area` ([x0, z0, x1, z1]) from the seed, so the same call gives the same crowd. It returns `{ presenters, slots, groups: { crowd } }`; a cue may say `who: 'crowd'`. Any id may also be given as `id~n` by hand. Each copy blinks and fidgets on its own. A page that shows a crowd must label it ILLUSTRATIVE unless the number is measured.
- **New moves:** `fall` (trip, fall, lie, and get up in the last 1.3 s; `dir` forward or back; `up: false` stays down; give `dur`), `pullUp` (reach up and pull the body up `times` times; the hands stay where they grip), `carry` (one hand grips a coil's strap at the chest; cue it at or after a walk begins, as a later move wins on the arm) and `hold` (both hands grip a rope and lean back on it; `haul` pulls it in).
- **The rope prop:** `props: [{ kind: 'rope', keys }]`. The last key at or before t says what it does: `coil` over a shoulder (`on: 'id'`), `hand` (a coil carried in one hand, `on: 'id.L'`), `line` between two `ends` (a stage point [x, y, z], or a grip: `'id.L'`, `'id.R'` or `'id.hands'`) with a `length` that makes it sag, `hang` straight down `from` a point, or `none`. The rope follows the hands of the same frame, so a frame is still a function of t alone.
- **Stage options:** `flat: true` puts everyone on the floor (no one stands on the riser); `set: false` draws no floor, riser or wall.

Measured on the 4-CPU container with no GPU (software WebGL, headless): twenty figures at full detail draw in 16 to 47 ms a frame; four figures with three ropes in 10 to 19 ms. The same t gives the same bytes after any history, with ropes and with a crowd (checked at three times).

### The twelve

| id | Name | Style |
|---|---|---|
| `holo` | Tejo | hologram |
| `anchor` | Duarte | flat, newsreader |
| `realist` | Rui | nearer realism |
| `teletext` | Ceefax | teletext blocks |
| `guide` | The Guide | hatched (after storyboards.sgit.ai) |
| `agent` | The Agent | hatched robot (after storyboards.sgit.ai) |
| `conductor` | Conductor | flat robot (after the-ultimate-insider.book.sgit.ai) |
| `researcher` | Researcher | flat robot (after the book) |
| `rowan` | Rowan | line (after riskmandate.ai's cast) |
| `caretaker` | The Caretaker | line robot (after riskmandate.ai's cast) |
| `owl` | Mocho | flat owl |
| `cube` | Cubo | 3D cube |

The styles after the storyboards, the book and RiskMandate are new models made in those styles and credited; they are not copies.

### The moves

There are 73 moves in `data/moves.json`, each with its parameters and defaults. Some to start with:
- **Speech and faces:** `speak` (with a track), `expression` (`name`: neutral, smile, laugh, surprised, concerned, sceptical, thinking or delighted), `nod`, `shake`, `look`, `lookAt`, `doubleTake`, `think`.
- **Gestures:** `wave`, `point`, `pointAt`, `count`, `thumbsUp`, `shrug`, `present`, `armsCrossed`, `handsOnHips`, `facepalm`.
- **Journeys (0.2.0):** `fall`, `pullUp`, `carry`, `hold`.
- **Big moves:** `celebrate`, `bow`, `jump`, `hop`, `spin`, `walk`, `run`, `turn`, `flinch`, `laugh`, `tada`, `cartoonTake`.
- **Each character's specials:** for example `glitch`, `rematerialise` and `scanSweep` (Tejo), `pageFlip` (Ceefax), `clockSpin` (Conductor), `wingFlap` (Mocho), `rollEdge` (Cubo), `sketchOn` (the hatched pair) and `straightenTie` (Duarte).

`data/choreography.json` is the 114 s showcase written as data (118 cues, 49 camera shots): a worked example of every kind of cue.

## What is in the folder

`presenters.js` (the entry), `engine/` (15 modules), `vendor/` (three.js and its licence), `data/` (characters, moves, choreography, visemes), `index.html` (this page with live examples), `demo.js`, `README.md`, `manifest.json` (name, version, files, licences; no hashes: the pins are in the registry).

## Performance

Measured on a 4-CPU container with no GPU (the same machine as the bulletin): drawing all twelve takes p50 12.3 ms a frame. Taking a screenshot of a frame costs about 0.5 s there, because WebGL is drawn in software. In a normal browser with a GPU, it plays live at 60 frames a second.

## Changes

- **0.2.0 (23 Nov 2026, bulletins.d@PrompTugal.dinis):** journeys, for sherpa.d's stories. Four moves (`fall`, `pullUp`, `carry`, `hold`), a rope prop (`engine/props.js`, the `props` option), crowds of copies (`crowd()`, ids `id~n`) and the `flat` and `set` options. The stage poses a character a prop needs even when the camera cannot see it, so a rope never reads an old frame's hands. Nothing in 0.1.x changes meaning; a page on 0.1.1 that moves to 0.2.0 draws the same frames.
- **0.1.1 (22 Nov 2026, bulletins.d@PrompTugal.dinis):** a frame no longer depends on the frames drawn before it. A swinging part (an antenna, a tie, a tuft, a key, the cube's jelly) added its spring's lag to the angle the previous frame left, when its joint was not set outright every frame; each spring joint now goes back to its built rotation and scale before the pose is applied (`engine/rig.js`). Before, 704 of 939 frames of the 21 Nov bulletin differed slightly between renders split differently across browsers (46 to 57 dB); now the same t gives the same bytes after any history. Dinis, 22 Nov: "fix that determinism issue". No change to the API.
- **0.1.0 (21 Nov 2026):** first version. The version 2 (Claude) engine as adopted, with The Guide fix of the same day (in the hatched style, faces and hair are shaded flat, so small faces read). Adds `mount()`, name tags above the head, and the fixed label.
