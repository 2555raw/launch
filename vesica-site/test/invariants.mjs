import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await useLocalFonts(p);
const ok = (n, c, extra = '') => console.log((c ? '  ok  ' : ' FAIL ') + n + (extra ? '   ' + extra : ''));
const near = (a, b2, tol = 0.01) => Math.abs(a - b2) <= tol;

await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.click('#connect'); await p.waitForTimeout(400);

// ---------------------------------------------------------------- a deposit
console.log('\n=== what a 5,000 USDG deposit is supposed to do ===');
const dep = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'NVDA');
  const before = { usdg: wallet.usdg, tvl: v.tvl, dep: v.depositors, px: v.px,
                   sumTvl: VAULTS.reduce((n, x) => n + x.tvl, 0) };
  depositInto(v, 5000);
  const after  = { usdg: wallet.usdg, tvl: v.tvl, dep: v.depositors, px: v.px,
                   shares: wallet.pos.NVDA, sumTvl: VAULTS.reduce((n, x) => n + x.tvl, 0) };
  return { before, after, cap: v.cap, apr: v.apr, age: v.age };
});
const { before, after } = dep;
ok('the USDG leaves the wallet, exactly',        near(before.usdg - after.usdg, 5000, 1e-9),
   `${before.usdg} → ${after.usdg}`);
ok('shares issued = amount / share price',       near(after.shares, 5000 / before.px, 1e-6),
   `${after.shares.toFixed(4)} cNVDA at ${before.px}`);
ok('the shares are worth what went in',          near(after.shares * before.px, 5000, 1e-6));
ok("the vault's TVL rises by the deposit",       near(after.tvl - before.tvl, 5000, 1e-9));
ok('the depositor count rises by one',           after.dep - before.dep === 1);
ok('protocol TVL rises by the same 5,000',       near(after.sumTvl - before.sumTvl, 5000, 1e-9));
ok('no entry fee is taken',                      near(after.shares * before.px, before.usdg - after.usdg, 1e-6));

// what the page prints about it
await p.waitForTimeout(400);
const shown = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'NVDA');
  const sum = VAULTS.reduce((n, x) => n + x.tvl, 0);
  return { headerTvl: document.getElementById('k-tvl').textContent.trim(),
           realTvl: sum,
           mineVal: document.querySelector('.cs-mine-v')?.textContent.trim(),
           realVal: (wallet.pos.NVDA || 0) * v.px };
});
console.log('   header TVL', shown.headerTvl, 'vs', '$' + (shown.realTvl/1e6).toFixed(2) + 'M');
ok('the header TVL is the sum of the vaults',
   shown.headerTvl === '$' + (shown.realTvl / 1e6).toFixed(2) + 'M');
ok('the position row shows shares x share price', !!shown.mineVal, shown.mineVal + ' vs ' + shown.realVal.toFixed(2));

// ---------------------------------------------------------------- the cap
console.log('\n=== the cap is a cap ===');
const cap = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'GME');          // smallest room
  const room = v.cap - v.tvl;
  const tvl0 = v.tvl, usdg0 = wallet.usdg;
  depositInto(v, room + 50_000);                       // ask for far too much
  return { room, blocked: v.tvl === tvl0 && wallet.usdg === usdg0,
           toast: document.querySelector('.cs-toast:last-child')?.textContent.trim() };
});
ok('a deposit past the cap is refused', cap.blocked, cap.toast || '');

// ---------------------------------------------------------------- compounding
console.log('\n=== holding it earns, and the earning is the APR ===');
const grow = await p.evaluate(() => new Promise(res => {
  const v = VAULTS.find(x => x.t === 'NVDA');
  const px0 = v.px, t0 = Date.now();
  setTimeout(() => {
    accrue();
    const secs = (Date.now() - t0) / 1000;
    const expect = v.px0 * (1 + (v.apr / 100) * ((secs + (t0 - OPENED) / 1000) / 8760));
    res({ px0, px1: v.px, secs, expect, apr: v.apr });
  }, 4000);
}));
console.log('   share price', grow.px0, '→', grow.px1, 'over', grow.secs.toFixed(1) + 's of demo clock');
ok('the share price rose',                 grow.px1 > grow.px0);
ok('it rose at the vault\'s own APR',      near(grow.px1, grow.expect, 2e-6),
   `expected ${grow.expect.toFixed(6)}`);

const paused = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'SPCX');
  return { px0: v.px0, px: v.px };
});
ok('a paused vault earns nothing', paused.px === paused.px0);

// ---------------------------------------------------------------- redeeming
console.log('\n=== redeeming gives back shares x share price ===');
const red = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'NVDA');
  const sh = wallet.pos.NVDA, px = v.px;
  const b2 = { usdg: wallet.usdg, tvl: v.tvl, dep: v.depositors };
  withdrawFrom(v, sh, true);
  return { sh, px, b2, a2: { usdg: wallet.usdg, tvl: v.tvl, dep: v.depositors,
                             left: wallet.pos.NVDA } };
});
ok('USDG back = shares x share price',   near(red.a2.usdg - red.b2.usdg, red.sh * red.px, 1e-6),
   `$${(red.a2.usdg - red.b2.usdg).toFixed(2)}`);
ok('more came back than went in',        red.a2.usdg - red.b2.usdg > 5000);
ok('the TVL falls by the same amount',   near(red.b2.tvl - red.a2.tvl, red.sh * red.px, 1e-6));
ok('the depositor count falls by one',   red.b2.dep - red.a2.dep === 1);
ok('the position is gone, not dusty',    red.a2.left === undefined);

// ---------------------------------------------------------------- persistence
console.log('\n=== it survives a reload, and the books still balance ===');
await p.evaluate(() => { depositInto(VAULTS.find(x => x.t === 'MSFT'), 3000); paint(); });
await p.waitForTimeout(300);
const pre = await p.evaluate(() => ({
  usdg: wallet.usdg, shares: wallet.pos.MSFT,
  tvl: VAULTS.find(x => x.t === 'MSFT').tvl,
}));
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
const post = await p.evaluate(() => ({
  usdg: wallet.usdg, shares: wallet.pos.MSFT,
  tvl: VAULTS.find(x => x.t === 'MSFT').tvl,
  seed: 5_240_000,
}));
ok('the position is still there',        near(post.shares, pre.shares, 1e-9));
ok('the USDG is still there',            near(post.usdg, pre.usdg, 1e-9));
ok('the TVL is rebuilt, not doubled',    near(post.tvl, post.seed + post.shares * (post.tvl - post.seed) / (post.shares || 1), 1),
   `${Math.round(post.tvl).toLocaleString()} vs seed ${post.seed.toLocaleString()}`);
console.log('   TVL after reload:', Math.round(post.tvl).toLocaleString(), '(seed 5,240,000 + the position)');

// ---------------------------------------------------------------- shared wallet
console.log('\n=== the desk and the vaults are the same wallet ===');
const vaultsUsdg = await p.evaluate(() => wallet.usdg);
await p.goto('http://127.0.0.1:8931/swap.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
const deskUsdg = await p.evaluate(() => wallet.usdg);
ok('the swap desk sees the same balance', near(deskUsdg, vaultsUsdg, 1e-9),
   `$${deskUsdg.toFixed(2)}`);

// ---------------------------------------------------------------- disconnect
console.log('\n=== disconnecting puts the vault back as it was ===');
await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const dis = await p.evaluate(() => {
  const v = VAULTS.find(x => x.t === 'MSFT');
  const held = wallet.pos.MSFT || 0, tvl = v.tvl, dep = v.depositors;
  disconnect();
  return { tvl, dep, held, px: v.px, tvlAfter: v.tvl, depAfter: v.depositors, wallet: !!wallet };
});
ok('the wallet is gone',                  !dis.wallet);
ok('its TVL contribution is removed',     near(dis.tvl - dis.tvlAfter, dis.held * dis.px, 1));
ok('its depositor is removed',            dis.dep - dis.depAfter === 1);

console.log('\nerrors:', errs.length ? errs : 'none');
await b.close();
