# Synthetic presenter for the video bulletins: tools research (20 November 2026)

Asked by Dinis on 20 Nov 2026 ("what are the services or applications or JS frameworks that we could use here? can you do a research?"), after his reference screenshots of a holographic presenter and "I don't want to use a women figure". Research by a sub-agent of bulletins.b@, from vendor pages, docs and licences read on 20 Nov 2026. Prices and terms change: re-check before anyone signs up. Anything marked unverified was not confirmed from a primary source. Agents do not sign up for paid services; a person does.

## Recommendation (a proposal)

1. **Free, code-based, now.** An original 2D (SVG) or 3D (three.js with @pixiv/three-vrm, both MIT) presenter rendered in our own frames. Mouth shapes from Rhubarb Lip Sync (MIT, CPU, command line: https://github.com/DanielSWolf/rhubarb-lip-sync). Hologram look by our own shader or CSS. Cost 0. It looks stylised, not semi-realistic.
2. **Best quality, hosted.** An image-plus-audio-to-video model, which keeps our checked voice and takes our own original character image: Kling AI Avatar v2 through fal.ai (Standard $0.0562/s, about $1.69 per 30 s: https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard; Pro about $3.45) or Hedra Character-3 (about $1.50 per 30 s at 720p, commercial use included: https://www.hedra.com/models/video/hedra/character-3). Composite the clip into our frames and add the hologram look ourselves.
3. **Hybrid.** Path 1 by default, path 2 for flagship bulletins, with path 1 as the fallback.

## Comparison (30 s, landscape)

| Option | From code | Own audio | Original character | Licence / commercial | Cost per 30 s | GPU |
|---|---|---|---|---|---|---|
| 2D rig + Rhubarb | Yes | Yes | Yes | MIT | 0 | No |
| three.js + VRM / TalkingHead.js | Yes | Yes | Yes (own model) | MIT code; check each avatar's licence | 0 | No (software WebGL) |
| Kling AI Avatar v2 Std (fal) | API | Yes | Yes | fal terms (per model unverified) | $1.69 | Hosted |
| Hedra Character-3 | API, prepaid | Yes | Yes | Commercial use included | $1.50 (720p) | Hosted |
| OmniHuman v1.5 (fal) | API | Yes | Yes | Not stated | $4.80 | Hosted |
| HeyGen Avatar IV (fal) | API | Yes | Yes | HeyGen policy | $3.00 | Hosted |
| InfiniteTalk | API / self-host | Yes | Yes | Apache-2.0 | $6.00 on fal | Yes, if self-hosted |
| EchoMimic v3 | Self-host | Yes | Yes | Apache-2.0 | GPU time | 12 to 16 GB |

## Notes

- **Avoid:**
  - Wav2Lip (commercial use prohibited).
  - InsightFace pretrained models (non-commercial), and anything depending on them, such as parts of Hallo2 and LivePortrait's pipeline.
  - Ready Player Me (closed on 31 Jan 2026).
  - Tavus and Synthesia, which are built around real people's replicas.
  - Runway Act-Two and sync.so, which need a driving video.
- **The character still:**
  - Image models on OpenRouter: google/gemini-3.1-flash-image, google/gemini-3-pro-image, openai/gpt-5-image(-mini). A few cents an image; who owns the output is unverified.
  - One master still: "original synthetic male news presenter, waist-up, not resembling any real person". The hologram styling is done by us.
- **Disclosure:** EU AI Act Article 50 transparency duties apply from 2 Aug 2026 (law-firm summary: https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force). Keep "Synthetic presenter, AI-generated" on screen and in the metadata.
- **Frameworks:** Remotion (free for teams of 3 or fewer, otherwise a $100/month minimum; brings in React and npm), Motion Canvas, Revideo, Theatre.js, GSAP (free but not open source). Verdict: keep our own renderer.
- **Subtitles and timing:**
  - We hold the script, so we only need alignment: WhisperX forced alignment (BSD-2) for word timings; ffmpeg 8's whisper filter is segment-level only.
  - Publish WebVTT captions and chapters beside the MP4.
  - The same timings drive the mouth and the subtitles.
- **Not verified:** HeyGen and D-ID first-party prices; Synthesia API compatibility with own-photo avatars; fal per-model commercial terms; LatentSync and CogVideoX weight licences; image-output rights; Rive editor price; TalkingHead.js under a virtual clock; Colossyan.
