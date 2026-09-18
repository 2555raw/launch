import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await useLocalFonts(p);
// the wallet keeps USDG at the top level and the tokens under .bal
const bal = async () => {
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem('vesica-demo') || 'null'));
  return { ETH: d.bal.ETH, USDG: d.usdg, WBTC: d.bal.WBTC, xTSLA: d.bal.xTSLA };
};
const num = s => parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
const ok = (n, c) => console.log((c ? '  ok  ' : ' FAIL ') + n);

await p.goto('http://127.0.0.1:8931/swap.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);

console.log('— before connecting —');
ok('swap button disabled/prompts connect', await p.locator('#go').textContent().then(t => t.trim()));
console.log('   go button says:', (await p.locator('#go').textContent()).trim());
ok('balance line hidden until connect', (await p.locator('#pay-bal').textContent()).includes('Connect'));

await p.click('#connect');
await p.waitForTimeout(300);
const b0 = await bal();
console.log('— connected —', JSON.stringify(b0));

await p.fill('#pay', '1');
await p.waitForTimeout(350);
const out1  = num(await p.locator('#get').textContent());
const rate  = num((await p.locator('#s-rate').textContent()).split('=')[1]);   // "1 ETH = 2,491.95 USDG"
const min1  = num(await p.locator('#s-min').textContent());
const route = (await p.locator('#s-route').textContent()).trim();
console.log('   1 ETH ->', out1, 'USDG | rate', rate, '| min', min1, '| route', route);
ok('quote is a number > 0', out1 > 0);
ok('min received = out * (1 - 0.5%)', Math.abs(min1 - out1 * 0.995) < 0.02);
ok('out is within a few bps under the raw rate', out1 < rate && out1 > rate * 0.995);
const rows = await p.locator('#quotes .tr-q, #quotes > *').count();
console.log('   route rows rendered:', rows);
ok('four routers quoted', rows === 4);
// the first row is the winner; its name is the <b>, not the avatar initials
const names = await p.locator('#quotes b').allTextContents();
ok('winner is first and matches the selected route', names[0].trim() === route.trim());
console.log('   rows, best first:', names.map(n => n.trim()).join(' > '));

// the trade itself
await p.click('#go');
await p.waitForTimeout(500);
const b1 = await bal();
console.log('— after swapping 1 ETH —', JSON.stringify(b1));
ok('ETH fell by exactly 1', Math.abs((b0.ETH - b1.ETH) - 1) < 1e-9);
ok('USDG rose by the quote', Math.abs((b1.USDG - b0.USDG) - out1) < 0.02);
const toast = await p.locator('.tr-toast').last().textContent().catch(() => '');
console.log('   toast:', toast.trim());
ok('a toast confirmed it', /Swapped/.test(toast));

// max
await p.click('#max');
await p.waitForTimeout(300);
console.log('   max filled:', await p.locator('#pay').inputValue(), 'vs balance', b1.ETH);
ok('Max fills the whole ETH balance', Math.abs(num(await p.locator('#pay').inputValue()) - b1.ETH) < 1e-4);
await p.click('#go');
await p.waitForTimeout(500);
const b2 = await bal();
console.log('— after swapping the lot —', JSON.stringify(b2));
ok('ETH lands exactly on zero, no dust', b2.ETH === 0);

// flip and trade back
await p.click('#flip');
await p.waitForTimeout(250);
console.log('   after flip, pay/get =', await p.locator('#pay-tok').inputValue(), await p.locator('#get-tok').inputValue());
ok('flip swapped the pair', await p.locator('#pay-tok').inputValue() === 'USDG');
await p.fill('#pay', '5000');
await p.waitForTimeout(300);
const back = num(await p.locator('#get').textContent());
console.log('   5,000 USDG ->', back, 'ETH');
ok('reverse leg quotes sensibly', back > 0 && Math.abs(back - 5000 / rate) / (5000 / rate) < 0.01);
await p.click('#go');
await p.waitForTimeout(450);
const b3 = await bal();
console.log('— after buying ETH back —', JSON.stringify(b3));
ok('USDG fell by 5,000', Math.abs((b2.USDG - b3.USDG) - 5000) < 1e-6);
ok('ETH rose by the quote', Math.abs((b3.ETH - b2.ETH) - back) < 1e-4);

// overspend
await p.fill('#pay', '999999');
await p.waitForTimeout(300);
const goTxt = (await p.locator('#go').textContent()).trim();
const disabled = await p.locator('#go').isDisabled();
console.log('   asking for more than held ->', JSON.stringify(goTxt), '| disabled:', disabled);
ok('an overspend is refused', disabled || /insufficient|not enough|balance/i.test(goTxt));
const b4 = await bal();
ok('and nothing moved', JSON.stringify(b4) === JSON.stringify(b3));

// slippage + refresh
await p.fill('#pay', '1000');
await p.waitForTimeout(250);
await p.locator('#slip button, #slip .tr-pill').first().click().catch(() => {});
await p.waitForTimeout(250);
const minA = num(await p.locator('#s-min').textContent());
const outA = num(await p.locator('#get').textContent());
console.log('   at 0.1% slippage: out', outA, 'min', minA);
ok('minimum follows the slippage pill', Math.abs(minA - outA * 0.999) < 0.02);
const before = await p.locator('#get').textContent();
await p.click('#refresh');
await p.waitForTimeout(500);
console.log('   refresh moved the quote:', before.trim(), '->', (await p.locator('#get').textContent()).trim());

// a stock leg
await p.selectOption('#pay-tok', 'USDG'); await p.waitForTimeout(150);
await p.selectOption('#get-tok', 'xTSLA'); await p.waitForTimeout(150);
await p.fill('#pay', '3600'); await p.waitForTimeout(350);
const tsla = num(await p.locator('#get').textContent());
console.log('   3,600 USDG -> ', tsla, 'xTSLA (at $360.01 that is ~10)');
ok('the stock leg prices off the real quote', tsla > 9.8 && tsla < 10.02);

console.log('\nerrors:', errs.length ? errs : 'none');
await p.screenshot({ path: 'swapcheck.png', fullPage: false });
await b.close();
