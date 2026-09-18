import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
await p.click('#connect'); await p.waitForTimeout(300);

// every vault that takes deposits, against a spread of sizes that between them
// make the share count round both ways at four places
const r = await p.evaluate(() => {
  const AMTS = [999, 1234, 777, 4321, 5000, 88.33, 1500.55, 3333.33];
  const bad = [];
  let tried = 0;
  for (const v of VAULTS.filter(v => v.state !== 'paused')) {
    for (const amt of AMTS) {
      tried++;
      const startUsdg = wallet.usdg;
      depositInto(v, amt);
      const have = wallet.pos[v.t] || 0;
      if (!have) { bad.push([v.t, amt, 'deposit did nothing']); continue; }
      // what Max would write into the field now
      const maxWrites = Math.floor(have * 1e4) / 1e4;
      if (maxWrites > have) bad.push([v.t, amt, 'Max overshoots the balance']);
      // and whether the drawer would let you press Redeem on it
      if (!(maxWrites > 0) || maxWrites > have + 1e-4) bad.push([v.t, amt, 'Redeem would be disabled']);
      withdrawFrom(v, maxWrites, true);
      if (wallet.pos[v.t]) bad.push([v.t, amt, 'dust left: ' + wallet.pos[v.t]]);
      if (Math.abs(wallet.usdg - startUsdg) > 0.005) bad.push([v.t, amt, 'round trip lost ' + (startUsdg - wallet.usdg)]);
    }
  }
  return { tried, bad };
});
console.log('round trips tried:', r.tried);
console.log('failures:', r.bad.length ? r.bad : 'none');
console.log('errors:', errs.length ? errs : 'none');
await b.close();
