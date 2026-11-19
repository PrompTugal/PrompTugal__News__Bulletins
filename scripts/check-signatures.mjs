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
// security@'s ruling of 19 Nov, 01:30 UTC adds: every commit in the range is checked, merges and side branches
// included; one failure refuses the whole range (the script exits 1, release.sh does not push and CI does not
// deploy); the Claude-Session: trailer must equal the full session URL published with the key.
// The one trust anchor is TRUST_ANCHOR, the commit that added this check and the first key: it is checked
// against its own team/keys.json, because no earlier commit holds a key. Older commits are not checked.
// Control 7 (same finding; widened by security@ at 14:08): this file, check-commits.mjs and leak-scan.mjs are never
// run from the tree they check. release.sh and CI take each from the last release (origin/dev, or the last release
// tag) with git show into scripts/<name>.trusted.mjs (git-ignored) and run that copy; a missing copy fails, with no
// fallback. Control 8: a commit is skipped only if it is an ancestor of the trust anchor, never by what a tree holds.
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
// A shallow clone hides parents, so a commit could look like an orphan or skip its parent's keys: refuse it (security@, 14:07).
if (git('rev-parse', '--is-shallow-repository') !== 'false') { console.error('check-signatures: a shallow clone; fetch the whole history (fetch-depth 0)'); process.exit(1); }
if (tryGit('cat-file', '-e', `${TRUST_ANCHOR}^{commit}`) === null) { console.error('check-signatures: the trust anchor commit is not in this clone (fetch more history)'); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'sig-'));
// The published keys as of a given commit (its team/keys.json), as an allowed-signers file and a session map.
function keysAt(rev) {
  const raw = tryGit('show', `${rev}:team/keys.json`);
  let keys = [];
  try { keys = JSON.parse(raw || '{}').keys || []; } catch { keys = []; }
  const ok = keys.filter((k) => k.status !== 'superseded' && typeof k.git_signing?.ssh_public_key === 'string' && /^ssh-ed25519 [A-Za-z0-9+/=]+$/.test(k.git_signing.ssh_public_key) && typeof k.session === 'string' && typeof k.agent === 'string' && /^[a-z0-9.-]+@[A-Za-z0-9.-]+$/.test(k.agent));
  const file = join(dir, `allowed-${rev.slice(0, 12)}`);
  writeFileSync(file, ok.map((k) => `${k.agent} namespaces="git" ${k.git_signing.ssh_public_key}`).join('\n') + '\n');
  const url = (k) => k.session_url || `https://claude.ai/code/${k.session}`;
  return { file, sessions: new Map(ok.map((k) => [k.agent.toLowerCase(), url(k)])), count: ok.length };
}

const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) && tryGit('rev-parse', '--verify', '--quiet', `${beforeArg}^{commit}`);
const added = lines(git('rev-list', ...(before ? [`${before}..${after}`] : [after]))); // merges and side branches included
const descendants = new Set([TRUST_ANCHOR, ...lines(git('rev-list', '--ancestry-path', `${TRUST_ANCHOR}..${after}`))]);
const errors = [];
let checked = 0;
for (const c of added) {
  // Older than the check means an ancestor of the trust anchor, by ancestry only: a commit's date can be set to anything.
  if (!descendants.has(c) && tryGit('merge-base', '--is-ancestor', c, TRUST_ANCHOR) !== null) continue;
  checked++;
  const subject = git('log', '-1', '--format=%s', c).slice(0, 70);
  const parent = git('log', '-1', '--format=%P', c).split(/\s+/).filter(Boolean)[0]; // the first parent's keys, merges included
  // Control 6 (videos.b@'s finding, relayed by conductor.b@ 19 Nov 14:01 UTC): a commit with no parent could trust the
  // keys in its own tree, so an orphan is refused unless it is the one recorded trust anchor.
  if (!parent && c !== TRUST_ANCHOR) { errors.push(`${c.slice(0, 7)} ${subject}: a commit with no parent, and not the trust anchor`); continue; }
  const k = keysAt(c === TRUST_ANCHOR ? c : parent);
  if (!k.count) { errors.push(`${c.slice(0, 7)} ${subject}: no published signing key in its parent's team/keys.json`); continue; }
  const [status, signer] = git('-c', `gpg.ssh.allowedSignersFile=${k.file}`, 'log', '-1', '--format=%G?%n%GS', c).split('\n');
  const agent = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim())[0] || '';
  const session = (lines(git('log', '-1', '--format=%(trailers:key=Claude-Session,valueonly)', c))[0] || '').trim(); // compared in full
  if (status !== 'G') errors.push(`${c.slice(0, 7)} ${subject}: not signed with a key published before it (status ${status || 'none'})`);
  else if ((signer || '').toLowerCase() !== agent.toLowerCase()) errors.push(`${c.slice(0, 7)} ${subject}: signed by ${signer}, but its Agent: is ${agent || 'missing'}`);
  else if (k.sessions.get(agent.toLowerCase()) !== session) errors.push(`${c.slice(0, 7)} ${subject}: Claude-Session: ${session || 'missing'} is not the session published with ${agent}'s key`);
}
rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error(errors.join('\n')); console.error(`FAILED (${errors.length} of ${checked} commits checked)`); process.exit(1); }
console.log(`OK (${checked} signed commits checked against their parents' keys)`);
