// Renders the pixel-art background in paint.html to ../great-wall.png.
//   node assets/src/render.mjs            (needs playwright; set $CHROMIUM to use a local browser)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(join(here, 'paint.html')).href);

// paintNight / paintDay (the New York skylines) are still in paint.html; add them here to export.
for (const [fn, out] of [['paintWall', 'great-wall.png']]) {
  const url = await page.evaluate((f) => window[f](), fn);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(here, '..', out), buf);
  console.log(out, Math.round(buf.length / 1024) + ' KB');
}
await browser.close();
