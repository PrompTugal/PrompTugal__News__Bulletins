// The synthetic voice, shared by the lab's video scripts: OpenRouter's openai/gpt-audio-mini, stock voice "alloy",
// told to read the text word for word. Returns the PCM (16-bit, 24 kHz, mono), the model's own transcript, whether
// that transcript matches the text word for word, and the cost. Every call is in the ledger; the day's cap applies.
// The key comes from OPEN_ROUTER_KEY in the environment only and is never printed.
import { spentToday, record, DAILY_CAP_USD, clean } from './core.mjs';

export const VOICE = { model: 'openai/gpt-audio-mini', voice: 'alloy', synthetic: true, note: 'A stock voice, not a clone of any person.' };
const CEILING = 0.05;
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function speak(text, what) {
  if (spentToday() + CEILING > DAILY_CAP_USD) throw new Error(`daily cap of ${DAILY_CAP_USD} USD reached`);
  const key = process.env.OPEN_ROUTER_KEY;
  if (!key) throw new Error('OPEN_ROUTER_KEY is not in the environment');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(240000),
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'PrompTugal.news bulletins' },
    body: JSON.stringify({ model: VOICE.model, stream: true, modalities: ['text', 'audio'], audio: { voice: VOICE.voice, format: 'pcm16' }, usage: { include: true },
      messages: [{ role: 'system', content: 'You are a text-to-speech reader. Read the user message aloud exactly as written, word for word, in a calm, clear presenter voice. Add nothing, leave nothing out, change nothing.' },
        { role: 'user', content: text }] }),
  });
  if (!res.ok) { const b = await res.text().catch(() => ''); record({ at: new Date().toISOString(), what, provider: 'openrouter', model: VOICE.model, http: res.status, cost_usd: 0 }); throw new Error(`OpenRouter HTTP ${res.status}: ${clean(b, 160)}`); }
  const pcm = [], words = []; let usage = null, buf = '';
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const d = line.slice(5).trim(); if (d === '[DONE]') continue;
      let j; try { j = JSON.parse(d); } catch { continue; }
      const a = j.choices?.[0]?.delta?.audio;
      if (a?.data) pcm.push(Buffer.from(a.data, 'base64'));
      if (a?.transcript) words.push(a.transcript);
      if (j.usage) usage = j.usage;
    }
  }
  const reported = Number(usage?.cost), cost = Number.isFinite(reported) ? reported : CEILING;
  record({ at: new Date().toISOString(), what, provider: 'openrouter', model: VOICE.model, http: res.status,
    prompt_tokens: usage?.prompt_tokens, completion_tokens: usage?.completion_tokens, cost_usd: cost, ...(Number.isFinite(reported) ? {} : { estimated: true }) });
  const transcript = words.join('');
  return { pcm: Buffer.concat(pcm), transcript, same: norm(transcript) === norm(text), cost };
}
