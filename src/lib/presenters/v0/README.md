# Presenters library, version 0.1.1

The PrompTugal.news presenters as a library: twelve **synthetic presenters**, built and animated by code in the browser with three.js. Each is an original character, not the likeness of a real person, and each is always labelled "synthetic presenter". There is no female figure in this set, at Dinis's word. Made by bulletins.b@PrompTugal.dinis on 21 November 2026, at Dinis Cruz's word the same day: "Yes, I would like to have the presenter engine as a reusable library using our current library publishing flow". The engine is version 2 (Claude) of the presenter language. It was adopted on 21 November and already draws the day's video bulletin at bulletins.promptugal.news/lab/bulletin-v2/.

Code: Apache-2.0. Text and data: CC BY 4.0. three.js 0.160.1 (`vendor/`): MIT, notice in `vendor/three.LICENSE`.

## Versions and addresses

| Folder | What it holds | Changes? |
|---|---|---|
| `v0.1.1/` | This version (and `v0.1.0/`, the first) | **Never.** The publisher refuses to change a published version |
| `v0.1/` | The newest 0.1.x | Moves to each new 0.1.x |
| `v0/` | The newest 0.x.y | Moves to each new 0.x.y |
| `latest/` | The newest version | Moves to each new version |
| `versions.json` | Every version, its date and its files | Grows |

The base is https://bulletins.promptugal.news/lib/presenters/. A site that ships should use a pinned version, `v0.1.1/`. `latest/` is for trying things out.

**How a site takes it (our library flow, as for the shared map and the sites bar):**
1. Copy the whole version folder into your own site, for example as `/assets/presenters/0.1.1/`. Don't load it from bulletins.promptugal.news.
2. Check every file against the pins listed for this version in the registry (promptugal.news/api/v1/sites.json). Pins are never stored in this repository. Until dev@ lists the pins after security@'s review reads "passed", treat the version as a preview. Use it in the lab, not on a published page.
3. Serve it with `script-src 'self'`. It makes no request outside its own folder, and its data fetches are credential-free.

## Use it

```html
<div id="stage" style="width:640px;height:360px"></div>
<script type="module">
  import { mount } from '/assets/presenters/0.1.1/presenters.js';
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

There are 69 moves in `data/moves.json`, each with its parameters and defaults. Some to start with:
- **Speech and faces:** `speak` (with a track), `expression` (`name`: neutral, smile, laugh, surprised, concerned, sceptical, thinking or delighted), `nod`, `shake`, `look`, `lookAt`, `doubleTake`, `think`.
- **Gestures:** `wave`, `point`, `pointAt`, `count`, `thumbsUp`, `shrug`, `present`, `armsCrossed`, `handsOnHips`, `facepalm`.
- **Big moves:** `celebrate`, `bow`, `jump`, `hop`, `spin`, `walk`, `run`, `turn`, `flinch`, `laugh`, `tada`, `cartoonTake`.
- **Each character's specials:** for example `glitch`, `rematerialise` and `scanSweep` (Tejo), `pageFlip` (Ceefax), `clockSpin` (Conductor), `wingFlap` (Mocho), `rollEdge` (Cubo), `sketchOn` (the hatched pair) and `straightenTie` (Duarte).

`data/choreography.json` is the 114 s showcase written as data (118 cues, 49 camera shots): a worked example of every kind of cue.

## What is in the folder

`presenters.js` (the entry), `engine/` (14 modules), `vendor/` (three.js and its licence), `data/` (characters, moves, choreography, visemes), `index.html` (this page with live examples), `demo.js`, `README.md`, `manifest.json` (name, version, files, licences; no hashes: the pins are in the registry).

## Performance

Measured on a 4-CPU container with no GPU (the same machine as the bulletin): drawing all twelve takes p50 12.3 ms a frame. Taking a screenshot of a frame costs about 0.5 s there, because WebGL is drawn in software. In a normal browser with a GPU, it plays live at 60 frames a second.

## Changes

- **0.1.1 (22 Nov 2026, bulletins.d@PrompTugal.dinis):** a frame no longer depends on the frames drawn before it. A swinging part (an antenna, a tie, a tuft, a key, the cube's jelly) added its spring's lag to the angle the previous frame left, when its joint was not set outright every frame; each spring joint now goes back to its built rotation and scale before the pose is applied (`engine/rig.js`). Before, 704 of 939 frames of the 21 Nov bulletin differed slightly between renders split differently across browsers (46 to 57 dB); now the same t gives the same bytes after any history. Dinis, 22 Nov: "fix that determinism issue". No change to the API.
- **0.1.0 (21 Nov 2026):** first version. The version 2 (Claude) engine as adopted, with The Guide fix of the same day (in the hatched style, faces and hair are shaded flat, so small faces read). Adds `mount()`, name tags above the head, and the fixed label.
