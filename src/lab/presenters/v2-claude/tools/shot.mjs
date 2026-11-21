// Developer tool: screenshots of dev.html for looking at the models. Run: node tools/shot.mjs '<json list of shots>'
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url)), SRC = join(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url); let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const shots = JSON.parse(process.argv[2]), W = +(process.argv[3] || 1920), H = +(process.argv[4] || 1080), page0 = process.argv[5] || 'dev.html';
const srv = spawn('python3', ['-m', 'http.server', '8797', '--bind', '127.0.0.1'], { cwd: SRC, stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 700));
  const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); }); p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)));
  await p.goto(`http://127.0.0.1:8797/lab/presenters/v2-claude/${page0}?w=${W}&h=${H}${process.argv[6] ? '&' + process.argv[6] : ''}`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  for (const s of shots) { const t0 = Date.now(); if (s.cues) await p.evaluate((c) => window.setCues(c), s.cues); if (s.T) s.t = await p.evaluate(([id, f]) => window.durOf(id) * f, [s.focus, +s.T]); await p.evaluate((o) => window.shot(o), s); await (await p.$('#c')).screenshot({ path: s.out }); console.log(s.out, Date.now() - t0, 'ms'); }
  await b.close();
} finally { srv.kill(); }
