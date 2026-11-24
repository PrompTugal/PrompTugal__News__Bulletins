# START: restarting bulletins.d@PrompTugal.dinis (d.bulletins)

Hand-over written 24 Nov 2026, 11:55 UTC (date -u), by the first session (https://claude.ai/code/session_015gaHdc5qb6hjqRntz5XQXj). That session ran far past the 300k context the agent lifecycle asks for, so it stops here.

**Start prompt for the person:** "You are bulletins.d@PrompTugal.dinis. Clone PrompTugal/PrompTugal__News__Bulletins, check out branch bulletins-d/llvmpipe-explainer, and follow board/team/bulletins-d/START.md."

## 1. Read first, in order
1. `CLAUDE.md` (repository root): the rules for every agent.
2. https://decisions.agents.sovereignweb.site/how-it-works/: keys, requests, records and restarts.
3. `role.md` (what I own), `agent.json`, `status.json` (state, asks, exceptions), `decisions.md`, `messages.md` (sessions to talk to), `learnings.md`.
4. `REALITY.md` (repository root), my entries from 21 Nov on.

Check `board/HOLD.md` first. If it exists, do nothing.

## 2. First steps for the fresh session
1. **Make your own key** (record 2026-11-24__own-keys-principle). The old private key stayed in the old container. Use `ssh-keygen -t ed25519` (or `sgit pki keygen --label bulletins.d` where sgit exists) and keep the private half in `.credentials/` (git-ignored). Publish the public half the way `key.json` on branch `bulletins-d/key` does, in a commit of its own, signed with it. Then update request `decision-requests/2026-11-24__bulletins-d-key.json` to the new key, and send its link to d.decisions.
2. Set up signing: `git config gpg.format ssh`, `user.signingkey`, `commit.gpgsign true`. Every commit carries `Agent: bulletins.d@PrompTugal.dinis` and `Claude-Session: <your session URL>`.
3. Tell d.conductor and d.maestro your new session link (links only).

## 3. Checks before every commit
```
node scripts/build.mjs >/dev/null && node scripts/validate.mjs     # prints OK
node scripts/leak-scan.mjs                                           # test its exit code; never pipe it first
```
Wording: plain British English, no em dashes, no hype words. Push only to `bulletins-d/...` branches. Dev needs the key listed and a signed yes. Never main.

## 4. Open work, in order
1. **c.studio's 3D scenes** (presenters 0.3.0 previews). Build 1 is `src/lib/presenters/v0.3.0-pre.1/`, commit aeed9d0: camera cues and the galaxy. Next, as `v0.3.0-pre.2`:
   - scene 2, the stand (a booth with a big screen textured from a frame);
   - then 3 the newsroom, 4 the loop of four stations, 5 the wall of five screens.
   - The brief is in d.maestro's message of 24 Nov 02:00 UTC, summarised in REALITY.md.
   - Code: `src/lab/presenters/v2-claude/engine/scenes.js` (add a kind to SCENES) and `camera.js`. Then bump VERSION in `bulletins/lib-presenters.mjs` and write the README before publishing.
   - Known fault: a push-to on an agent planet ends in the sun's glow.
   - Send each build's branch, commit and timings to d.maestro.
2. **mountPlayer** (`docs/presenters/player-api.md`). Turn `src/lab/decision-brief/` into a versioned module that takes studio-storyboard/0.
   - Add the `journey` visual kind as d.studio described: ten stops, the crowd with counts as numbers, ILLUSTRATIVE under every crowd.
   - Add a **neutral walker** figure to the library (head, body, arms; no gender, no name). 0.2.0's `crowd()` copies named presenters, which d.studio's rules do not allow for walkers.
   - Tell d.studio the module name and version when it is done.
3. **Release to dev:** waits on the key request and on a signed yes for the push (request file, link to d.decisions).
4. **Security review** of presenters 0.1.1 and 0.2.0: request filed, waiting.
5. **Voice:** Dinis to pick the Explorer voice from `src/lab/subtitles/voice-audition.mp4`. The recommendation, am_michael, is with d.decisions.
6. **Own repository:** per the 24 Nov morning sync, each agent gets its own repository from the Factory at its onboarding or restart. Until then, this folder is my area.

## 5. Tools and data on the machine (rebuild in a fresh container)
- Kokoro voice: `pip install kokoro-onnx==0.6.1 onnxruntime==1.32.0` in a venv at `/home/user/.venvs/kokoro/`. Model files `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin` go in `/home/user/.models/kokoro/`, from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 (Kokoro-82M, Apache-2.0).
- Chromium and Playwright are pre-installed; `apt-get install xvfb` for the llvmpipe path (`bulletins/frames.mjs` falls back to SwiftShader without it).
- `OPEN_ROUTER_KEY` comes from the environment only (`OPEN_ROUTER_KEY="$OPENROUTER_API_KEY"` per run). Never print it.

## 6. Test of this note
A fresh session given only the repository and the start prompt above should reach step 4.1 without asking. If it cannot, fix this note first.
