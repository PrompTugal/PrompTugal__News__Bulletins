// The whole pipeline, in order: collect (facts), write (script), check (inside write), render.
// Usage: MAIN_REPO=/path/to/PrompTugal__News__Website node bulletins/run.mjs [--no-model]
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readJSON } from './core.mjs';
import { writeAll } from './write.mjs';
import { renderAll, renderHow, renderPreview, setBar } from './render.mjs';
import { loadBar } from './sitesbar.mjs';
import { checkMap } from './map.mjs';
import { PAGES } from './pages.mjs';
import { keepPredictions } from './predictions.mjs';
import { keepOutcomes } from './outcomes.mjs';

execFileSync(process.execPath, [join(ROOT, 'bulletins', 'collect.mjs')], { stdio: 'inherit', env: process.env });
const facts = readJSON(join(ROOT, 'data', 'facts', 'latest.json'));
const scripts = process.argv.includes('--no-model')
  ? Object.fromEntries(Object.keys(PAGES).map((p) => [p, readJSON(join(ROOT, 'data', 'scripts', `${p}.json`), {})]))
  : await writeAll(facts);
keepPredictions();
await keepOutcomes();
setBar(await loadBar());
await checkMap(); // stops the build if a vendored map file does not match its pin
renderAll(facts, scripts);
renderHow();
renderPreview(facts, scripts);
execFileSync(process.execPath, [join(ROOT, 'bulletins', 'preview-png.mjs')], { stdio: 'inherit' });
console.log('rendered src/');
