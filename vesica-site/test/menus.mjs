import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
await useLocalFonts(p);
const ok = (n, c) => console.log((c ? '  ok  ' : ' FAIL ') + n);
const open = () => p.evaluate(() => {
  const m = document.querySelector('.mnu.on');
  return m ? m.querySelector('.mnu-btn').textContent.trim().split('\n')[0] : null;
});
await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const click = t => p.locator('.mnu-btn', { hasText: t }).click();

await click('Products'); await p.waitForTimeout(250);
ok('click opens a menu', await open() === 'Products');
await click('Products'); await p.waitForTimeout(250);
ok('clicking it again closes it', await open() === null);

await click('Products'); await p.waitForTimeout(250);
await click('Resources'); await p.waitForTimeout(250);
ok('clicking a second menu switches to it', await open() === 'Resources');
await click('Swap'); await p.waitForTimeout(250);
ok('and on to the quick trade', await open() === 'Swap');
await click('Swap'); await p.waitForTimeout(250);
ok('a second click on it still closes', await open() === null);

await click('Resources'); await p.waitForTimeout(200);
await p.mouse.move(40, 400); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(250);
ok('a click outside closes', await open() === null);
await click('Resources'); await p.waitForTimeout(200);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('Escape closes', await open() === null);
await b.close();
