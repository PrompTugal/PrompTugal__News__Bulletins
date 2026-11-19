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
// As release.sh and CI run it (control 7): the checker is taken from the base commit with git show, never from HEAD.
function check(base) {
  const file = join(dir, 'trusted-check-signatures.mjs');
  writeFileSync(file, git('show', `${base}:scripts/check-signatures.mjs`));
  const r = spawnSync(process.execPath, [file, base, 'HEAD'], { cwd: repo, encoding: 'utf8' });
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
  // Control 6: an orphan commit (no parent) that brings its own keys, signed by them, is refused, even with an old date.
  fresh('t12'); git('checkout', '-q', '--orphan', 'orphan');
  commit('orphan with its own keys', { signer: 'b', agent: 'b.agent@PrompTugal.dinis', session: 'https://claude.ai/code/session_B', files: { 'team/keys.json': keysFile([['b.agent@PrompTugal.dinis', pb, 'https://claude.ai/code/session_B']]) } });
  const orphan = git('rev-parse', 'HEAD');
  fresh('t12m'); git('-c', `user.signingkey=${join(dir, 'a.pub')}`, '-c', 'commit.gpgsign=true', 'merge', '-q', '-s', 'ours', '--allow-unrelated-histories', '--no-ff', orphan, '-m', 'merge an orphan' + trailers(A, SA));
  expect('an orphan commit carrying its own keys is refused', base, 'orphan with its own keys: a commit with no parent, and not the trust anchor');
  fresh('t13'); git('checkout', '-q', '--orphan', 'orphan-old');
  run('git', ['-c', `user.signingkey=${join(dir, 'b.pub')}`, '-c', 'commit.gpgsign=true', 'commit', '-q', '--allow-empty', '-m', 'backdated orphan' + trailers('b.agent@PrompTugal.dinis', 'https://claude.ai/code/session_B')], { env: { ...process.env, GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2001-01-01T00:00:00Z' } });
  const old = git('rev-parse', 'HEAD');
  fresh('t13m'); git('-c', `user.signingkey=${join(dir, 'a.pub')}`, '-c', 'commit.gpgsign=true', 'merge', '-q', '-s', 'ours', '--allow-unrelated-histories', '--no-ff', old, '-m', 'merge a backdated orphan' + trailers(A, SA));
  expect('a backdated orphan is not skipped as older than the check', base, 'backdated orphan: a commit with no parent, and not the trust anchor');
  // Control 7: a push that replaces the checker with one that always passes is still checked by the base's copy.
  fresh('t14'); commit('tamper with the checker', { sign: false, files: { 'scripts/check-signatures.mjs': "console.log('OK'); process.exit(0);\n" } });
  expect('a pushed commit cannot replace its own checker', base, 'tamper with the checker: not signed');
  // The CI rule (security@, 14:17 and 14:26): the checker comes from A, the last commit a passing run verified (the head
  // of this workflow's latest successful push run on dev); refuse a missing A, an A that is not an ancestor of AFTER, and an A without the checker;
  // check A..AFTER. ciRun mirrors .github/workflows/pages.yml (whose text the wiring test below asserts).
  const ciRun = (before, after) => {
    if (!/^[0-9a-f]{40}$/.test(String(before))) return { code: 1, out: 'no verified anchor A' };
    if (spawnSync('git', ['merge-base', '--is-ancestor', before, after], { cwd: repo }).status !== 0) return { code: 1, out: 'A is not an ancestor of AFTER' };
    const show = spawnSync('git', ['show', `${before}:scripts/check-signatures.mjs`], { cwd: repo, encoding: 'utf8' });
    if (show.status !== 0) return { code: 1, out: 'no checker in A' };
    writeFileSync(join(dir, 'ci-check.mjs'), show.stdout);
    const r = spawnSync(process.execPath, [join(dir, 'ci-check.mjs'), before, after], { cwd: repo, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const ciExpect = (name, r, want) => results.push(`${r.code === 1 && r.out.includes(want) ? 'pass' : 'FAIL'}  ${name}${r.code === 1 && r.out.includes(want) ? '' : ` (got ${r.code}: ${r.out.slice(0, 80)})`}`);
  fresh('t17'); commit('good after'); ciExpect('a missing A (no successful run) fails', ciRun('', 'HEAD'), 'no verified anchor A');
  fresh('t18side'); commit('elsewhere'); const elsewhere = git('rev-parse', 'HEAD');
  fresh('t18'); commit('force-pushed'); ciExpect('A not an ancestor of AFTER (a force push) fails', ciRun(elsewhere, 'HEAD'), 'not an ancestor');
  fresh('t19'); git('rm', '-q', 'scripts/check-signatures.mjs'); commit('a release without the checker'); const noChecker = git('rev-parse', 'HEAD'); commit('next push');
  ciExpect('an A with no checker (a missing release copy) fails, with no fallback', ciRun(noChecker, 'HEAD'), 'no checker in A');
  // A dropped run: A is verified, BEFORE (the dropped push's head) was never checked; its unsigned commit is in A..AFTER.
  fresh('t20'); const verified = git('rev-parse', 'HEAD'); commit('unsigned, from a dropped run', { sign: false }); commit('the surviving push');
  ciExpect('an unsigned commit from a dropped run (between A and BEFORE) fails', ciRun(verified, 'HEAD'), 'unsigned, from a dropped run: not signed');
  // A pushed tag on an unverified commit is never used: the anchor is read from the deployment record, not from tags.
  fresh('t21'); commit('unverified, tagged', { sign: false }); git('tag', 'v0.1.999');
  ciExpect('a pushed tag on an unverified commit is not used as the anchor', ciRun(base, 'HEAD'), 'unverified, tagged: not signed');
  // Control 8: a commit that deletes the checker and adds an unsigned change is still checked, and fails.
  fresh('t15'); git('rm', '-q', 'scripts/check-signatures.mjs'); commit('delete the checker and slip in a change', { sign: false, files: { 'x.txt': 'x\n' } });
  expect('a commit that removes the checker and adds an unsigned change fails', base, 'delete the checker and slip in a change: not signed');
  // Control 6: the check refuses a shallow clone (it hides parents).
  fresh('t16'); commit('good, in a shallow clone');
  execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 't16', `file://${repo}`, join(dir, 'shallow')]);
  writeFileSync(join(dir, 'shallow-check.mjs'), git('show', `${base}:scripts/check-signatures.mjs`));
  const sh = spawnSync(process.execPath, [join(dir, 'shallow-check.mjs'), 'HEAD~0', 'HEAD'], { cwd: join(dir, 'shallow'), encoding: 'utf8' });
  results.push(`${sh.status === 1 && /a shallow clone/.test(sh.stderr) ? 'pass' : 'FAIL'}  the check refuses a shallow clone`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
// Comments are removed first, so a comment can never satisfy a wiring test (library.b@'s finding): only real lines count.
const uncomment = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).map((l) => l.replace(/\s+#\s.*$/, '')).join('\n');
// Controls 7 and 9 in the real wiring. release.sh takes every security check from origin/dev. The Pages workflow runs
// them in their own 'checks' job, which runs no pushed code: each checker comes from A (the head of the latest
// successful push run of this workflow on dev, from GitHub's API), with GIT_NO_REPLACE_OBJECTS set, NODE_OPTIONS cleared, regular files only
// and an absolute node; the site comes in as an artifact. Deploy and tag need that job. A GITHUB_ENV written by a
// pushed build step lives in the build job only, so it cannot change the result (security@'s test for control 9).
{
  const t = uncomment(readFileSync(join(HERE, 'release.sh'), 'utf8'));
  const ok = /git show "origin\/dev:scripts\/\$1\.mjs" > "scripts\/\$1\.trusted\.mjs"/.test(t) && /trusted leak-scan; trusted check-commits; trusted check-signatures/.test(t)
    && ['leak-scan', 'check-commits', 'check-signatures'].every((c) => new RegExp(`node scripts/${c}\\.trusted\\.mjs`).test(t)) && !/node scripts\/(leak-scan|check-commits|check-signatures)\.mjs/.test(t);
  results.push(`${ok ? 'pass' : 'FAIL'}  release.sh runs every security check from the last release's copy, never the pushed tree's`);
}
{
  const w = uncomment(readFileSync(join(HERE, '../.github/workflows/pages.yml'), 'utf8'));
  const job = (name) => { const m = w.match(new RegExp(`\n  ${name}:\n([\\s\\S]*?)(?=\n  [a-z]+:\n|$)`)); return m ? m[1] : ''; };
  const checks = job('checks'), build = job('build'), deploy = job('deploy'), tag = job('tag');
  const ok9 = /needs: build/.test(checks) && /GIT_NO_REPLACE_OBJECTS: '1'/.test(checks) && /NODE_OPTIONS: ''/.test(checks)
    && /actions\/workflows\/pages\.yml\/runs\?branch=dev&event=push&status=success/.test(checks) && /\.conclusion == "success"/.test(checks) && !/deployments/.test(checks) && /no verified anchor A/.test(checks) && /git merge-base --is-ancestor "\$A" "\$AFTER" \|\| \{/.test(checks)
    && /git show "\$A:scripts\/check-signatures\.mjs" > "\$RUNNER_TEMP\/check-signatures\.mjs"/.test(checks) && /git show "\$A:scripts\/check-commits\.mjs" > "\$RUNNER_TEMP\/check-commits\.mjs"/.test(checks)
    && /git show "\$A:scripts\/leak-scan\.mjs" > scripts\/leak-scan\.trusted\.mjs/.test(checks) && /case "\$mode" in 100644\|100755\)/.test(checks) && /case "\$NODE" in \/\*\)/.test(checks)
    && /actions\/download-artifact@v4/.test(checks) && !/node scripts\/(?!leak-scan\.trusted)/.test(checks) && !/uses: \.\//.test(checks) && !/git describe|--tags/.test(checks);
  results.push(`${ok9 ? 'pass' : 'FAIL'}  pages.yml: the checks job runs no pushed code and takes every checker from A`);
  const okGate = /needs: \[build, checks\]/.test(deploy) && /needs\.checks\.result == 'success'/.test(tag) && !/node scripts\/(check-signatures|check-commits|leak-scan)(\.trusted)?\.mjs/.test(build);
  results.push(`${okGate ? 'pass' : 'FAIL'}  pages.yml: deploy and tag need the checks job, and the build job (pushed code, GITHUB_ENV) runs no security check`);
  // The site is vetted and unpacked before any trusted copy is written (events.b@), and configs come from A (signals.b@).
  const iTar = checks.indexOf('tar -xf'), iFirstCopy = checks.indexOf('git show "$A:scripts/');
  const okTar = /tar -tvf/.test(checks) && /grep -Ev '\^\[-d\]'/.test(checks) && /find _site -type l/.test(checks) && iTar > 0 && iFirstCopy > iTar;
  results.push(`${okTar ? 'pass' : 'FAIL'}  pages.yml: the site archive is vetted and unpacked before any trusted copy is written, then checked for symlinks`);
  const okCfg = /git show "\$A:scripts\/commit-exemptions\.json" > scripts\/commit-exemptions\.json/.test(checks) && /rm -f scripts\/commit-exemptions\.json/.test(checks);
  results.push(`${okCfg ? 'pass' : 'FAIL'}  pages.yml: the trailer check's exemptions come from A, never the pushed tree`);
}
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
if (failed) { console.error(`FAILED (${failed} of ${results.length} tests)`); process.exit(1); }
console.log(`OK (${results.length} tests)`);
