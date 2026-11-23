# The decision-brief player as an API: plan

Written by bulletins.d@PrompTugal.dinis, 23 Nov 2026. Licence: CC BY 4.0. A proposal; not built yet.

## Dinis's words

> Dinis, in bulletins.d@'s session, 23 Nov 2026: "the studio should not take over the player, and you should treat it as a normal APIs that we do."

## The split (agreed with studio.d@AgentiCCells.dinis, 23 Nov 05:01 UTC)

- **bulletins.d@ owns:** the player (`src/lab/decision-brief/`), the presenters library, video rendering, the Kokoro voice, caption timing.
- **studio.d@ owns:** the storyboard format, its checker and the pictures; it calls the player.

## Input: studio-storyboard/0 (studio.d's summary, 23 Nov)

Full text: PrompTugal__News__Website `board/team/studio.d/storyboard-format/README.md` (with `check.mjs` and `example.storyboard.json`), which bulletins.d@ has not read.

- **Top level:** `format`, `slug`, `title`, `audience`, `requested_by`, `presenter` (optional id), `summary`, `beats[]`, `decision` (one) or `decisions[]`, `connections {asked_by, reviewed_by[], acts[], follows[]}`, `sources[{id, title, url, read}]`.
- **Decision:** `question`, `options[{id, label, good[], bad[], blocks[]}]`, `recommendation`, `why`, `ask {id, text_sha256, asked_by, session, first_seen, reserved, answer}`, `answer {option?, status, at, where, words, note}` (filled only from Dinis's own words, verbatim).
- **Beat:** `id`, `narration` (the subtitle, under 60 words), `visual`, `facts[]` (source ids), `seconds` (optional), `note` (never shown), `caption`.
- **Visual kinds:** `title`, `stat`, `bars`, `timeline`, `flow`, `compare`, `list`, `image`, `svg` (inline animated SVG: seek to `at`, play `play` seconds), `journey` (walkers start, here, fell, through; `basis` illustrative or measured; site; sherpa).
- **Rules the player keeps:** subtitles always; presenter small, synthetic and labelled; the decision shown only when the story reaches it; a crowd labelled ILLUSTRATIVE unless measured; no private person.

## Output: the API (proposal)

- A versioned module beside the presenters library, for example `lib/player/` published as `src/lib/player/v0.1.0/`, with the same rules: pinned versions never change, `latest/` moves, security@ reviews, dev@ lists the pins.
- `mountPlayer(element, storyboard, options)` returns a player with `play()`, `pause()`, `seek(t)`, `back()`, `forward()` (the touch points: each beat's start and end), `t`, `duration`, and an `onAnswer` callback; answers go to the host page's store (the claude.ai artifact db today; an sgit vault append lane sealed to the asking agent later).
- The current page's scenes (`briefing.js`) become visual kinds; studio.d's kinds are added one by one, with `journey` waiting on presenters 0.2.0 (fall, rope, pull-up, crowds).
