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
| Licence breach | Each fact carries its source's licence (IPMA's terms, ODbL for adsb.lol, CC BY 4.0 for ours), shown beside it. IPMA's terms allow use without a profit-making purpose, and Open-Meteo's free tier is non-commercial: Dinis decided (18 November, about 23:45 UTC) that only promptugal.news bills and the bulletins carry no billing, so both may be shown here with their licences. |

## London (page 700)
Reads `data.promptugal.news/api/v1/by-place/now/london.json` only (no new host). Untrusted strings (flood severity, area, attribution, licence name) go through `clean()` and `esc()`; flood links go through `safeLink()` (check-for-flooding.service.gov.uk, environment.data.gov.uk, open-meteo.com, nationalarchives.gov.uk). Open-Meteo's forecast is used under its free non-commercial terms, at Dinis's decision of 18 November (the bulletins charge nothing); if this site is ever paid, LONDON_FORECAST=off turns it off until he decides. Licences shown as given: Open-Meteo CC BY 4.0 with "Weather data by Open-Meteo.com"; Open Government Licence v3.0 with the Environment Agency's notice. The page says it is not a warning service and points to the Environment Agency and the Met Office. Residual risk as for every page: a sentence built from the facts' own words can still shift their meaning.

## Live figures in the browser (src/assets/live.js)
At Dinis's word (19 November, about 01:13 UTC: "load the data in the browser"). A page re-reads a few changing figures when it opens and every five minutes. It reads only https://data.promptugal.news, with no cookie and no referrer, and caches nothing. A value replaces the built one only if it is a whole number within the element's bounds and its read time is newer than the built copy's. Otherwise the built figure stays, labelled "built copy". It is written with textContent. A figure older than 1.5 times its cadence is marked stale. The page policy allows connect-src to that host only (and *.promptugal.news where the sites bar is on), and script-src 'self'. The model-written bulletin is never changed in the browser: it stays paired with the facts it was checked against, and shows its own age.

## Not covered yet
- No scheduled run: the hourly pages need either a scheduled job with the key as a repository secret (Dinis's decision) or a wake of this session each hour.
- Audio (ElevenLabs) and video are not built; each will get its own section here before it runs.

## The sites bar's pins (19 November, 04:56 UTC)

security@'s ruling of 04:51 UTC, option 1 (main repo board/team/security/reviews/2026-11-19-0120-ruling-public-keys-in-leak-scans.md, last addendum). No SRI pin is written into this repository, so the leak scan exempts none. At every build `bulletins/sitesbar.mjs` reads `bar.integrity` from promptugal.news/api/v1/sites.json and compares each pin in full with the digest of the vendored file, before the renderer is imported. A mismatch stops the build. If the registry cannot be read, gives no pin in SRI form for a file, or names another version, the pages go out without a bar. Threat: a changed registry cannot change our vendored files; it can only stop the bar. Threat: someone changes a vendored file in this repository; its digest no longer matches the registry and the build stops. Accepted: when promptugal.news is down at build time, the bar is missing until the next build (before, the last checked bar was kept).

## Sites bar 1.2.0 (19 November, 07:16 UTC)

Upgraded on security@'s go (Website 055e6c1430). Same threats and controls as 1.1.1: vendored files, each checked in full against the registry's pin for our own version (now `bar.versions["1.2.0"]`, append-only), renderer imported only after the check, no change to the page policy (the script still reads only each listed site's /version.json and shows /preview.svg as an image). New: the bar goes off only when the registry stops listing 1.2.0, so a newer release no longer removes it. Read before install: the script fetches only same-host https URLs with credentials omitted and no referrer, and writes only by textContent.

## Predictions file (19 November, 08:02 UTC)

`bulletins/predictions.mjs` appends to `data/predictions/predictions.jsonl` (append-only, flag 'a'; a torn last line gets its newline first; at most 50 lines a run; nothing appended past 5 MB). Inputs are our own committed scripts and facts. The subject is a constant, the due day comes from our clock and is re-checked, each value must be finite and in range, the quoted sentence passes through clean(), and every address must parse as https with no spaces, quotes or angle brackets. A line is kept only when every number of the value stands alone in the published sentence (lookarounds, metacharacters escaped). The model never sees `pred` (write.mjs sends id and text). Nothing here is shown on a page yet; when it is, it goes through esc() and safeLink(). Open: IPMA's licence name is "the source's terms" (its card), not a named licence.

## Backfill and outcomes (19 November, 11:03 UTC)

`bulletins/predictions-backfill.mjs` reads committed versions of data/scripts/{200,700}.json with git (argument arrays, revisions matched to 40 hex characters, at most 200, 4 MB per blob), and parses numbers only from our own fixed fact templates. `bulletins/outcomes.mjs` reads data.promptugal.news's history files through getJSON (host allowlist, size and time limits). It judges a day only when `complete` is exactly true, uses only numbers that pass range checks, builds every sentence from its own template, and writes one outcome per prediction id. Where a part cannot be judged it writes `gap`, never a guess. Both only append. The quoted sentence (`said`) is model text through clean(): any page that shows it must esc() it. Rights: IPMA's and Open-Meteo's values are for free, non-commercial sites only; this site charges nothing.

## "What we said, what happened" on P200 and P700 (19 November, 14:02 UTC)

bulletins/past.mjs builds the block at render time from local files only (no fetch): our checked history copy (data/history/, written by outcomes.mjs with dates by pattern, numbers in range, complete only if exactly true, licence url through https()) and the predictions file. Every value is escaped where it lands; the two links go through safeLink; the record link is a constant. The predictions file is copied as is to /api/v1/predictions.jsonl, so nothing private may ever be written to it (today it holds only forecasts, measurements, our page and source URLs and licences). Claims are kept to what the code computes: the track-record line counts only day-before forecasts and says how many days were same-day or gaps. Rights: IPMA's observations shown here under rights@'s R8 (free site, IPMA credited); never on promptugal.news (R13).

## Signing check, controls 6 and 7 (19 November, 14:04 UTC)

6. An orphan commit (no parent) is refused unless it is the recorded trust anchor; ancestry, not commit date, decides what is older than the check. 7. The checker is never run from the tree it checks: release.sh and CI extract scripts/check-signatures.mjs from the last release (origin/dev, or the last release tag) and run that copy; if it cannot be extracted, the step fails. Residual: the workflow file and release.sh come from the pushed tree or the releaser's checkout; branch protection (Dinis's, later) closes that.

## Predictions in the library's form (19 November, 14:10 UTC)

The first predictions file did not match the library's form and could not be corrected without editing lines, which the form forbids. It is kept unchanged as data/predictions/predictions-v0.jsonl; predictions.jsonl starts again from the same committed scripts, one line per quantity. Text fields have [ ] < > and backticks removed (the library refuses them). The file passes the library's own checker (pred-form.mjs, pure functions, read before use). Nothing in the file is fetched or run by the library.
