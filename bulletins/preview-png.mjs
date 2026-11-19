// /preview.png for social cards, rendered from /social.svg (the 1200 by 630 card) with the local Chromium (Playwright).
// Optional: if Playwright is not installed, the PNG is left as it was and this says so.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { ROOT } from './core.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('preview.png: Playwright not available, left unchanged'); process.exit(0); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(ROOT, 'src', 'social.svg')).href);
await page.screenshot({ path: join(ROOT, 'src', 'preview.png') });
await browser.close();
console.log('preview.png written');
