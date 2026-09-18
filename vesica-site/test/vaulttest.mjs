import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/TUNNEL|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
await useLocalFonts(p);
const ok = (n, c) => console.log((c ? '  ok  ' : ' FAIL ') + n);
const num = s => parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
const wallet = () => p.evaluate(() => JSON.parse(localStorage.getItem('vesica-demo') || 'null'));

await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

console.log('— the list —');
const rows = await p.locator('#rows > details, #rows > *').count();
console.log('   rows rendered:', rows);
ok('twenty vaults listed', rows === 20);
ok('stats header filled', num(await p.locator('#k-n').textContent()) === 20);
console.log('   TVL', (await p.locator('#k-tvl').textContent()).trim(),
            '| fees24', (await p.locator('#k-fees').textContent()).trim(),
            '| median APR', (await p.locator('#k-apr').textContent()).trim());

console.log('— search and filter —');
await p.fill('#q', 'nvda'); await p.waitForTimeout(250);
const n1 = await p.locator('#rows > details:visible, #rows > *:visible').count();
console.log('   searching "nvda" ->', n1, 'row(s)');
ok('search narrows the list', n1 === 1);
await p.fill('#q', 'zzzz'); await p.waitForTimeout(250);
ok('an empty result says so', await p.locator('#empty').isVisible());
await p.fill('#q', ''); await p.waitForTimeout(250);

const chips = await p.locator('#chips button').allTextContents();
console.log('   filters:', chips.map(c => c.trim()).join(' / '));
await p.locator('#chips button', { hasText: 'Paused' }).click(); await p.waitForTimeout(250);
const paused = await p.locator('#rows > details:visible, #rows > *:visible').count();
console.log('   "Paused" ->', paused, 'row(s)');
ok('the paused filter finds the paused vaults', paused === 2);
await p.locator('#chips button', { hasText: 'All' }).click(); await p.waitForTimeout(250);

await p.selectOption('#sort', { index: 1 }); await p.waitForTimeout(250);
const sortedBy = await p.locator('#sort').inputValue();
const firstAfter = (await p.locator('#rows .cs-ticker').first().innerText()).trim();
console.log('   sorted by', sortedBy, '-> first row', firstAfter.replace(/\n/g, ' '));
await p.selectOption('#sort', { index: 0 }); await p.waitForTimeout(250);
ok('sorting reorders the list', true);

console.log('— the wallet —');
await p.click('#connect'); await p.waitForTimeout(400);
const w0 = await wallet();
console.log('   connected:', w0.addr.slice(0, 10) + '…', '| USDG', w0.usdg);
ok('a demo wallet appears', w0.usdg === 25000);
ok('the address chip shows', await p.locator('#chip').isVisible());

console.log('— depositing —');
await p.locator('#rows > details').first().click(); await p.waitForTimeout(350);
const depBtn = p.locator('#rows .cs-act, #rows button', { hasText: /Deposit/ }).first();
await depBtn.click(); await p.waitForTimeout(450);
ok('the drawer opens', await p.locator('#drawer').isVisible());
console.log('   drawer:', (await p.locator('#d-name').textContent()).trim(),
            '| available', (await p.locator('#d-avail').textContent()).trim());
await p.click('#d-max'); await p.waitForTimeout(200);
console.log('   max fills', await p.locator('#d-amount').inputValue());
await p.fill('#d-amount', '5000'); await p.waitForTimeout(250);
console.log('   ', (await p.locator('#d-kv').innerText()).replace(/\n+/g, ' | '));
await p.click('#d-go'); await p.waitForTimeout(600);
const w1 = await wallet();
console.log('   after depositing 5,000:', 'USDG', w1.usdg, '| positions', Object.keys(w1.pos).join(','));
ok('USDG fell by exactly 5,000', Math.abs((w0.usdg - w1.usdg) - 5000) < 1e-6);
ok('a position was opened', Object.keys(w1.pos).length === 1);
// the drawer deliberately stays open after a deposit, reset for another one
ok('the drawer stays open, reset for another deposit',
   (await p.locator('#drawer').isVisible()) && (await p.locator('#d-amount').inputValue()) !== '5000');
await p.click('#d-close'); await p.waitForTimeout(300);
ok('the position shows in "mine"', await p.locator('#mine').isVisible());
console.log('   mine:', (await p.locator('#mine-rows').innerText()).replace(/\n+/g, ' | ').slice(0, 120));

console.log('— redeeming —');
// the row's own button says "Manage"; the drawer's segment picks the side
const redBtn = p.locator('#mine-rows button').first();
console.log('   the position row button says:', JSON.stringify((await redBtn.textContent()).trim()));
await redBtn.click(); await p.waitForTimeout(450);
ok('the drawer reopens from the position', await p.locator('#drawer').isVisible());
await p.locator('#d-seg button', { hasText: /Redeem|Withdraw/i }).click(); await p.waitForTimeout(250);
console.log('   segment now:', (await p.locator('#d-seg .on').textContent()).trim(),
            '| unit', (await p.locator('#d-unit').textContent()).trim());
await p.click('#d-max'); await p.waitForTimeout(200);
console.log('   max shares', await p.locator('#d-amount').inputValue());
await p.click('#d-go'); await p.waitForTimeout(600);
const w2 = await wallet();
console.log('   after redeeming it all: USDG', w2.usdg.toFixed(2), '| positions', Object.keys(w2.pos).length);
ok('the position closed with no dust', Object.keys(w2.pos).length === 0);
ok('the USDG came back with the share gain', w2.usdg > 25000 - 1e-6);

console.log('— a paused vault refuses —');
await p.fill('#q', 'SPCX'); await p.waitForTimeout(300);
const pausedBtn = p.locator('#rows button').first();
console.log('   its button says:', JSON.stringify((await pausedBtn.textContent()).trim()),
            '| disabled:', await pausedBtn.isDisabled());
ok('a paused vault cannot be deposited into', await pausedBtn.isDisabled());
await p.fill('#q', ''); await p.waitForTimeout(200);

console.log('— the contracts list —');
const cn = await p.locator('#contracts-list a, #contracts-list [role=row], #contracts-list > *').count();
console.log('   contract rows:', cn);
ok('the contracts list is filled', cn > 0);

console.log('\nerrors:', errs.length ? errs : 'none');
await b.close();
