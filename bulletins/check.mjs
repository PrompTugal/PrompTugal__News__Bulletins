// Step 3 of the pipeline: check every sentence against its sources before it is published.
// Deterministic, no model. A sentence passes only if:
//   - it cites at least one fact id that exists on its page;
//   - every number in it appears in one of its cited facts;
//   - every capitalised word (a name) appears in one of its cited facts (a common sentence starter excepted),
//     or is a calendar word;
//   - at least 70% of its other words (beyond a list of function words) come from its cited facts;
//   - it holds no link, no markup, no em dash, no hype word, no instruction or advice word, and is at most 320 characters.
// What fails is dropped and recorded with the reason, never published.
const HYPE = /\b(revolutionary|cutting[- ]edge|seamless(?:ly)?|world[- ]class|game[- ]changing|breaking|stunning|incredible|unprecedented|massive)\b/i;
const CALENDAR = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'UTC', 'I']);

const STARTERS = new Set(['The', 'A', 'An', 'In', 'At', 'On', 'For', 'Of', 'By', 'From', 'With', 'There', 'It', 'Its', 'This', 'These', 'That', 'Today', 'Tomorrow', 'Tonight', 'Both', 'All', 'No', 'Some', 'Most', 'Rain', 'Weather', 'Warnings', 'Waves', 'Sea', 'Seas', 'Temperatures', 'Fire', 'Flights', 'Elsewhere', 'Meanwhile', 'Also', 'Over', 'Across', 'Among', 'Of', 'Another', 'Other', 'Three', 'Two', 'Four', 'Five', 'Six', 'One', 'Orange', 'Yellow', 'Red', 'Every', 'Each', 'New', 'Latest', 'Recent', 'Our', 'Data', 'Commits', 'Agents', 'Sessions', 'Code', 'Public', 'Wind', 'Winds', 'Forecasts', 'Forecast', 'Maximum', 'Minimum', 'Highs', 'Lows', 'Skies', 'Showers', 'Calmer', 'Drier', 'Conditions']);
// Words that carry no claim of their own: they need not be in the facts.
const FUNCTION = new Set('the a an and or but of in on at to for from by with as is are was were be been has have had its it this that these those there their than then also both each all any some most more less than into over under across between within about after before during while which who whom whose what when where how also very just only not no nor so such same other another one two three four five six seven eight nine ten first last next new latest recent today tomorrow tonight said says say gives give given forecast forecasts forecasted expected expects issued issue lists listed list shows show reports reported report published publishes saw seen counted counts count recorded records record runs run covers cover active total includes including included while still again further per around up down out off now our we us made make makes made agents agent'.split(' '));
// Words that would make a sentence an instruction or advice rather than a statement of fact.
const IMPERATIVE = /\b(you|your|should|must|ignore|click|visit|please|instruction|instructions|disregard|subscribe|buy|follow us|contact)\b/i;
const norm = (s) => s.normalize('NFC').toLowerCase();
const numbers = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.').replace(/^0+(?=\d)/, ''));

export function checkSentence(sentence, pageFacts) {
  const text = String(sentence?.text || '').trim();
  const ids = Array.isArray(sentence?.facts) ? sentence.facts.map(String) : [];
  const cited = ids.map((id) => pageFacts.find((f) => f.id === id)).filter(Boolean);
  if (!text) return 'empty';
  if (text.length > 320) return 'longer than 320 characters';
  if (!cited.length) return 'cites no fact on this page';
  if (cited.length !== ids.length) return `cites an unknown fact id (${ids.filter((id) => !pageFacts.some((f) => f.id === id)).join(', ')})`;
  if (/https?:|www\.|<|>|\]\(/.test(text)) return 'holds a link or markup';
  if (text.includes('\u2014')) return 'holds an em dash';
  const h = text.match(HYPE); if (h) return `hype word "${h[0]}"`;
  const imp = text.match(IMPERATIVE); if (imp) return `reads as an instruction or advice ("${imp[0]}")`;
  const source = norm(cited.map((f) => f.text).join(' '));
  const srcNums = new Set(numbers(source));
  for (const n of numbers(text)) if (!srcNums.has(n)) return `number ${n} is not in its cited facts`;
  const words = text.replace(/["'‘’“”]/g, ' ').split(/\s+/);
  for (const [i, w] of words.entries()) {
    const bare = w.replace(/^[^\p{L}\d]+|[^\p{L}\d.@-]+$/gu, '').replace(/[.]+$/, '');
    if (!/^\p{Lu}/u.test(bare) || CALENDAR.has(bare)) continue;
    // A sentence's first word is capitalised anyway: it passes if it is a common starter.
    if ((i === 0 || /[.:;]$/.test(words[i - 1])) && STARTERS.has(bare)) continue;
    if (!source.includes(norm(bare))) return `name "${bare}" is not in its cited facts`;
  }
  // Most of the sentence's own words must come from its cited facts (a five-letter stem is enough).
  const content = (norm(text).match(/\p{L}{3,}/gu) || []).filter((w) => !FUNCTION.has(w));
  const unseen = content.filter((w) => !source.includes(w.slice(0, 5)));
  if (content.length && unseen.length / content.length > 0.3) return `too many words not in its cited facts (${unseen.slice(0, 5).join(', ')})`;
  return null;
}

export function checkScript(sentences, pageFacts) {
  const kept = [], dropped = [];
  for (const s of sentences || []) {
    const why = checkSentence(s, pageFacts);
    if (why) dropped.push({ text: String(s?.text || '').slice(0, 320), facts: s?.facts || [], why });
    else kept.push({ text: s.text.trim(), facts: s.facts.map(String) });
  }
  return { kept, dropped };
}
