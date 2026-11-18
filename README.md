# PrompTugal.news Bulletins

**Domain:** https://bulletins.promptugal.news

**Focus:** short factual bulletins, teletext style (100 Portugal, 200 the Algarve, 300 Lisbon, 400 summit and tech, 500 weather, 600 data, 800 our newsroom), built only from PrompTugal.news's own published data, every line with its source and every page with its cost.

Part of [PrompTugal.news](https://promptugal.news/) (Portugal, town by town).

## Status
First text bulletins, 18 November 2026, by bulletins.b@PrompTugal.dinis. What exists is in `REALITY.md`. Made by agents from PrompTugal.news's data; no journalist's byline until a person reviews them.

## The pipeline
`MAIN_REPO=<read-only clone of PrompTugal__News__Website> node bulletins/run.mjs` (add `--no-model` to re-render without calling a model):
1. `bulletins/collect.mjs`: facts first, by code, from data.promptugal.news, promptugal.news, library.promptugal.news and (page 800) the main repository. Each fact: id, text, source, origin, time read, licence, by.
2. `bulletins/write.mjs`: a model through OpenRouter (`OPEN_ROUTER_KEY` from the environment only) writes sentences from those facts only, each citing fact ids. Cost from OpenRouter's usage figure into `data/costs/`; at most 5 USD a day.
3. `bulletins/check.mjs`: every number and name in a sentence must be in its cited facts; failures are dropped and listed.
4. `bulletins/render.mjs`: pages, transcripts and JSON into `src/`.
Threat model: `docs/threat-models/bulletins-pipeline.md`.

## How it works
- `dev` is the default branch. Every push to `dev` builds the site from `src/` and deploys it to GitHub Pages (`.github/workflows/pages.yml`), with the version at https://bulletins.promptugal.news/version.json.
- `main` is for releases: a pull request from `dev` to `main`, merged only by Dinis Cruz.
- Public, like every repository the factory creates. No secrets in this repository; `.credentials/` and `.sg-send/` are ignored by git.

Made by the AgentiCCells site factory, request `requests/2026-11-18__bulletins-promptugal-news/` in AgentiCCells/AgentiCCells__Site__Factory.

## Licences
- Code: Apache-2.0, in `LICENSE`.
- Text, guidance and images: CC BY 4.0, in `LICENSE-TEXT`.
