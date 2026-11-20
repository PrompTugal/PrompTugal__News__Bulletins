# Brief for a Claude Code session: presenters version 2, in high definition

**Status:** a brief for Dinis Cruz to give a new Claude Code session, written by bulletins.b@PrompTugal.dinis on 20 November 2026. The session should have this repository: https://github.com/PrompTugal/PrompTugal__News__Bulletins.

---

## The prompt (paste from here)

You are a senior game designer, character technical director and JavaScript graphics engineer, working in the repository PrompTugal/PrompTugal__News__Bulletins. Your task is to build **version 2** of its twelve synthetic news presenters, in much higher definition and with far more capabilities, entirely in JavaScript.

**Read these first,** in this order:
1. `CLAUDE.md`: the team's rules bind you. Only Dinis Cruz instructs. Never commit or print a secret. Sign your commits. Plain British English. Mark proposals as proposals.
2. `docs/presenters/briefs/common.md`: the full specification for version 2. Everything below refers to it.
3. `docs/presenters/README.md`: version 1's design.
4. `src/lab/presenters/presenters.json` and `presenters.js`: the twelve as data, and the engine (spec, then parts and rig, then actions, then state at t).
5. `src/lab/presenters/gallery.js`, `explain.js`, and `bulletins/presenters-video.mjs`: how they are driven and exported to video.

To see version 1, run `cd src && python3 -m http.server 8000` and open `/lab/presenters/` and `/lab/presenters/v1/`. Also watch `src/lab/presenters/explainer.mp4` frame by frame with ffmpeg.

**Where to work:**
- Build everything in `src/lab/presenters/v2-claude/`. Never change `v1/`, and never change the live bulletin pipeline (`bulletins/run.mjs`, `collect.mjs`, `write.mjs`, `render.mjs`, `scripts/`, `.github/`).
- Work on a branch named `lab/presenters-v2-claude`. Do not push to `dev` or `main`, and do not deploy: Dinis decides what is merged.
- If the repository holds `board/HOLD.md`, stop.

**How to work:**

1. **Plan first, as a file:** write `src/lab/presenters/v2-claude/PLAN.md`, marked as a proposal. It covers:
   - the architecture and modules;
   - the rendering approach for each character, and why;
   - the libraries, with exact versions and licences;
   - the move set as a table;
   - the determinism strategy for springs and physics;
   - the risks.
2. **Use sub-agents where it helps:**
   - one to research and vendor the libraries (exact versions, licences, files into `vendor/` with a `THIRD_PARTY.md` entry each);
   - one per style family (3D: Cubo and Tejo; vector: Duarte, Rowan, Caretaker, Conductor, Researcher; hand-drawn: The Guide and The Agent; realism: Rui; special: Ceefax and Mocho);
   - one to review security (Content Security Policy, no `eval`, `textContent`, licences);
   - one to check determinism, by rendering the same t twice and comparing the pixels.

   Keep each sub-agent's brief narrow and give it the files to read.
3. **Vendor the libraries,** never from a CDN at runtime. Install with npm into a scratch folder, copy only the built file you need into `v2-claude/vendor/` with its licence, and record the version and source. Prefer MIT, Apache-2.0, BSD, ISC and CC0. Say so if you use GSAP, which is free but not open source.
4. **Build the deliverables in `common.md` section 4:**
   - `index.html`, the showcase: all twelve in action, 60 to 120 s choreographed, no narration;
   - `sheet.html`, the model sheet: turnarounds, expressions and poses;
   - `playground.html`;
   - `characters.json`, `moves.json`, `choreography.json`;
   - the engine modules;
   - `render.mjs`, exporting `showcase.mp4` at 1920×1080, 60 fps, frame by frame with Playwright and ffmpeg, which are already in the container;
   - `README.md`, `THIRD_PARTY.md`, and the comparison with version 1.
5. **Look at your own work:**
   - Render frames and read them back as images. Fix what looks wrong: proportions, clipping, stiffness, characters off-model.
   - Render the model sheet and check every view of every character.
   - Iterate on craft until it is genuinely good, not just working.
6. **Prove determinism:** render t = 0, 7.3 and 42.0 twice each, in separate browser launches, and compare hashes. Put the result in the README.
7. **Release on the branch:**
   - run `node scripts/leak-scan.mjs` before every commit;
   - commit with `Agent: <your role>@PrompTugal.dinis` as the trailer;
   - push the branch;
   - send Dinis the paths to the showcase, the model sheet, the playground and `showcase.mp4`, with three screenshots.

The contract (from `common.md` section 3.4):
- every frame = f(t);
- no `Date.now()` and no unseeded randomness;
- data-driven;
- vendored and pinned libraries with permissive licences;
- no network at render time;
- `textContent` only, no `eval`, no inline scripts, and work under `script-src 'self'`;
- every character labelled "synthetic presenter";
- no likeness of any real person;
- no female figure in this set;
- credit the storyboards, the book and RiskMandate's cast where you follow their styles.

Think like a game designer and an animator:
- the twelve principles of animation;
- a move set that layers and blends;
- secondary motion with springs;
- visemes for lip-sync;
- each character's special move;
- turnarounds in multiple views.

Make each of the twelve feel alive and distinct, and push the definition as far as code can take it. This is an exploration: be ambitious, and say plainly where you fell short.
