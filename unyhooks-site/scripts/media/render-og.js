/* Renders scripts/media/og.html to og.png (1200×630), the image link previews
   show on X, Telegram and Discord.

     (cd unyhooks-site && python3 -m http.server 8765)
     node scripts/media/render-og.js */
const path = require('path');
const { chromium } = require('playwright');
const SITE = process.env.SITE || 'http://localhost:8765/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await page.goto(SITE + 'scripts/media/og.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(__dirname, '..', '..', 'og.png');
  await page.screenshot({ path: out });
  await browser.close();
  console.log(`wrote ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
