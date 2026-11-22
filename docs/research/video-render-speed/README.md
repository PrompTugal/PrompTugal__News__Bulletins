# Faster bulletin videos: measurements of 22 November 2026

By bulletins.d@PrompTugal.dinis, at Dinis's word (22 Nov 2026): "go ahead with the screenshot measurements ... can you really do a research here, since there has to be faster ways to create those videos ... for example can you try record a browser window". The write-up with charts is a Claude doc shared with Dinis; this folder holds the tools and the raw results so anyone can re-run them.

Machine: 4 CPUs (Intel Xeon 2.10 GHz), 15.7 GB, no GPU; Chromium 157 (Playwright 1.63), Mesa 25.2.8 llvmpipe (LLVM 20.1.2), ffmpeg 6. All numbers below measured on it by bulletins.d@ on 22 Nov 2026, except "today", from `src/lab/bulletin-v2/stats-2026-11-21.json`.

## The finding in one line

The screenshot waits for Chromium's software WebGL (SwiftShader) to draw about 645,000 triangles with 4x MSAA. Drawing WebGL with Mesa llvmpipe instead, with four browsers, makes the 31.3 s bulletin in 127.5 s in place of 396 s (3.1x), with no visible change. Recording the screen in real time does not help without a GPU: the page draws only 1.9 (SwiftShader) to 5.6 (llvmpipe) frames a second.

## The whole bulletin, 939 frames (`full.mjs`)

| Run | Render (s) | Encode (s) | Total (s) | Speed-up |
|---|---|---|---|---|
| Today: SwiftShader, 3 browsers, Playwright PNG (21 Nov stats) | 386.1 | 9.8 | 396.0 | 1.0x |
| SwiftShader, 4 browsers, CDP PNG | 296.8 | 9.7 | 306.5 | 1.3x |
| llvmpipe, 1 browser | 226.5 | 10.1 | 236.6 | 1.7x |
| llvmpipe, 2 browsers | 146.3 | 9.3 | 155.6 | 2.5x |
| llvmpipe, 3 browsers | 124.8 | 9.1 | 133.9 | 3.0x |
| llvmpipe, 4 browsers (dark colour scheme, the candidate) | 118.3 | 9.2 | 127.5 | 3.1x |
| llvmpipe, 4 browsers, lower geometry detail | 102.7 | 10.2 | 112.9 | 3.5x |

Quality of the candidate against the committed video: the 3D half SSIM 0.986, PSNR 34.8 dB (llvmpipe rasterises edges slightly differently); the left half SSIM 0.997, PSNR 47.1 dB. See `results/side-by-side-15s.png`.

## Determinism

Runs with the same split of frames give byte-identical frames (0 of 939 differ). Runs with different splits differ in 704 of 939 frames, from the first frame a fresh browser draws: a few hundred pixels a frame, 57 dB mean, 46 dB worst (`results/psnr-llvmpipe-1-vs-4-browsers.txt`). SwiftShader shows the same. A frame therefore depends slightly on the frames drawn before it in the same page; `src/lab/presenters/v2-claude/tools/determinism.mjs` draws one frame per fresh browser and so does not see this. Likely cause, unconfirmed: the springs' checkpoints (`engine/springs.js`).

## The tools

- `probe.mjs`: screenshot time with and without a new frame, and the WebGL renderer in use.
- `info.mjs`: draw calls and triangles per frame (three.js `renderer.info`).
- `bench.mjs`: one method on every 10th frame (94 frames); results in `results/sample-*.json`.
- `full.mjs`: the whole bulletin with N browsers, then ffmpeg.
- `rt.mjs`: real-time playback on Xvfb, optionally recorded with ffmpeg `x11grab`.

Run from the repository root after `python3 -m http.server 8797 --bind 127.0.0.1` in `src/`. For llvmpipe: `HEADED=1 CHROME_ARGS="--use-gl=angle --use-angle=gl --ignore-gpu-blocklist" xvfb-run -a -s "-screen 0 1920x1080x24" node docs/research/video-render-speed/full.mjs 4 /tmp/out` (not `ARGS`: xvfb-run uses that name itself).

Code: Apache-2.0. Text and images: CC BY 4.0. Images show synthetic presenters, made by code, no real person.
