// Gate: every new commit is signed with its agent's published key (Dinis, 19 Nov 2026, about 01:10 UTC:
// "every single agent that runs in here should have published its public key on the repo that it maintains
// ... every then commit is signed by that key ... you should also include the session ID"; main repo
// board/guidance/2026-11-19-signed-commits-paid-search-and-free-embeds.md, section 2).
// Usage: node scripts/check-signatures.mjs <before> <after>   (the pushed range, before..after)
// A commit fails if it is unsigned or badly signed, if its signer is not the agent in its Agent: trailer,
// or if its Claude-Session: trailer is not the session published with that agent's key in team/keys.json.
// Commits older than this check are skipped (those that neither descend from the commit that added this
// file nor were committed after it): history is never rewritten. Commits by CI itself are exempt (EXEMPT).
// Written by bulletins.b@PrompTugal.dinis. Node built-ins and git (with ssh-keygen) only.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EXEMPT = new Set(['github-actions[bot]', '41898282+github-actions[bot]@users.noreply.github.com']);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

const [beforeArg, afterArg] = process.argv.slice(2);
const after = afterArg || 'HEAD';
const first = lines(git('log', '--format=%H', '--diff-filter=A', '--reverse', after, '--', 'scripts/check-signatures.mjs'))[0];
if (!first) { console.log('OK (check not yet in history: nothing to check)'); process.exit(0); }
const firstTime = Number(git('log', '-1', '--format=%ct', first));

// The published keys: team/keys.json, entries with a git_signing key and a session.
const keys = JSON.parse(readFileSync('team/keys.json', 'utf8')).keys || [];
const published = keys.filter((k) => k.status !== 'superseded' && k.git_signing?.ssh_public_key && k.session);
if (!published.length) { console.error('check-signatures: no git signing key with a session in team/keys.json'); process.exit(1); }
const dir = mkdtempSync(join(tmpdir(), 'sig-'));
const allowed = join(dir, 'allowed_signers');
writeFileSync(allowed, published.map((k) => `${k.agent} namespaces="git" ${k.git_signing.ssh_public_key}`).join('\n') + '\n');
const sessionOf = new Map(published.map((k) => [k.agent.toLowerCase(), k.session]));

const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) && tryGit('rev-parse', '--verify', '--quiet', `${beforeArg}^{commit}`);
const added = lines(git('rev-list', '--no-merges', ...(before ? [`${before}..${after}`] : [after])));
const descendants = new Set([first, ...lines(git('rev-list', '--ancestry-path', `${first}..${after}`))]);
const errors = [];
let checked = 0, exempted = 0;
for (const c of added) {
  if (!descendants.has(c) && Number(git('log', '-1', '--format=%ct', c)) < firstTime) continue;
  const committer = git('log', '-1', '--format=%cn%n%ce', c).split('\n');
  if (committer.some((x) => EXEMPT.has(x))) { exempted++; continue; }
  checked++;
  const [status, signer] = git('-c', `gpg.ssh.allowedSignersFile=${allowed}`, 'log', '-1', '--format=%G?%n%GS', c).split('\n');
  const agent = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim())[0] || '';
  const session = (lines(git('log', '-1', '--format=%(trailers:key=Claude-Session,valueonly)', c))[0] || '').trim().replace(/^https:\/\/claude\.ai\/code\//, '');
  const subject = git('log', '-1', '--format=%s', c).slice(0, 70);
  if (status !== 'G') errors.push(`${c.slice(0, 7)} ${subject}: not signed with a published key (status ${status || 'none'})`);
  else if ((signer || '').toLowerCase() !== agent.toLowerCase()) errors.push(`${c.slice(0, 7)} ${subject}: signed by ${signer}, but its Agent: is ${agent || 'missing'}`);
  else if (sessionOf.get(agent.toLowerCase()) !== session) errors.push(`${c.slice(0, 7)} ${subject}: Claude-Session: ${session || 'missing'} is not the session published with ${agent}'s key`);
}
rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error(errors.join('\n')); console.error(`FAILED (${errors.length} of ${checked} commits checked)`); process.exit(1); }
console.log(`OK (${checked} signed commits checked, ${exempted} by CI exempt)`);
