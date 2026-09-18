import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ok = (n, c, x = '') => console.log((c ? '  ok  ' : ' FAIL ') + n + (x ? '   ' + x : ''));

// ---------- 1. no injected wallet: exactly as before ----------
{
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await useLocalFonts(p);
  await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.click('#connect'); await p.waitForTimeout(600);
  const w = await p.evaluate(() => ({ real: wallet.real, addr: wallet.addr, usdg: wallet.usdg,
                                      what: document.getElementById('pop-what').textContent.trim() }));
  console.log('\n— a browser with no wallet —');
  ok('it falls back to the demo wallet', w.real === false, w.addr.slice(0, 10) + '…');
  ok('with the play money it always had', w.usdg === 25000);
  ok('and says so in the popover', /demo/i.test(w.what), JSON.stringify(w.what));
  ok('no page error', errs.length === 0, errs.join(' | '));
  await p.close();
}

// ---------- 2. an injected wallet that approves ----------
{
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => {
    window.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts') return ['0x71C7656EC7ab88b098defB751B7401B5f6d8976F'];
        if (method === 'eth_chainId') return '0xa4b1';                    // Arbitrum One
        if (method === 'eth_getBalance') return '0x1bc16d674ec80000';      // 2 ETH in wei
        throw new Error('unexpected method ' + method);                    // nothing else may be called
      },
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await useLocalFonts(p);
  await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.click('#connect'); await p.waitForTimeout(800);
  const w = await p.evaluate(() => ({ real: wallet.real, addr: wallet.addr, chain: wallet.chain,
                                      native: wallet.native, usdg: wallet.usdg,
                                      shown: document.getElementById('chip-addr').textContent.trim(),
                                      what: document.getElementById('pop-what').textContent.trim() }));
  console.log('\n— a browser with a wallet that approves —');
  ok('it uses the real address',   w.addr === '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', w.addr);
  ok('and shows it in the chip',   w.shown === '0x71C7…976F', w.shown);
  ok('it reads the real network',  w.chain === 'Arbitrum One', w.chain);
  ok('and the real native balance', w.native === 2, w.native + ' ETH');
  ok('the play money is still play money', w.usdg === 25000);
  ok('and the popover says which is which', /play money/i.test(w.what), JSON.stringify(w.what));
  ok('nothing was signed or sent', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------- 3. an injected wallet that refuses ----------
{
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => {
    window.ethereum = { request: async () => { const e = new Error('User rejected'); e.code = 4001; throw e; } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await useLocalFonts(p);
  await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.click('#connect'); await p.waitForTimeout(800);
  const w = await p.evaluate(() => ({ real: wallet.real, usdg: wallet.usdg }));
  console.log('\n— a browser where the wallet is declined —');
  ok('the page carries on with the demo wallet', w.real === false && w.usdg === 25000);
  ok('and nothing breaks', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------- 4. the swap desk, same story ----------
{
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => {
    window.ethereum = { request: async ({ method }) => {
      if (method === 'eth_requestAccounts') return ['0x71C7656EC7ab88b098defB751B7401B5f6d8976F'];
      if (method === 'eth_chainId') return '0x2105';
      if (method === 'eth_getBalance') return '0x0';
      throw new Error('unexpected ' + method);
    } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await useLocalFonts(p);
  await p.goto('http://127.0.0.1:8931/swap.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.click('#connect'); await p.waitForTimeout(800);
  const w = await p.evaluate(() => ({ real: wallet.real, chain: wallet.chain,
                                      shown: document.getElementById('chip-addr').textContent.trim() }));
  console.log('\n— the swap desk —');
  ok('it connects the same wallet', w.real === true && w.shown === '0x71C7…976F', w.chain);
  ok('no error', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await b.close();
