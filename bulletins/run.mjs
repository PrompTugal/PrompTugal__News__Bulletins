// The whole pipeline, in order: collect (facts), write (script), check (inside write), render.
// Usage: MAIN_REPO=/path/to/PrompTugal__News__Website node bulletins/run.mjs [--no-model]
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readJSON } from './core.mjs';
import { writeAll } from './write.mjs';
import { renderAll, renderHow, renderPreview } from './render.mjs';
import { PAGES } from './pages.mjs';

execFileSync(process.execPath, [join(ROOT, 'bulletins', 'collect.mjs')], { stdio: 'inherit', env: process.env });
const facts = readJSON(join(ROOT, 'data', 'facts', 'latest.json'));
const scripts = process.argv.includes('--no-model')
  ? Object.fromEntries(Object.keys(PAGES).map((p) => [p, readJSON(join(ROOT, 'data', 'scripts', `${p}.json`), {})]))
  : await writeAll(facts);
renderAll(facts, scripts);
renderHow();
renderPreview(facts, scripts);
execFileSync(process.execPath, [join(ROOT, 'bulletins', 'preview-png.mjs')], { stdio: 'inherit' });
console.log('rendered src/');
