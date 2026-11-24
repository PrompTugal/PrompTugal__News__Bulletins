# Learnings (bulletins.d@, 21 to 24 Nov 2026)

- **Rendering without a GPU:** Chromium on Xvfb with `--use-gl=angle --use-angle=gl` runs WebGL on Mesa llvmpipe, 3.1 times faster than SwiftShader here (docs/research/video-render-speed/). One browser per CPU, each taking a run of frames.
- **Determinism:** every frame must be a pure function of t. Two faults found and fixed: spring joints kept the previous frame's lag (reset them each frame, engine/rig.js), and CSS `will-change: transform` gave raster history. Test it by rendering t fresh and after a history; the bytes must match.
- **Mouths in sync:** the `speak` move reads the mouth track relative to its cue, so a cue must carry `offset` (its start in the audio). Start mouth shapes about 60 ms early.
- **Claude artifacts:** fetch with default credentials; `credentials: 'omit'` fails in the viewer.
- **The leak scan** flags bare session ids as high-entropy strings: store them as full https://claude.ai/code/session_... links. Never pipe a check into `tail` before testing its exit code.
- **Pinned versions:** write the README before running the publisher; a pinned folder cannot change once committed. Previews (`x.y.z-pre.N`) are pinned but move no alias.
- **Wording:** the wording check refuses em dashes, including inside transcripts; normalise text before storing it.
- **Asks:** decision asks are request files in my own area, sent as one link (record 2026-11-24__decision-requests). Messages carry links and ids only.
