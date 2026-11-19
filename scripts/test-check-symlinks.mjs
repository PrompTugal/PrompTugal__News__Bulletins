// Tests for control 10 (scripts/check-symlinks.mjs), in throwaway repositories. Run: node scripts/test-check-symlinks.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, symlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'check-symlinks.mjs');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
let n = 0, failed = 0;
function repo() {
  const d = mkdtempSync(join(tmpdir(), 'symlinks-'));
  const g = (...a) => execFileSync('git', a, { cwd: d, env: ENV, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'dev'); g('config', 'commit.gpgsign', 'false');
  writeFileSync(join(d, 'a.txt'), 'a\n'); g('add', '-A'); g('commit', '-qm', 'base');
  return { d, g, head: () => g('rev-parse', 'HEAD') };
}
function run(r, A, extra = []) { return spawnSync(process.execPath, [CHECK, A, r.head(), '--tree', r.d, ...extra], { encoding: 'utf8' }); }
function expect(name, res, ok) {
  n++;
  if ((res.status === 0) !== ok) { failed++; console.log(`FAIL ${name}: status ${res.status}\n${res.stdout}${res.stderr}`); }
}
const exFile = (r, list) => { const f = join(r.d, '..', `ex-${Math.random().toString(36).slice(2)}.json`); writeFileSync(f, JSON.stringify(list)); return f; };

// 1. No symlink: passes.
{ const r = repo(); const A = r.head(); writeFileSync(join(r.d, 'b.txt'), 'b'); r.g('add', '-A'); r.g('commit', '-qm', 'b'); expect('no symlink', run(r, A), true); }
// 2. A pushed symlink fails.
{ const r = repo(); const A = r.head(); symlinkSync('a.txt', join(r.d, 'link')); r.g('add', '-A'); r.g('commit', '-qm', 'l'); expect('pushed symlink', run(r, A), false); }
// 3. A listed one passes (exceptions from A, path and target match).
{ const r = repo(); const A = r.head(); symlinkSync('a.txt', join(r.d, 'link')); r.g('add', '-A'); r.g('commit', '-qm', 'l');
  expect('listed symlink', run(r, A, ['--exceptions', exFile(r, [{ path: 'link', target: 'a.txt', reason: 'test' }])]), true); }
// 4. One listed only in the pushed tree fails (the caller reads exceptions from A; A has none).
{ const r = repo(); const A = r.head(); symlinkSync('a.txt', join(r.d, 'link'));
  writeFileSync(join(r.d, 'symlink-exceptions.json'), JSON.stringify([{ path: 'link', target: 'a.txt', reason: 'mine' }])); r.g('add', '-A'); r.g('commit', '-qm', 'l');
  const fromA = spawnSync('git', ['cat-file', '-e', `${A}:symlink-exceptions.json`], { cwd: r.d }).status === 0;
  expect('listed only in the pushed tree', run(r, A, fromA ? ['--exceptions', join(r.d, 'symlink-exceptions.json')] : []), false); }
// 5. A listed link re-pointed fails (the target is pinned).
{ const r = repo(); const A = r.head(); symlinkSync('/etc/passwd', join(r.d, 'link')); r.g('add', '-A'); r.g('commit', '-qm', 'l');
  expect('re-pointed link', run(r, A, ['--exceptions', exFile(r, [{ path: 'link', target: 'a.txt', reason: 'test' }])]), false); }
// 6. A file name with a newline cannot pass as a listed name.
{ const r = repo(); const A = r.head(); symlinkSync('a.txt', join(r.d, 'ok\nlink')); r.g('add', '-A'); r.g('commit', '-qm', 'l');
  expect('newline in the name', run(r, A, ['--exceptions', exFile(r, [{ path: 'ok', target: 'a.txt', reason: 't' }, { path: 'link', target: 'a.txt', reason: 't' }])]), false); }
// 7. A symlink added in a merge commit, then removed again, fails (seen in the merge, not only the final tree).
{ const r = repo(); const A = r.head(); r.g('checkout', '-qb', 'side'); writeFileSync(join(r.d, 's.txt'), 's'); r.g('add', '-A'); r.g('commit', '-qm', 's');
  r.g('checkout', '-q', 'dev'); writeFileSync(join(r.d, 'd.txt'), 'd'); r.g('add', '-A'); r.g('commit', '-qm', 'd');
  r.g('merge', '-q', '--no-commit', 'side'); symlinkSync('a.txt', join(r.d, 'mlink')); r.g('add', '-A'); r.g('commit', '-qm', 'merge');
  rmSync(join(r.d, 'mlink')); r.g('add', '-A'); r.g('commit', '-qm', 'gone');
  expect('symlink added in a merge', run(r, A), false); }
// 8. A symlink added and removed in the range fails (every commit is read).
{ const r = repo(); const A = r.head(); symlinkSync('a.txt', join(r.d, 'link')); r.g('add', '-A'); r.g('commit', '-qm', 'l');
  rmSync(join(r.d, 'link')); r.g('add', '-A'); r.g('commit', '-qm', 'gone'); expect('added then removed', run(r, A), false); }
// 9. A non-UTF-8 name is compared as bytes: an exception for its decoded form does not match.
{ const r = repo(); const A = r.head(); const name = Buffer.from([0x6c, 0xff, 0x6b]);
  symlinkSync('a.txt', Buffer.concat([Buffer.from(r.d + '/'), name])); r.g('add', '-A'); r.g('commit', '-qm', 'l');
  expect('non-UTF-8 name', run(r, A, ['--exceptions', exFile(r, [{ path: 'l�k', target: 'a.txt', reason: 't' }])]), false); }
// 10. A symlink in the built site fails, even inside a directory named .git.
{ const r = repo(); const A = r.head(); const site = mkdtempSync(join(tmpdir(), 'site-')); mkdirSync(join(site, 'x', '.git'), { recursive: true });
  symlinkSync('/etc/passwd', join(site, 'x', '.git', 'config')); expect('symlink in the site, under .git', run(r, A, ['--site', site]), false); }
// 11. A symlink only in the checkout (not committed) fails.
{ const r = repo(); const A = r.head(); symlinkSync('a.txt', join(r.d, 'loose')); expect('symlink in the checkout', run(r, A), false); }
// 12. An exception without a reason is refused.
{ const r = repo(); const A = r.head(); expect('exception without a reason', run(r, A, ['--exceptions', exFile(r, [{ path: 'x', target: 'y', reason: '' }])]), false); }
// 13. A symlink inside the checkout's .git is found too (nothing pruned).
{ const r = repo(); const A = r.head(); symlinkSync('/etc/passwd', join(r.d, '.git', 'evil')); expect('symlink under .git', run(r, A), false); }

console.log(failed ? `FAILED (${failed} of ${n} tests)` : `OK (${n} tests)`);
process.exit(failed ? 1 : 0);
