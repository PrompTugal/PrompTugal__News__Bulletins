# Brief for ChatGPT: presenters version 2, in high definition

**Status:** a brief for Dinis Cruz to paste into ChatGPT, written by bulletins.b@PrompTugal.dinis on 20 November 2026.

**Before you paste:** attach these files from https://github.com/PrompTugal/PrompTugal__News__Bulletins (branch `dev`), or let ChatGPT fetch them if it can browse:
- `docs/presenters/briefs/common.md` (required: everything below refers to it);
- `docs/presenters/README.md`;
- `src/lab/presenters/presenters.json`;
- `src/lab/presenters/presenters.js`.

Pictures help too: the cast sheet https://riskmandate.ai/stories/images/meet-the-cast.webp, a frame of https://bulletins.promptugal.news/lab/presenters/presenters.mp4, and the book's cover at https://the-ultimate-insider.book.sgit.ai/assets/cover-a.svg.

---

## The prompt (paste from here)

You are a senior game designer, character technical director and JavaScript graphics engineer. Your task is to build **version 2** of a set of twelve synthetic news presenters, in much higher definition and with far more capabilities, entirely in JavaScript.

Read the attached `common.md` first. It is the full specification:
- what version 1 is (spec, then parts and rig, then actions, then state at t, with every frame a pure function of time);
- the twelve characters you must keep recognisable;
- what version 2 must add (high definition, turnarounds in multiple views, a large move set designed like a game character's, secondary motion, visemes, character specials);
- the non-negotiable contract (deterministic, data-driven, vendored and pinned libraries with permissive licences, synthetic and labelled, no real person's likeness, no female figure in this set, strict Content Security Policy);
- the deliverables, and how it will be judged.

Use the attached `presenters.json` and `presenters.js` to see exactly how version 1 works. Keep its four layers and extend them; do not throw the idea away.

Work like this:

1. **Plan first, in one message.** Give:
   - the architecture (modules and how data flows);
   - the rendering approach for each of the twelve, and why (for example three.js for Cubo and Tejo, PixiJS or SVG for the flat and line styles, Rough.js for the hand-drawn ones);
   - the libraries, with exact versions and licences;
   - the move set as a table;
   - how determinism is kept with springs and physics.
2. **Then write every file in full,** ready to drop into `src/lab/presenters/v2-chatgpt/`:
   - `index.html`, the showcase: all twelve in action, 60 to 120 s choreographed, with controls and scrubbing;
   - `sheet.html`, the model sheet;
   - `playground.html`;
   - `characters.json`, `moves.json`, `choreography.json`;
   - the engine modules;
   - `render.mjs`, the deterministic export to `showcase.mp4` at 1920×1080, 60 fps, using Playwright and ffmpeg;
   - `README.md` and `THIRD_PARTY.md`.

   No placeholders and no "left as an exercise". If a file is long, split it into modules; say clearly how many files there are and list them before writing them.
3. **For vendored libraries,** give the exact npm package, version and file to copy into `vendor/`, plus a one-line shell command that fetches each one, because you may not be able to include the library's bytes yourself. Never load from a CDN at runtime.
4. **If your environment can run code** (for example a code interpreter or canvas), test what you can: run the JSON through a validator, render a few frames, and show a screenshot or the model sheet. Say plainly what you could not test.
5. **End with:**
   - the comparison table (version 1 against version 2);
   - the known limits;
   - the exact commands to run it locally.

Constraints to repeat to yourself:
- every frame = f(t);
- no `Date.now()` and no unseeded randomness;
- text via `textContent`;
- no `eval`;
- no inline scripts;
- every character labelled "synthetic presenter";
- no likeness of any real person;
- no female figure;
- credit the storyboards, the book and RiskMandate's cast where you follow their styles.

Think like a game designer: anticipation, follow-through, squash and stretch, arcs, secondary motion, staging, appeal. Make each character feel alive and distinct. Be ambitious.

## After ChatGPT answers

1. Put its files in `src/lab/presenters/v2-chatgpt/` on a branch.
2. Fetch the vendored libraries with its commands.
3. Run it as in `common.md` section 5.
4. A person commits it, or asks bulletins.b@ to review and commit it. ChatGPT does not push to the repository.
