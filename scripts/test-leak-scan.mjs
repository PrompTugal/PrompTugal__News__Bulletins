// Tests for the leak scan's key rules (security@'s ruling, Website 1acd10498, relayed by conductor.b@ 19 Nov 05:14 UTC:
// "give each rule a test"). Every key-shaped string is built at run time, so this file holds none.
// Run: node scripts/test-leak-scan.mjs (prints OK or fails).
import { scanText } from './leak-scan.mjs';
import { randomBytes } from 'node:crypto';

const D = '-'.repeat(5);
const header = (kind) => `${D}BEGIN ${kind}PRIVATE KEY${D}`;
const b64 = (n) => randomBytes(n).toString('base64').replace(/=+$/, '');
const ed = () => 'ssh-' + 'ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI' + b64(33).slice(0, 43);
const rsa = () => 'ssh-' + 'rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ' + b64(200);
const ecdsa = () => 'ecdsa-' + 'sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTY' + b64(80);
const keysLine = (k) => `  "ssh_public_key": "${k}",`;
const kinds = (path, text) => scanText(path, text).map((f) => f.kind);
const results = [];
function expect(name, got, want) {
  const ok = want === 'clean' ? got.length === 0 : got.includes(want);
  results.push(`${ok ? 'pass' : 'FAIL'}  ${name}${ok ? '' : ` (wanted ${want}; got ${JSON.stringify(got)})`}`);
}

const PRIV = 'private key block';
for (const k of ['OPENSSH ', 'RSA ', 'EC ', 'DSA ', 'ENCRYPTED ', ''])
  for (const f of ['README.md', 'team/keys.json', 'bulletins/sitesbar.mjs'])
    expect(`a ${k || 'plain '}PRIVATE KEY header fails in ${f}`, kinds(f, `x\n${header(k)}\n`), PRIV);

const PUB = 'ssh public key outside its published field';
expect('an ssh-ed25519 key in its published field passes', kinds('team/keys.json', `{\n${keysLine(ed())}\n}\n`), 'clean');
expect('an ssh-ed25519 key in another field of team/keys.json fails', kinds('team/keys.json', `{\n  "note": "${ed()}"\n}\n`), PUB);
expect('an ssh-ed25519 key in the published field name of another file fails', kinds('REALITY.md', keysLine(ed())), PUB);
expect('an ssh-ed25519 key in code fails', kinds('bulletins/core.mjs', `const k = '${ed()}';`), PUB);
expect('an ssh-rsa key fails, even in team/keys.json', kinds('team/keys.json', keysLine(rsa())), PUB);
expect('an ecdsa key fails in a status file', kinds('board/team/bulletins/status.json', `"k": "${ecdsa()}"`), PUB);
for (const [name, k] of [
  ['ecdsa-sha2-nistp384', 'ecdsa-' + 'sha2-nistp384 AAAAE2VjZHNhLXNoYTItbmlzdHAzODQ' + b64(100)],
  ['ecdsa-sha2-nistp521', 'ecdsa-' + 'sha2-nistp521 AAAAE2VjZHNhLXNoYTItbmlzdHA1MjE' + b64(130)],
  ['sk-ssh-ed25519@openssh.com', 'sk-' + 'ssh-ed25519@openssh.com AAAAGnNrLXNzaC1' + 'lZDI1NTE5QG9wZW5zc2guY29t' + b64(60)],
  ['sk-ecdsa-sha2-nistp256@openssh.com', 'sk-' + 'ecdsa-sha2-nistp256@openssh.com AAAAInNrLWVjZHNh' + 'LXNoYTItbmlzdHAy' + 'NTZAb3BlbnNzaC5jb20' + b64(90)],
]) {
  expect(`an ${name} key fails in its published field`, kinds('team/keys.json', keysLine(k)), PUB);
  expect(`an ${name} key fails in code`, kinds('bulletins/core.mjs', `const k = '${k}';`), PUB);
}
expect('a key line with a comment after it fails', kinds('team/keys.json', `  "ssh_public_key": "${ed()} me@host",`), PUB);
expect('the words ssh-ed25519 without a key pass', kinds('README.md', 'Commits are signed with an ssh-ed25519 key.'), 'clean');

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
if (failed) { console.error(`FAILED (${failed} of ${results.length} tests)`); process.exit(1); }
console.log(`OK (${results.length} tests)`);
