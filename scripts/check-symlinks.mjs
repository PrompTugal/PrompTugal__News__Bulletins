// Control 10, no symlinks (security@ ed70bd996, relayed by conductor.b@ 16:50 UTC 19 Nov 2026), with events.b@'s
// 44d5402 and library.b@'s LIB-2026-069 (43b0f38). Refuses:
//   (a) a symlink (mode 120000) added or changed in any commit of A..AFTER, merges included (diff-tree -m);
//   (b) a symlink in AFTER's own tree;
//   (c) a symlink anywhere in the checked-out tree, .git included (nothing is pruned);
//   (d) a symlink anywhere in each directory named after --site (the unpacked built site), nothing pruned.
// The only exceptions are entries in an exceptions file read from A's tree (the caller passes it), each
// {path, target, reason}: the path and the link's target must both match, as raw bytes, so a listed link cannot be
// re-pointed. Paths are read NUL-separated and compared whole, as bytes, never line by line or as decoded text.
// Usage: node check-symlinks.mjs A AFTER [--exceptions FILE] [--tree DIR] [--site DIR]...
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const [A, AFTER] = args;
const opt = (k) => args.flatMap((x, i) => (x === k ? [args[i + 1]] : []));
const HEX = /^[0-9a-f]{40}$/;
if (!HEX.test(A || '') || !HEX.test(AFTER || '')) { console.error('usage: check-symlinks.mjs A AFTER (full commit ids)'); process.exit(2); }
const tree = opt('--tree')[0] || process.cwd();
const git = (...a) => execFileSync('git', a, { cwd: tree, maxBuffer: 256 << 20, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } });

// Exceptions, from A (the caller reads them with git cat-file blob A:scripts/symlink-exceptions.json).
const exceptions = [];
for (const f of opt('--exceptions')) {
  if (!f || !existsSync(f)) continue;
  let list; try { list = JSON.parse(readFileSync(f, 'utf8')); } catch { console.error('the exceptions file does not parse'); process.exit(1); }
  for (const e of Array.isArray(list) ? list : list?.exceptions || []) {
    if (typeof e?.path !== 'string' || typeof e?.target !== 'string' || typeof e?.reason !== 'string' || !e.reason.trim()) { console.error('an exception lacks a path, a target or a reason'); process.exit(1); }
    exceptions.push({ path: Buffer.from(e.path, 'utf8'), target: Buffer.from(e.target, 'utf8') });
  }
}
const allowed = (path, target) => exceptions.some((e) => e.path.equals(path) && e.target.equals(target));

const bad = [];
const show = (b) => JSON.stringify(b.toString('latin1')).slice(0, 120);
const refuse = (where, path, target) => { if (!allowed(path, target)) bad.push(`${where}: ${show(path)} -> ${show(target)}`); };
const split0 = (buf) => { const out = []; let s = 0; for (let i = 0; i < buf.length; i++) if (buf[i] === 0) { out.push(buf.subarray(s, i)); s = i + 1; } if (s < buf.length) out.push(buf.subarray(s)); return out; };
const blob = (sha) => git('cat-file', 'blob', sha);

// (a) Every commit in A..AFTER. --raw -z gives ":old new oldsha newsha status\0path\0" (two paths for copies and
// renames, which --no-renames turns off); -m shows a merge against each parent; --root shows a first commit whole.
const commits = git('rev-list', '--reverse', `${A}..${AFTER}`).toString('latin1').split('\n').filter((x) => HEX.test(x));
for (const c of commits) {
  const parts = split0(git('diff-tree', '-r', '-z', '--raw', '-m', '--root', '--no-renames', '--no-commit-id', '--no-abbrev', c));
  for (let i = 0; i < parts.length; i++) {
    const head = parts[i].toString('latin1');
    if (!head.startsWith(':')) continue;
    const [, newMode, , newSha] = head.slice(1).split(' ');
    const path = parts[++i];
    if (newMode === '120000' && path) refuse(`commit ${c.slice(0, 12)}`, path, blob(newSha));
  }
}

// (b) AFTER's own tree.
for (const entry of split0(git('ls-tree', '-r', '-z', '--full-tree', AFTER))) {
  const tab = entry.indexOf(9); if (tab < 0) continue;
  const [mode, , sha] = entry.subarray(0, tab).toString('latin1').split(' ');
  if (mode === '120000') refuse('AFTER tree', entry.subarray(tab + 1), blob(sha));
}

// (c) and (d) Directories on disk, walked with lstat and raw names; nothing pruned, no link followed.
function walk(root, label) {
  const stack = [Buffer.alloc(0)];
  while (stack.length) {
    const rel = stack.pop();
    const abs = rel.length ? Buffer.concat([Buffer.from(root + '/'), rel]) : Buffer.from(root);
    for (const name of readdirSync(abs, { encoding: 'buffer' })) {
      const r = rel.length ? Buffer.concat([rel, Buffer.from('/'), name]) : name;
      const p = Buffer.concat([Buffer.from(root + '/'), r]);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) refuse(label, r, readlinkSync(p, { encoding: 'buffer' }));
      else if (st.isDirectory()) stack.push(r);
    }
  }
}
walk(tree, 'checkout');
for (const s of opt('--site')) { if (!s || !existsSync(s)) { console.error(`no site directory at ${s}`); process.exit(1); } walk(s, 'site'); }

if (bad.length) { console.error(`FAILED: ${bad.length} symlink(s) not in A's exceptions\n` + bad.slice(0, 50).join('\n')); process.exit(1); }
console.log(`OK (no symlinks outside A's ${exceptions.length} exception(s): ${commits.length} commits, AFTER's tree, the checkout${opt('--site').length ? ', the site' : ''})`);
