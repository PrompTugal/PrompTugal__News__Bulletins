# Video tiers: Explorer and Publish

Written by bulletins.d@PrompTugal.dinis, 22 Nov 2026. Licence: CC BY 4.0.

## Dinis's words

> Dinis, in bulletins.d@'s session, 22 Nov 2026, about 11:30 UTC: "use open source models for the initial voice generation. In fact, here's what I'm thinking. Why don't we use what we have right now as what we can call the Explorer kind of videos and the first pass of it, and then we'll put something later on for, let's say, for the videos that we want to publish, for example, on social media, where we do another pass. Maybe we even do a pass of just sharpening up and improving the quality a little bit of the rendering, and also, you know, maybe doing a quality pass. But we distinguish what I want to start doing now, which is tons and tons and tons of these videos, to be a place where we now also, you know, choose some to publish in social media."

## The two tiers

| | Explorer (now) | Publish (later, a proposal) |
|---|---|---|
| Purpose | Many videos, fast and free, to explore formats and ideas | The few chosen from the Explorer set for social media |
| Voice | Kokoro-82M on our CPU (Apache-2.0), one take per phrase; free | A second pass: the best voice we have (open source or a paid stock voice), after a listening check |
| Render | 1280 x 720, 30 fps, llvmpipe, 4 browsers (bulletins/frames.mjs) | Sharper: for example 1920 x 1080, or drawn at twice the size and scaled down (supersampling); vertical 1080 x 1920 for phones |
| Captions | Timed from the voice, phrase by phrase | The same timing, the chosen style, a check that every caption matches the voice |
| Checks | The release checks; labels on every frame | A quality pass: a person (or an agent with a checklist) watches it with and without sound, checks facts, labels, captions, loudness and the first frame |
| Cost | 0 USD for the voice; render time only | Small, and only for the chosen videos |
| Where | The lab (bulletins.promptugal.news/lab/) | Social media, by a person: agents draft, people post (CLAUDE.md) |

## What exists now (22 Nov 2026)

- Explorer voice: `bulletins/voice-local.py` (Kokoro-82M v1.0, int8 ONNX, through kokoro-onnx 0.6.1 and onnxruntime 1.32.0; voice `bm_george`). The model files live outside the repository (`/home/user/.models/kokoro/`), downloaded from the kokoro-onnx model release; the Python packages in `/home/user/.venvs/kokoro/`.
- First Explorer video: "Eight ways to caption" (`bulletins/subtitles-video.mjs`, `src/lab/subtitles/`).
- Earlier videos (the bulletin, "How this video is made") used OpenRouter's stock voice; they can move to the Explorer voice.

## Open questions for Dinis

- Kokoro's voices are stock voice packs. Kokoro's model card says it was trained on permissively licensed and synthetic audio; the source of each voice pack is not documented per voice. Our rule is "never a clone of a real person's voice": is a documented stock voice pack acceptable for Explorer videos?
- Which Publish improvements first: higher resolution, supersampling, vertical format, or the quality checklist?
