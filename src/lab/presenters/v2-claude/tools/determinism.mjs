// The determinism check the brief asks for: render t = 0, 7.3 and 42.0 twice each, every render in its own browser
// launch, and compare SHA-256 hashes of the PNGs. Run: node tools/determinism.mjs [width] [height]
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), SRC = resolve(HERE, '..', '..', '..', '..');
const require = createRequire(import.meta.url); let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const W = +(process.argv[2] || 1920), H = +(process.argv[3] || 1080), TIMES = [0, 7.3, 42.0];
const srv = spawn('python3', ['-m', 'http.server', '8794', '--bind', '127.0.0.1'], { cwd: SRC, stdio: 'ignore' });
async function shot(t) { // one launch, one frame: nothing can leak from one render into the next
  const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8794/lab/presenters/v2-claude/index.html?export=1'); await p.waitForFunction(() => window.showcaseReady === true, null, { timeout: 120000 });
  await p.evaluate((x) => window.renderAt(x), t); const png = await (await p.$('#frame')).screenshot(); await b.close();
  return createHash('sha256').update(png).digest('hex');
}
let ok = true;
try {
  await new Promise((r) => setTimeout(r, 800));
  console.log(`| t (s) | first launch | second launch | same |\n|---|---|---|---|`);
  for (const t of TIMES) { const a = await shot(t), b = await shot(t); if (a !== b) ok = false; console.log(`| ${t} | ${a.slice(0, 16)} | ${b.slice(0, 16)} | ${a === b ? 'yes' : 'NO'} |`); }
} finally { srv.kill(); }
console.log(ok ? `OK: all ${TIMES.length} times gave identical ${W}x${H} PNGs in separate launches` : 'FAILED: at least one time differed');
process.exit(ok ? 0 : 1);
