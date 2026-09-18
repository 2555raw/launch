import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await useLocalFonts(p);
const ok = (n, c, x = '') => console.log((c ? '  ok  ' : ' FAIL ') + n + (x ? '   ' + x : ''));
const near = (a, c, t = 0.01) => Math.abs(a - c) <= t;

await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
// the wallet persists, so only connect when there is nothing connected
const ensureWallet = async () => {
  if (await p.evaluate(() => !localStorage.getItem('vesica-demo'))) {
    await p.click('#connect'); await p.waitForTimeout(400);
  }
};
await ensureWallet();

console.log('=== the cap, actually exercised this time ===');
const cap = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'GME');
  v.tvl = v.cap - 1000;                   // leave room for 1,000 and no more
  const tvl0 = v.tvl, usdg0 = wallet.usdg, dep0 = v.depositors;
  depositInto(v, 5000);                   // the wallet holds 25,000, the vault has room for 1,000
  const refused = v.tvl === tvl0 && wallet.usdg === usdg0 && !wallet.pos.GME;
  const toast = [...document.querySelectorAll('.cs-toast')].pop()?.textContent.trim();
  // and the amount that does fit goes through
  depositInto(v, 1000);
  const fits = near2 => true;
  return { refused, toast, room: 1000, tookTheFit: !!wallet.pos.GME,
           tvlNow: v.tvl, cap: v.cap, dep0, depNow: v.depositors };
});
ok('too much for the cap is refused', cap.refused, cap.toast || '');
ok('the refusal names the cap, not the wallet', /cap/i.test(cap.toast || ''), JSON.stringify(cap.toast));
ok('exactly what fits is accepted', cap.tookTheFit);
ok('and it lands the vault on its cap', near(cap.tvlNow, cap.cap, 1),
   `${Math.round(cap.tvlNow).toLocaleString()} / ${cap.cap.toLocaleString()}`);

console.log('\n=== the drawer promises what the deposit delivers ===');
await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await ensureWallet();
await p.evaluate(() => { if (wallet) { wallet.usdg = 25000; wallet.pos = {}; save(); paint(); } });
await p.waitForTimeout(300);
await p.evaluate(() => openDrawer('TSLA'));
await p.fill('#d-amount', '4000'); await p.waitForTimeout(350);
const promised = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('#d-kv > div')].map(d => [
    d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()]);
  return Object.fromEntries(rows);
});
console.log('   the drawer says:', JSON.stringify(promised));
await p.click('#d-go'); await p.waitForTimeout(500);
const got = await p.evaluate(() => ({ shares: wallet.pos.TSLA, px: VAULTS.find(v => v.t === 'TSLA').px }));
const promisedShares = parseFloat(promised['Shares you receive'].replace(/[^0-9.]/g, ''));
const promisedHalf   = parseFloat(promised['Swapped into the Stock Token'].replace(/[^0-9.]/g, ''));
ok('half of the deposit is swapped, exactly', near(promisedHalf, 2000, 0.005), `$${promisedHalf}`);
ok('the shares delivered are the shares promised', near(got.shares, promisedShares, 0.0002),
   `${got.shares.toFixed(4)} vs ${promisedShares}`);
ok('the share price quoted is the one used', near(4000 / got.shares, parseFloat(promised['Share price'].replace(/[^0-9.]/g, '')), 0.001));

console.log('\n=== the row and the panel agree with the maths ===');
await p.waitForTimeout(400);
const disp = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'TSLA');
  const worth = wallet.pos.TSLA * v.px;
  const shown = document.querySelector('.cs-mine-v').textContent.trim();
  const shares = document.querySelector('.cs-mine-t span').textContent.trim();
  // the site prints your own money to the dollar above $1,000
  const expect = '$' + worth.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return { shown, expect, shares, realShares: wallet.pos.TSLA };
});
ok('the position value is the rounding of shares x price', disp.shown === disp.expect,
   `${disp.shown} vs ${disp.expect}`);
ok('the share count printed is the share count held',
   near(parseFloat(disp.shares), disp.realShares, 0.0001), `${disp.shares} vs ${disp.realShares.toFixed(4)}`);

console.log('\n=== withdraw everything ===');
await p.evaluate(() => { depositInto(VAULTS.find(v => v.t === 'AAPL'), 2000); paint(); });
await p.waitForTimeout(300);
const all = await p.evaluate(() => {
  const before = { usdg: wallet.usdg, n: Object.keys(wallet.pos).length };
  const owed = Object.entries(wallet.pos)
    .reduce((s, [t, sh]) => s + sh * VAULTS.find(v => v.t === t).px, 0);
  withdrawAll();
  return { before, owed, after: { usdg: wallet.usdg, n: Object.keys(wallet.pos).length } };
});
console.log('   held', all.before.n, 'positions worth $' + all.owed.toFixed(2));
ok('every position closes', all.after.n === 0);
ok('and every one of them pays out', near(all.after.usdg - all.before.usdg, all.owed, 0.02),
   `$${(all.after.usdg - all.before.usdg).toFixed(2)}`);

console.log('\nerrors:', errs.length ? errs : 'none');
await b.close();
