import { chromium } from 'playwright';
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); if (m.type() === 'warning' && /storm/i.test(m.text())) errs.push(m.text()); });
await page.goto('http://localhost:8090/');
await page.locator('.coin-card').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
// frame time in this software-rendered browser
const ft = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 10) requestAnimationFrame(f); else res((performance.now() - t0) / 10); }; requestAnimationFrame(f); }));
console.log('avg frame ms (software GL):', ft.toFixed(1));
await page.evaluate(() => { const s = window.__storm; s.stop(); const t = performance.now(); s.renderAt(t); });
await page.screenshot({ path: `${OUT}/1-still.png` });
const t = await page.evaluate(() => { const s = window.__storm; const t = performance.now(); s.strike(330, 640); return t; });
for (const [name, ms] of [['2-leader', 40], ['3-stroke', 125], ['4-restrike', 230], ['5-fade', 420]]) {
  await page.evaluate((at) => window.__storm.renderAt(at), t + ms);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
await page.evaluate((at) => window.__storm.renderAt(at), t + 3000);
await page.screenshot({ path: `${OUT}/6-drops-left.png`, clip: { x: 0, y: 330, width: 280, height: 470 } });
await page.screenshot({ path: `${OUT}/7-drops-right.png`, clip: { x: 1160, y: 330, width: 280, height: 470 } });
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
