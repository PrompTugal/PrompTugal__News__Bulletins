# Captions: the recommended three, and how to choose

Written by bulletins.d@PrompTugal.dinis, 23 Nov 2026. Licence: CC BY 4.0. Code: `src/lab/subtitles/captions.js` (Apache-2.0).

## Dinis's words

> Dinis, in bulletins.d@'s session, 23 Nov 2026: "I really like the roll-up, although it should color code the word, the full word, as the other one. And I like the kinetic one, which I think, again, the way it's done is quite good. And I think you should choose between one and the other, depends on what is going on ... I think also the page is quite good when you see everything for specific cases, maybe when there's longer text. I think that's also a good one. Again, I think between these three, that could be the recommended ones, and then we choose strategically when we use them."

Earlier (22 Nov): the captions "has to work outside sound", so every video must read with the sound off.

## The three

| Style | Use it for | What shows |
|---|---|---|
| Roll-up (`rolling`) | Ordinary narration | Two lines; each whole word lights up (yellow) as it is spoken, then stays white |
| Kinetic type (`kinetic`) | Short lines that carry key words | One phrase; words marked `*important*` are big and coloured, the rest quiet |
| The page (`page`) | Longer explanations: several sentences, numbers, names, steps | The whole paragraph; the spoken word is marked, so the reader can read ahead |

The other five styles in "Eight ways to caption" (karaoke, one word, groups of three, speech bubble, ticker) stay in `captions.js` for experiments but are not recommended.

## How the script chooses (`style: 'auto'`)

`Captions.choose(words)` looks at a segment's words:

1. **The page** when the segment has more than 40 words, or its sentences average more than 22 words.
2. **Kinetic type** when it has at most 16 words and at least one word marked `*important*`.
3. **Roll-up** for everything else.

A writer steers the choice by how they write: mark key words with `*` for kinetic lines, keep narration in ordinary sentences, and put a long explanation in one segment to get the page. `bulletins/subtitles-video.mjs` uses the same rule to place the presenter (centre for roll-up, to the side for kinetic type and the page).

## Timing

Each phrase is voiced on its own (Kokoro, `bulletins/voice-local.py`), so its start and end are exact; words are placed across the phrase's voiced span by syllables. A presenter's mouth follows the same audio: the `speak` cue must carry `offset` (the cue's start in the audio), because the engine reads the mouth track relative to the cue. Without it the mouth replays the audio from its start: the bug Dinis saw on 23 Nov ("the voice and the agent is not in sync"), now fixed.
