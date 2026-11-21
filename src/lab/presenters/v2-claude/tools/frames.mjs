// Developer tool: still frames of a page at chosen times. Run: node tools/frames.mjs "0,7.3,42" [width] [height] [outDir] [page] [query]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url)), SRC = join(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url); let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const times = process.argv[2].split(',').map(Number), W = +(process.argv[3] || 1920), H = +(process.argv[4] || 1080), out = process.argv[5] || '/tmp/frames', page0 = process.argv[6] || 'index.html', query = process.argv[7] || '';
mkdirSync(out, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', '8795', '--bind', '127.0.0.1'], { cwd: SRC, stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 700));
  const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 300)); }); p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)));
  await p.goto(`http://127.0.0.1:8795/lab/presenters/v2-claude/${page0}?export=1${query ? '&' + query : ''}`);
  await p.waitForFunction(() => window.showcaseReady === true, null, { timeout: 90000 });
  const frame = await p.$('#frame');
  for (const t of times) { const t0 = Date.now(); await p.evaluate((x) => window.renderAt(x), t); await frame.screenshot({ path: join(out, `t${t.toFixed(2).padStart(6, '0')}.png`) }); console.log(t, Date.now() - t0, 'ms'); }
  await b.close();
} finally { srv.kill(); }
