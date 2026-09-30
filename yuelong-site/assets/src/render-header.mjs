// Renders x-header.html to PNG at 1500×500 and 3000×1000 (2x, sharper on retina).
// Run from yuelong-site/: node assets/src/render-header.mjs [outDir]
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(HERE, '..');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
for (const scale of [1, 2]) {
  const p = await (await b.newContext({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: scale })).newPage();
  await p.goto('file://' + path.join(HERE, 'x-header.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const file = path.join(out, `yuelong-x-header${scale === 2 ? '@2x' : ''}.png`);
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1500, height: 500 } });
  console.log(file);
}
await b.close();
