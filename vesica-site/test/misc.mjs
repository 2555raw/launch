import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/TUNNEL|ERR_|coingecko/i.test(m.text())) errs.push('console: ' + m.text()); });
await useLocalFonts(p);
const ok = (n, c) => console.log((c ? '  ok  ' : ' FAIL ') + n);

console.log('— docs —');
await p.goto('http://127.0.0.1:8931/docs.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const toc = await p.locator('.dx-toc a').count();
console.log('   TOC entries:', toc);
await p.locator('.dx-toc a').nth(4).click(); await p.waitForTimeout(700);
const y = await p.evaluate(() => scrollY);
ok('a TOC link scrolls the page', y > 200);
ok('the TOC marks where you are', await p.locator('.dx-toc a.on').count() === 1);
const crows = await p.locator('#contracts a, .dx-tr a').count();
console.log('   contract rows linking out:', crows);
await p.locator('#contracts a, .dx-tr a').first().click(); await p.waitForTimeout(900);
console.log('   landed:', p.url());
// the rows now land on the vault's own page rather than on a filtered list
ok('a contract row opens its vault', /vault\.html\?v=/.test(p.url()));
ok('and the page is that vault', (await p.locator('#vp-title').textContent()).includes('USDG / x'));
ok('with its figures filled', (await p.locator('#vp-apr').textContent()).trim() !== '—');
ok('and a chart drawn', await p.locator('#vp-svg .vp-line').count() === 1);
console.log('   landed on:', (await p.locator('#vp-title').textContent()).trim(),
            '| APR', (await p.locator('#vp-apr').textContent()).trim());

console.log('— the nav quick trade —');
await p.goto('http://127.0.0.1:8931/docs.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
await p.locator('.mnu-btn', { hasText: 'Swap' }).click(); await p.waitForTimeout(350);
ok('it opens on a page that is not the desk', await p.locator('#qt-out').isVisible());
console.log('   1 ETH ->', (await p.locator('#qt-out').textContent()).trim(),
            '|', (await p.locator('#qt-route').textContent()).trim());
ok('it quotes a number', parseFloat((await p.locator('#qt-out').textContent()).replace(/[^0-9.]/g,'')) > 0);

console.log('— the other dropdowns —');
await p.locator('.mnu-btn', { hasText: 'Products' }).click(); await p.waitForTimeout(250);
ok('Products opens', await p.locator('.mnu.on .mnu-pop a').first().isVisible());
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('Escape closes it', await p.locator('.mnu.on').count() === 0);

console.log('— legal —');
for (const f of ['terms.html', 'risk.html', 'privacy.html']) {
  await p.goto('http://127.0.0.1:8931/' + f, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const n = await p.locator('.cs-legal-toc a').count();
  await p.locator('.cs-legal-toc a').nth(2).click().catch(() => {});
  await p.waitForTimeout(500);
  console.log(`   ${f.padEnd(13)} contents: ${n} | scrolled to ${await p.evaluate(() => Math.round(scrollY))}`);
}

console.log('— the footer —');
await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(500);
ok('the status bar is filled', (await p.locator('.ft-bar').innerText()).includes('Robinhood'));
console.log('   status:', (await p.locator('.ft-bar').innerText()).replace(/\n+/g, ' · ').slice(0, 110));
const sv = await p.locator('.ft-cubes svg').boundingBox();
await p.mouse.move(5, 5); await p.waitForTimeout(100);
await p.mouse.move(sv.x + sv.width * .45, Math.min(sv.y + sv.height * 0.5, 960), { steps: 8 });
await p.waitForTimeout(250);
ok('a cube lights under the pointer', await p.locator('.ft-cubes .cube.on').count() === 1);

console.log('\nerrors:', errs.length ? errs : 'none');
await b.close();
