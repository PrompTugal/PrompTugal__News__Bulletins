# The bulletins: Dinis's words and the brief

## Dinis's words
> Dinis, in conductor.b@'s session, 18 November 2026, about 19:00 UTC (recorded by conductor.b@ in PrompTugal__News__Website, `board/guidance/2026-11-18-cameras-provenance-and-bulletins.md`): "I would like to start exploring the idea of creating audio and video debriefs ... what just happened in the last couple of days or last hour here, and even on our new stuff, in our internal architecture, but also on the news for a particular place ... understanding the costs ... the art of the possible ... automated news feeds that, eventually once we have journalists working with us and video editors, they can also be used to guide them ... I have an ElevenLabs API key, and we have OpenRouter ... text, video and audio summaries ... a collation of everything we have here ... like the teletext ... fact-based from everything that we do here ... probably created by journalists and researchers, but based on our data."

The repository was created at his request; conductor.b@PrompTugal.dinis started bulletins.b@ the same evening.

## The brief (from conductor.b@, 18 November 2026)
Numbered teletext-style pages (100 Portugal, 200 the Algarve, 300 Lisbon, 400 summit and tech, 500 weather, 600 data, 800 our own newsroom), short factual summaries built only from our own published data. Facts first, each with the id and URL of its source; a script by a model through OpenRouter from those facts only; a check of every sentence before publishing (the library's fact-checker to review the first ones); text first, audio when Dinis's ElevenLabs key arrives (a stock voice, labelled synthetic, never a clone of a real person's voice); video later, from our own charts, maps and captions; each bulletin with its transcript, sources and cost. Budget until Dinis sets one: at most 5 USD a day across OpenRouter and ElevenLabs. "Made by agents from PrompTugal.news's data" until a person reviews them.

## 19 Nov 2026, about 03:15 UTC (Dinis, in conductor.b@'s session; main repo board/guidance/2026-11-19-no-ip-lookup-predictions-and-small-decisions.md)

> "Yeah, okay, remove the IP base. So we're going to keep the country still. I agree. The predictions are one collection, yeah. ... So for now, don't get the London observed temperature."

What it means here: this site carries no obs.js and makes no IP lookup (checked 03:20 UTC: no ipapi.co or ipwho.is anywhere in the repository), so nothing to remove. When P200 and P700 start keeping "what we said" files, a copy goes to library.promptugal.news in the form library.b@ sets; we still keep and check our own. P700's past-against-forecast stays rain only: no London observed temperature.

## 19 Nov 2026, about 16:30 UTC (Dinis, relayed by conductor.b@ at 16:35; main repo board/guidance/2026-11-19-twice-a-day.md)

Every scheduled agent wakes twice a day, because there are no readers yet and the site needs updating only a couple of times a day. This site: 08:00 to 09:00 and 19:00 to 20:00 Lisbon. Each wake finishes and releases one whole piece. Staleness thresholds moved to about 13 hours.
