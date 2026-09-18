/* What the site does when it is handled badly.
   Every other suite here drives the happy path. This one types nonsense into
   the money fields, clicks faster than the code expects, and puts characters
   in the search box that would break a naive filter. Three real bugs came out
   of it: a double-click on Deposit spent twice, a fraction of a cent opened a
   position the button had promised was worth $0.00, and the swap button
   offered to "Swap 0 ETH". The checks below hold all three shut. */

import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8931';
const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await b.newContext();
await useLocalFonts(ctx);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));

let bad = 0;
const ok = (c, label, note = '') => {
  console.log(`  ${c ? 'ok ' : 'FAIL'} ${label}${note ? '   ' + note : ''}`);
  if (!c) bad++;
};

const purse = () => page.evaluate(() => {
  const w = JSON.parse(localStorage.getItem('vesica-demo'));
  return { usdg: w.usdg, eth: w.bal.ETH, pos: w.pos };
});

/* type=number throws away what it will not hold, so set the value and see what
   actually landed — that is what the page has to cope with */
const setVal = (sel, v) => page.evaluate(([s, v]) => {
  const el = document.querySelector(s);
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value;
}, [sel, v]);

const openDrawer = () => page.evaluate(() => {
  if (!document.querySelector('#drawer').classList.contains('on'))
    document.querySelector('[data-open]').click();
});

await page.goto(`${BASE}/vaults.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.querySelector('#connect')?.click());
await page.waitForTimeout(400);

console.log('— nonsense in the deposit box —');
for (const junk of ['-500', 'abc', '0', '1e9', '0.0000001', '  ', '0.004', '--5', '1,000', 'Infinity', 'NaN']) {
  await openDrawer();
  await page.waitForTimeout(250);
  const before = await purse();
  const held = await setVal('#d-amount', junk);
  await page.waitForTimeout(140);
  const st = await page.evaluate(() => {
    const g = document.querySelector('#d-go');
    return { disabled: g.disabled, label: g.textContent.trim() };
  });
  if (!st.disabled) await page.click('#d-go').catch(() => {});
  await page.waitForTimeout(280);
  const after = await purse();
  const n = Number(held);
  // money may only move for a real amount of at least a cent that the wallet can afford
  const allowed = Number.isFinite(n) && n >= 0.01 && n <= before.usdg + 0.01;
  const moved = Math.abs(after.usdg - before.usdg) > 1e-9;
  ok(!moved || allowed, `"${junk}"`.padEnd(13) + (moved ? 'spent' : 'refused'),
     `held "${held}" · ${st.disabled ? 'disabled' : st.label}`);
  ok(!Object.keys(after.pos).length || allowed, '  and opened no position',
     JSON.stringify(after.pos));
  if (Object.keys(after.pos).length) {
    await page.evaluate(() => document.querySelector('#mine-clear')?.click());
    await page.waitForTimeout(250);
  }
}

console.log('— the wallet cannot be overdrawn —');
await openDrawer(); await page.waitForTimeout(250);
const start = (await purse()).usdg;
await setVal('#d-amount', String(start * 2));
await page.waitForTimeout(150);
const over = await page.evaluate(() => {
  const g = document.querySelector('#d-go');
  return { d: g.disabled, t: g.textContent.trim() };
});
ok(over.d, 'twice the balance is refused', over.t);
ok((await purse()).usdg === start, 'and nothing moved');

console.log('— clicking faster than the code expects —');
await setVal('#d-amount', '1000');
await page.waitForTimeout(150);
const pre = (await purse()).usdg;
await page.evaluate(() => { const g = document.querySelector('#d-go'); for (let i = 0; i < 8; i++) g.click(); });
await page.waitForTimeout(700);
const post = (await purse()).usdg;
ok(Math.abs((pre - post) - 1000) < 0.02, 'eight clicks on Deposit spend 1,000 once',
   `${pre.toFixed(2)} → ${post.toFixed(2)}`);
ok(post >= 0, 'the balance never goes negative', post.toFixed(2));
await page.evaluate(() => document.querySelector('#mine-clear')?.click());
await page.waitForTimeout(300);

console.log('— characters that would break a naive filter —');
for (const q of ['(', '[a-z', '\\', '.*', '$^', '???', 'ñ', '<script>alert(1)</script>']) {
  const r = await page.evaluate(async q => {
    const s = document.querySelector('#q');
    s.value = q;
    s.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 90));
    return { rows: document.querySelectorAll('.cs-row').length, injected: !!document.querySelector('#rows script') };
  }, q);
  ok(!r.injected, `${JSON.stringify(q).padEnd(30)} ${r.rows} row(s), nothing injected`);
}
await page.evaluate(() => {
  const s = document.querySelector('#q');
  s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true }));
});

console.log('— the same treatment at the swap desk —');
await page.goto(`${BASE}/swap.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.querySelector('#connect')?.click());
await page.waitForTimeout(400);

for (const junk of ['-1', 'abc', '0', '999999', '0.000000000001', 'Infinity']) {
  const before = (await purse()).eth;
  const held = await setVal('#pay', junk);
  await page.waitForTimeout(160);
  const st = await page.evaluate(() => {
    const g = document.querySelector('#go');
    return { d: g.disabled, t: g.textContent.trim() };
  });
  if (!st.d) await page.click('#go').catch(() => {});
  await page.waitForTimeout(280);
  const after = (await purse()).eth;
  const n = Number(held);
  const allowed = Number.isFinite(n) && n >= 1e-6 && n <= before + 1e-9;
  const moved = Math.abs(after - before) > 1e-12;
  ok(!moved || allowed, `"${junk}"`.padEnd(18) + (moved ? 'swapped' : 'refused'),
     st.d ? 'disabled' : st.t);
  ok(after >= 0, '  and ETH stays at or above zero', after.toFixed(8));
}

console.log('— and hammered —');
await setVal('#pay', '0.5');
await page.waitForTimeout(250);
const e0 = (await purse()).eth;
await page.evaluate(() => { const g = document.querySelector('#go'); for (let i = 0; i < 8; i++) g.click(); });
await page.waitForTimeout(800);
const e1 = (await purse()).eth;
ok(Math.abs((e0 - e1) - 0.5) < 1e-6, 'eight clicks on Swap move 0.5 ETH once', `${e0} → ${e1}`);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
bad += errs.length;
await b.close();
console.log(bad ? `FAILURES: ${bad}` : 'all clear');
process.exit(bad ? 1 : 0);
