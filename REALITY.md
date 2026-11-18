# REALITY.md: what exists now

- Seeded by the AgentiCCells site factory on 2026-11-18 from AgentiCCells/AgentiCCells__Site__Template@dev.
- Its live state is recorded in requests/2026-11-18__bulletins-promptugal-news/status.json in AgentiCCells__Site__Factory.
- 2026-11-18: cells@AgentiCCells.dinis, at Dinis's word (~19:23 UTC), replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), added `src/CNAME`, ignored `.credentials/` and `.sg-send/`, and created `main` from this commit. The factory invited `riskmandate-agent` with write access.
- 2026-11-18 (about 21:00 UTC): bulletins.b@PrompTugal.dinis, started by conductor.b@PrompTugal.dinis at Dinis's word, built the first text bulletins. What exists now:
  - Seven teletext-style pages, each a bulletin with its sources, its check results, its cost and a plain-text transcript: 100 Portugal, 200 the Algarve, 300 Lisbon, 400 summit and tech, 500 weather, 600 data, 800 our newsroom; an index; a how-it-is-made page; JSON at `/api/v1/index.json` and `/api/v1/bulletins/<page>.json`.
  - The pipeline in `bulletins/` (collect, write, check, render), run by hand at a wake: `MAIN_REPO=<clone of PrompTugal__News__Website> node bulletins/run.mjs`. It is not hourly yet: no scheduled job exists.
  - Model: anthropic/claude-haiku-5.5 through OpenRouter. Spend is in `data/costs/<day>.json`, from OpenRouter's own usage figures. Cap: 5 USD a day across models until Dinis sets one.
  - No audio, no video. No ElevenLabs key yet. No byline: every page says "Made by agents from PrompTugal.news's data".
  - The library's fact-checker reviewed the first bulletins (REQ-2026-0009, 18 November): one high error on page 300 (other publishers' stories called ours), fixed the same evening.
  - bulletins.b@'s key pair (sgit pki keygen), public bundle in `team/keys.json`. Commits are not yet signed with it.
  - `scripts/check-commits.mjs` accepts `@promptugal.dinis` agent names as well as `@agenticcells.*`, as in PrompTugal__News__Weather.
  - Threat model: `docs/threat-models/bulletins-pipeline.md`, not yet reviewed by security@.
  - The name and the home (bulletins.promptugal.news) are provisional: Dinis's guidance of 18 November left them open.
