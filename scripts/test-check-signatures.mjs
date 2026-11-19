// Tests for scripts/check-signatures.mjs, in a throwaway repository with throwaway keys (none of them published).
// Lessons from data.b@ (PrompTugal__News__Data f68beb3), relayed by conductor.b@ (19 Nov, 02:16 UTC): the global
// git config may name another signer (gpg.ssh.program), so each test repository sets ssh-keygen itself; and each
// failing case asserts its reason, so a case cannot pass by failing for the wrong reason.
// The check is copied into the test repository with its trust anchor set to the test's first commit; the
// script in this repository is never changed. Run: node scripts/test-check-signatures.mjs (prints OK or fails).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'sigtest-'));
const repo = join(dir, 'repo');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const git = (...a) => run('git', a);
const key = (name) => { execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', name, '-f', join(dir, name)]); return readFileSync(join(dir, name + '.pub'), 'utf8').trim().split(' ').slice(0, 2).join(' '); };
const A = 'a.agent@PrompTugal.dinis', SA = 'https://claude.ai/code/session_A';
const keysFile = (entries) => JSON.stringify({ keys: entries.map(([agent, pub, url]) => ({ agent, session: url.split('/').pop(), session_url: url, git_signing: { ssh_public_key: pub } })) }, null, 1) + '\n';
const trailers = (agent, session) => `\n\nAgent: ${agent}\nClaude-Session: ${session}`;
function commit(msg, { signer = 'a', agent = A, session = SA, sign = true, files = {} } = {}) {
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(repo, dirname(p)), { recursive: true }); writeFileSync(join(repo, p), c); git('add', p); }
  const args = ['-c', `user.signingkey=${join(dir, signer + '.pub')}`, '-c', `commit.gpgsign=${sign}`, 'commit', '-q', '--allow-empty', '-m', msg + trailers(agent, session)];
  git(...args);
  return git('rev-parse', 'HEAD');
}
function check(base) {
  const r = spawnSync(process.execPath, ['scripts/check-signatures.mjs', base, 'HEAD'], { cwd: repo, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const results = [];
function expect(name, base, want) {
  const r = check(base);
  const ok = want === 'OK' ? r.code === 0 : r.code === 1 && r.out.includes(want);
  results.push(`${ok ? 'pass' : 'FAIL'}  ${name}${ok ? '' : `\n      wanted ${want === 'OK' ? 'OK' : JSON.stringify(want)}; got exit ${r.code}: ${r.out.trim().split('\n').slice(0, 2).join(' / ')}`}`);
}

try {
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.org');
  git('config', 'gpg.format', 'ssh'); git('config', 'gpg.ssh.program', 'ssh-keygen'); // never the environment's signer
  const pa = key('a'), pb = key('b');
  // The anchor: adds the check and key A, signed by A.
  const anchor = commit('anchor', { files: { 'team/keys.json': keysFile([[A, pa, SA]]), 'scripts/check-signatures.mjs': '' } });
  writeFileSync(join(repo, 'scripts/check-signatures.mjs'), readFileSync(join(HERE, 'check-signatures.mjs'), 'utf8').replace(/const TRUST_ANCHOR = '[0-9a-f]{40}';/, `const TRUST_ANCHOR = '${anchor}';`));
  git('add', 'scripts/check-signatures.mjs'); git('-c', `user.signingkey=${join(dir, 'a.pub')}`, 'commit', '-q', '--amend', '--no-edit', '-S');
  const root = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, 'scripts/check-signatures.mjs'), readFileSync(join(HERE, 'check-signatures.mjs'), 'utf8').replace(/const TRUST_ANCHOR = '[0-9a-f]{40}';/, `const TRUST_ANCHOR = '${root}';`));
  git('add', 'scripts/check-signatures.mjs'); commit('pin the anchor');
  const base = git('rev-parse', 'HEAD');
  const fresh = (b) => { git('checkout', '-q', '-B', b, base); };

  fresh('t1'); commit('good'); expect('a good commit signed by its agent passes', base, 'OK');
  fresh('t2'); commit('unsigned', { sign: false }); expect('an unsigned commit fails', base, 'not signed with a key published before it (status N)');
  fresh('t3'); commit('signed by an unlisted key', { signer: 'b' }); expect('a commit signed by an unlisted key fails', base, 'not signed with a key published before it');
  fresh('t4'); commit('adds its own key', { signer: 'b', agent: 'b.agent@PrompTugal.dinis', session: 'https://claude.ai/code/session_B', files: { 'team/keys.json': keysFile([[A, pa, SA], ['b.agent@PrompTugal.dinis', pb, 'https://claude.ai/code/session_B']]) } });
  expect('a commit that adds its own key and signs with it fails', base, 'not signed with a key published before it');
  fresh('t5'); commit('wrong agent', { agent: 'other@PrompTugal.dinis' }); expect('a commit whose Agent: is not its signer fails', base, 'but its Agent: is other@PrompTugal.dinis');
  fresh('t6'); commit('wrong session', { session: 'https://claude.ai/code/session_X' }); expect('a commit naming another session fails', base, 'Claude-Session: https://claude.ai/code/session_X is not the session');
  fresh('t7'); commit('short session', { session: 'session_A' }); expect('a session given without its full URL fails', base, 'Claude-Session: session_A is not the session');
  fresh('t8'); commit('good one'); commit('then unsigned', { sign: false }); commit('then good again'); expect('one bad commit refuses the whole range', base, 'then unsigned: not signed');
  fresh('t9side'); commit('side, wrong session', { session: 'https://claude.ai/code/session_X' }); const side = git('rev-parse', 'HEAD');
  fresh('t9'); commit('main side'); git('-c', `user.signingkey=${join(dir, 'a.pub')}`, '-c', 'commit.gpgsign=true', 'merge', '-q', '--no-ff', side, '-m', 'signed merge' + trailers(A, SA));
  expect('a bad commit on a merged side branch fails', base, 'side, wrong session: Claude-Session');
  fresh('t10side'); commit('side good'); const side2 = git('rev-parse', 'HEAD');
  fresh('t10'); commit('main good'); git('-c', 'commit.gpgsign=false', 'merge', '-q', '--no-ff', side2, '-m', 'unsigned merge' + trailers(A, SA));
  expect('an unsigned merge fails', base, 'unsigned merge: not signed with a key published before it');
  fresh('t11'); git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'ci commit');
  expect('a commit claiming to be CI by name is not exempt', base, 'ci commit: not signed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
if (failed) { console.error(`FAILED (${failed} of ${results.length} tests)`); process.exit(1); }
console.log(`OK (${results.length} tests)`);
