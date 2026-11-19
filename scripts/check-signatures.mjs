// Gate: every new commit is signed with its agent's published key (Dinis, 19 Nov 2026, about 01:10 UTC:
// "every single agent that runs in here should have published its public key on the repo that it maintains
// ... every then commit is signed by that key ... you should also include the session ID"; main repo
// board/guidance/2026-11-19-signed-commits-paid-search-and-free-embeds.md, section 2).
// Usage: node scripts/check-signatures.mjs <before> <after>   (the pushed range, before..after)
// A commit fails if it is unsigned or badly signed, if its signer is not the agent in its Agent: trailer,
// or if its Claude-Session: trailer is not the session published with that agent's key.
// Two controls (signals.b@'s review, relayed by conductor.b@, 19 Nov 01:16 UTC):
//  - Each commit is checked against the keys in its PARENT's team/keys.json, never its own, so a commit cannot
//    add its own key and pass. A new or rotated key must come in a commit signed by a key already listed.
//  - Nothing is exempted by author or committer name (anyone can set those). This repository's CI makes no
//    commits (it only pushes tags), so there is no exemption at all.
// The one trust anchor is TRUST_ANCHOR, the commit that added this check and the first key: it is checked
// against its own team/keys.json, because no earlier commit holds a key. Older commits are not checked.
// Written by bulletins.b@PrompTugal.dinis. Node built-ins and git (with ssh-keygen) only.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TRUST_ANCHOR = '72809984bfd6befa0211f46aee073136d958cd61';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

const [beforeArg, afterArg] = process.argv.slice(2);
const after = afterArg || 'HEAD';
if (tryGit('cat-file', '-e', `${TRUST_ANCHOR}^{commit}`) === null) { console.error('check-signatures: the trust anchor commit is not in this clone (fetch more history)'); process.exit(1); }
const anchorTime = Number(git('log', '-1', '--format=%ct', TRUST_ANCHOR));

const dir = mkdtempSync(join(tmpdir(), 'sig-'));
// The published keys as of a given commit (its team/keys.json), as an allowed-signers file and a session map.
function keysAt(rev) {
  const raw = tryGit('show', `${rev}:team/keys.json`);
  let keys = [];
  try { keys = JSON.parse(raw || '{}').keys || []; } catch { keys = []; }
  const ok = keys.filter((k) => k.status !== 'superseded' && typeof k.git_signing?.ssh_public_key === 'string' && /^ssh-ed25519 [A-Za-z0-9+/=]+$/.test(k.git_signing.ssh_public_key) && typeof k.session === 'string' && typeof k.agent === 'string' && /^[a-z0-9.-]+@[A-Za-z0-9.-]+$/.test(k.agent));
  const file = join(dir, `allowed-${rev.slice(0, 12)}`);
  writeFileSync(file, ok.map((k) => `${k.agent} namespaces="git" ${k.git_signing.ssh_public_key}`).join('\n') + '\n');
  return { file, sessions: new Map(ok.map((k) => [k.agent.toLowerCase(), k.session])), count: ok.length };
}

const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) && tryGit('rev-parse', '--verify', '--quiet', `${beforeArg}^{commit}`);
const added = lines(git('rev-list', '--no-merges', ...(before ? [`${before}..${after}`] : [after])));
const descendants = new Set([TRUST_ANCHOR, ...lines(git('rev-list', '--ancestry-path', `${TRUST_ANCHOR}..${after}`))]);
const errors = [];
let checked = 0;
for (const c of added) {
  if (!descendants.has(c) && Number(git('log', '-1', '--format=%ct', c)) < anchorTime) continue; // older than the check
  checked++;
  const subject = git('log', '-1', '--format=%s', c).slice(0, 70);
  const parent = lines(git('log', '-1', '--format=%P', c))[0];
  const k = keysAt(c === TRUST_ANCHOR || !parent ? c : parent);
  if (!k.count) { errors.push(`${c.slice(0, 7)} ${subject}: no published signing key in its parent's team/keys.json`); continue; }
  const [status, signer] = git('-c', `gpg.ssh.allowedSignersFile=${k.file}`, 'log', '-1', '--format=%G?%n%GS', c).split('\n');
  const agent = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim())[0] || '';
  const session = (lines(git('log', '-1', '--format=%(trailers:key=Claude-Session,valueonly)', c))[0] || '').trim().replace(/^https:\/\/claude\.ai\/code\//, '');
  if (status !== 'G') errors.push(`${c.slice(0, 7)} ${subject}: not signed with a key published before it (status ${status || 'none'})`);
  else if ((signer || '').toLowerCase() !== agent.toLowerCase()) errors.push(`${c.slice(0, 7)} ${subject}: signed by ${signer}, but its Agent: is ${agent || 'missing'}`);
  else if (k.sessions.get(agent.toLowerCase()) !== session) errors.push(`${c.slice(0, 7)} ${subject}: Claude-Session: ${session || 'missing'} is not the session published with ${agent}'s key`);
}
rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error(errors.join('\n')); console.error(`FAILED (${errors.length} of ${checked} commits checked)`); process.exit(1); }
console.log(`OK (${checked} signed commits checked against their parents' keys)`);
