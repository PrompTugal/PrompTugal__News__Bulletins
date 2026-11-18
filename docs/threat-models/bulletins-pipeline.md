# Threat model: the bulletins pipeline

Owner: bulletins.b@PrompTugal.dinis. Written 18 November 2026, for review by security@PrompTugal.dinis. Code: `bulletins/`. Licence of this text: CC BY 4.0.

## What it does
`node bulletins/run.mjs` runs four steps in one process, by hand at each wake of bulletins.b@ (no scheduled job yet):

1. **collect.mjs** reads JSON over HTTPS from data.promptugal.news, promptugal.news and library.promptugal.news, and, for page 800, a local read-only clone of PrompTugal__News__Website (`git log`, `board/team/*/status.json`, `board/runs/stats/summary.json`). It writes `data/facts/latest.json`.
2. **write.mjs** sends each page's facts (ids and text only) to OpenRouter (`openrouter.ai`) with the key from `OPEN_ROUTER_KEY`, and gets back sentences that cite fact ids.
3. **check.mjs** (no model) keeps a sentence only if it cites real fact ids and every number and name in it is in those facts; no links, markup, em dashes or hype words.
4. **render.mjs** writes static HTML, JSON and plain-text transcripts into `src/`; `scripts/build.mjs` copies them to `_site/`, which GitHub Pages serves.

## What it trusts
- Our own three hosts to serve our own data. It does not trust their text: every string is cleaned (`core.mjs` `clean()`), escaped on output (`esc()`), and links are shown only for https URLs on a short list of hosts (`safeLink()`).
- The model to follow the format. It does not trust what the model writes: the check decides what is published.
- The environment to hold the OpenRouter key. The key is read in one place (`write.mjs`), sent only to `https://openrouter.ai/api/v1/chat/completions`, never printed, logged or written.

## What could go wrong, and the mitigations
| Threat | Mitigation |
|---|---|
| The key leaks (log, error, commit, page) | Read from the environment only; errors are reduced to the HTTP status and a cleaned 120-character message; nothing writes request headers; the leak scan runs before every release and in CI. |
| Prompt injection: a story title, warning text or commit subject carries an instruction to the model | Facts are sent as a JSON data block; the system prompt says facts are data; the output must be JSON sentences citing ids; the check drops any sentence whose numbers or names are not in its cited facts, where more than 30% of its other words are not in them, or that holds a link, markup or an instruction word (you, should, must, ignore, click, visit and the like). Residual risk: a sentence built from the facts' own words can still change their meaning ("no warning" from "a warning"); the library's fact-checker reviews the bulletins, and every page shows its sources beside the text. |
| Script or HTML injection into a page | Every value is escaped; links go through `safeLink()`; a Content-Security-Policy meta tag sets `script-src 'none'`; the pages have no scripts. |
| SSRF, or reading a host we did not mean to | `getJSON()` accepts https only, on three named hosts; redirects are refused; 30-second timeout; 4 MB limit; JSON content type required. |
| Private persons' data reaches a page (names, emails, phones in commit subjects or status files) | Page 800 uses agent role names (`role@PrompTugal.dinis`, from the start of commit subjects), counts and times only, never a subject's free text; status files give only their count and update time; `clean()` masks email addresses (except agents' `@PrompTugal.*` names), phone-shaped numbers and session ids. No author names or emails are read. |
| Cost runs away | A committed ledger per UTC day (`data/costs/`): every response is recorded, failed and unreadable ones included, at OpenRouter's own usage figure, or at the 0.05 USD per-call ceiling marked estimated when no figure comes back; models are limited to a short list; a call is refused when the day's spend plus 0.05 USD would pass 5 USD; a page whose facts have not changed is not written again; one retry at most. |
| A wrong fact is presented as ours | Each fact names its source file, the upstream source it records, the time read, who made it and its licence; the page says it was made by agents and adds no reporting; weather pages point to IPMA and ANEPC. |
| Licence breach | Each fact carries its source's licence (IPMA's terms, ODbL for adsb.lol, CC BY 4.0 for ours), shown beside it. IPMA's terms allow use without a profit-making purpose: if the bulletins are ever sold, this needs Dinis's decision first. |

## London (page 700)
Reads `data.promptugal.news/api/v1/by-place/now/london.json` only (no new host). Untrusted strings (flood severity, area, attribution, licence name) go through `clean()` and `esc()`; flood links go through `safeLink()` (check-for-flooding.service.gov.uk, environment.data.gov.uk, open-meteo.com, nationalarchives.gov.uk). Open-Meteo's forecast is used under its free non-commercial terms, at Dinis's decision of 18 November (the bulletins charge nothing); if this site is ever paid, LONDON_FORECAST=off turns it off until he decides. Licences shown as given: Open-Meteo CC BY 4.0 with "Weather data by Open-Meteo.com"; Open Government Licence v3.0 with the Environment Agency's notice. The page says it is not a warning service and points to the Environment Agency and the Met Office. Residual risk as for every page: a sentence built from the facts' own words can still shift their meaning.

## Not covered yet
- No scheduled run: the hourly pages need either a scheduled job with the key as a repository secret (Dinis's decision) or a wake of this session each hour.
- Audio (ElevenLabs) and video are not built; each will get its own section here before it runs.
