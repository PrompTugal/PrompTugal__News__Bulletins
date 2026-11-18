// Shared pieces of the bulletins pipeline: the host allowlist, a safe JSON fetch,
// text cleaning, HTML escaping and the daily budget ledger. Node built-ins only.
// Written by bulletins.b@PrompTugal.dinis, 18 November 2026. Code: Apache-2.0.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The only hosts the collector reads (our own published data). The model host is separate
// (write.mjs) and is the only place the OpenRouter key is sent.
export const READ_HOSTS = new Set(['data.promptugal.news', 'promptugal.news', 'library.promptugal.news']);
const MAX_BYTES = 4 * 1024 * 1024;

export async function getJSON(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !READ_HOSTS.has(u.hostname)) throw new Error(`host not allowed: ${u.hostname}`);
  const res = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(30000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${u.hostname}${u.pathname}: HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!/json/.test(type)) throw new Error(`${u.hostname}${u.pathname}: not JSON (${type.slice(0, 40)})`);
  if (Number(res.headers.get('content-length')) > MAX_BYTES) throw new Error(`${u.hostname}${u.pathname}: too large`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`${u.hostname}${u.pathname}: too large (${buf.length} bytes)`);
  return JSON.parse(buf.toString('utf8'));
}

// Fetched text is data, never instruction: strip control characters and markup, cap the length,
// and mask anything shaped like an email address, a phone number or a session id.
export function clean(s, max = 240) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => (/^[a-z0-9.-]+@promptugal\.dinis$/i.test(m) ? m : '[email removed]'))
    .replace(/\+?\d[\d ()-]{8,}\d/g, (m) => (/^\d{4}-\d{2}-\d{2}/.test(m) ? m : '[number removed]'))
    .replace(/session_[A-Za-z0-9]{8,}/g, '[session]')
    .replace(/\u2014/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A link is shown only if it is https and on one of our hosts or a known source host.
const LINK_HOSTS = /(^|\.)(promptugal\.news|ipma\.pt|adsb\.lol|creativecommons\.org|opendatacommons\.org|dados\.gov\.pt|meteoalarm\.org|open-meteo\.com|environment\.data\.gov\.uk|check-for-flooding\.service\.gov\.uk|nationalarchives\.gov\.uk)$/i;
export function safeLink(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    if (u.hostname === 'github.com') return /^\/PrompTugal\//.test(u.pathname) ? u.href : null; // our own repositories only
    return LINK_HOSTS.test(u.hostname) ? u.href : null;
  } catch { return null; }
}

// The first 32 hex characters of SHA-256: enough to tell inputs apart, and short of the leak scan's 48-character hex shape.
export const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 32);
export const readJSON = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
export function writeJSON(p, v) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 1) + '\n'); }

// The budget (brief, 18 Nov 2026): at most 5 USD a day across OpenRouter and ElevenLabs together,
// until Dinis sets one. The ledger is committed: data/costs/YYYY-MM-DD.json, one entry per call.
export const DAILY_CAP_USD = 5;
export const today = () => new Date().toISOString().slice(0, 10);
export const ledgerPath = (d = today()) => join(ROOT, 'data', 'costs', `${d}.json`);
export function spentToday() {
  const l = readJSON(ledgerPath(), { calls: [] });
  return l.calls.reduce((a, c) => a + (Number(c.cost_usd) || 0), 0);
}
export function record(call) {
  const p = ledgerPath();
  const l = readJSON(p, { date: today(), cap_usd: DAILY_CAP_USD, source: 'OpenRouter usage.cost in each response (usage accounting), in USD', calls: [] });
  l.calls.push(call);
  l.total_usd = Number(l.calls.reduce((a, c) => a + (Number(c.cost_usd) || 0), 0).toFixed(6));
  writeJSON(p, l);
}
