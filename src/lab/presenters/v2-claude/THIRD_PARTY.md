# Third-party software: presenters version 2 (Claude)

Written by presenters.v2-claude@PrompTugal.dinis on 20 November 2026. Every number here was read from the file or the tool itself in that session.

## Shipped with the pages (vendored, no CDN at run time)

| Library | Version | Licence | File here | Size | Source |
|---|---|---|---|---|---|
| three.js | 0.160.1 | MIT | `vendor/three.module.min.js`, licence in `vendor/three.LICENSE` | 670,681 bytes | npm package `three`, file `build/three.module.min.js` (https://github.com/mrdoob/three.js) |

How it was fetched:

```
mkdir scratch && cd scratch && npm init -y && npm install three@0.160.1
cp node_modules/three/build/three.module.min.js ../src/lab/presenters/v2-claude/vendor/
cp node_modules/three/LICENSE ../src/lab/presenters/v2-claude/vendor/three.LICENSE
```

The file is not pinned by hash here: the repository's leak scan reads a SHA-256 as a possible secret, and an exemption in `scripts/leak-scan.mjs` is the team's decision, not this folder's. To check the file, run `sha256sum vendor/three.module.min.js` and compare it with the same file from a fresh `npm install three@0.160.1`.

**Checked on adoption (bulletins.b@PrompTugal.dinis, 21 Nov 2026):** `vendor/three.module.min.js` and `vendor/three.LICENSE` are byte for byte the same as `package/build/three.module.min.js` and `package/LICENSE` in the npm tarball https://registry.npmjs.org/three/-/three-0.160.1.tgz (compared by SHA-256, not written here for the leak scan's sake). The pin stays by version, with that check repeatable by anyone.

Why three.js: it is the most widely used WebGL library, it ships as one ES module that needs no build step, and it runs under `script-src 'self'` (the file holds no `eval` and no `new Function`; both were searched for). It is the only library the pages load.

## Used offline only (not shipped)

| Tool | Version | Licence | Use | Source |
|---|---|---|---|---|
| Rhubarb Lip Sync | 1.13.0 | MIT | Turned version 1's voice (`src/lab/video/200.m4a`, converted to WAV with ffmpeg) and the bulletin's own script into the mouth cues in `visemes.json` | https://github.com/DanielSWolf/rhubarb-lip-sync, release `Rhubarb-Lip-Sync-1.13.0-Linux.zip` |
| Playwright | 1.63.0 | Apache-2.0 | Steps t and photographs each frame (`render.mjs`, `tools/`) | npm package `playwright` |
| ffmpeg | 6.1.1 | LGPL/GPL build, used as a tool | Joins frames and voice into the MP4 | the container's package |

The Rhubarb command (proposal for a `bulletins/` step, not wired into the pipeline):

```
ffmpeg -i src/lab/video/200.m4a voice.wav
rhubarb -f json -d dialog.txt -o voice200.rhubarb.json voice.wav     # dialog.txt holds the spoken script
```

## Looked at and not used

- **GSAP:** free but not open source; the timeline here is already a pure function of t.
- **Rough.js:** 2D canvas and SVG only; the hand-drawn style is a shader on a 3D model.
- **Matter.js:** a physics world advances with real time; the springs here are a few lines on a fixed grid and can be reached by a seek.
- **@pixiv/three-vrm, Rive, lottie-web, Theatre.js, PixiJS:** each needs authored assets or a second renderer; these characters are built by code.

## Styles followed (new models, never traces or copies)

- The Guide and The Agent: after https://storyboards.sgit.ai (content CC BY 4.0).
- Conductor and Researcher: after the cover of *One Human, Nine Agents, Nineteen Hours* by Dinis Cruz (https://the-ultimate-insider.book.sgit.ai, CC BY 4.0).
- Rowan and The Caretaker: after RiskMandate's cast (https://riskmandate.ai/stories/cast.json).
- The voice: version 1's, OpenRouter's `openai/gpt-audio-mini`, stock voice "alloy". Synthetic, and labelled so.

I did not open those three sites in this session. The models follow version 1's own drawings of those styles and the brief's descriptions.
