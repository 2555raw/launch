/* Topping up from an external wallet, against a real chain.
 *
 * A browser extension cannot be installed here, so the test announces its own
 * EIP-6963 provider — the same interface MetaMask, Coinbase Wallet, Phantom and
 * Rainbow announce — and forwards every request to the local node. What is
 * being tested is Ward's side of that conversation: that it discovers the
 * wallet, connects, switches the chain, and moves real funds to the address it
 * generated. */
const { chromium } = require('playwright');
const { ethers } = require('ethers');

const APP = process.env.APP_URL || 'http://127.0.0.1:8099/app';
const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
/* Hardhat account #1 — unlocked on the node, so it can send without signing. */
const PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const step = m => console.log('  ▸ ' + m);

/* Announced before any page script runs, which is exactly when a real wallet
   extension announces itself. */
function fakeWallet(rpc, payer) {
  const provider = {
    _handlers: {},
    on(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
    removeListener() {},
    async request({ method, params }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [payer];
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      if (method === 'eth_chainId') return '0x2105';
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params || [] })
      }).then(r => r.json());
      if (res.error) { const e = new Error(res.error.message); e.code = res.error.code; throw e; }
      return res.result;
    }
  };
  const detail = Object.freeze({
    info: { uuid: 'test-wallet-uuid', name: 'Test Wallet', rdns: 'test.wallet', icon: '' },
    provider
  });
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const errors = [];
  await ctx.addInitScript({ content: `(${fakeWallet.toString()})(${JSON.stringify(RPC)}, ${JSON.stringify(PAYER)});` });

  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });

  /* A wallet to top up into. */
  await page.click('#startCreate');
  await page.waitForSelector('.seed .word');
  const words = await page.$$eval('#seedGrid .word .w', n => n.map(x => x.textContent));
  await page.click('label.check');
  await page.click('#toVerify');
  for (const row of await page.$$('#verifyFields .vf')) {
    const n = parseInt((await row.$eval('b', b => b.textContent)).replace(/\D/g, ''), 10);
    await row.$eval('input', (i, v) => { i.value = v; i.dispatchEvent(new Event('input')); }, words[n - 1]);
  }
  await page.click('#toPass');
  await page.fill('#pw1', 'Ward-2026!ok');
  await page.fill('#pw2', 'Ward-2026!ok');
  await page.click('#doCreate');
  await page.waitForSelector('[data-view="home"].on', { timeout: 60000 });

  await page.click('[data-go="settings"]');
  await page.fill('#rpcInput', RPC);
  await page.click('#saveRpc');
  await page.click('.view[data-view="settings"] .back');
  const mine = await page.evaluate(() => JSON.parse(localStorage.getItem('ward.v1.address')));
  step('fresh wallet at ' + mine);

  await page.click('[data-go="deposit"]');
  await page.waitForSelector('#walletList button', { timeout: 20000 });
  const names = await page.$$eval('#walletList button b', n => n.map(x => x.textContent));
  if (!names.includes('Test Wallet')) throw new Error('the announced wallet was not discovered: ' + names.join(', '));
  step('wallet discovered over EIP-6963: ' + names.join(', '));

  await page.click('#walletList button');
  await page.waitForSelector('#depForm:not([hidden])', { timeout: 20000 });
  const who = await page.textContent('#linkedAddr');
  step('connected, showing the payer account: ' + who);

  const prov = new ethers.JsonRpcProvider(RPC, undefined, { cacheTimeout: -1 });
  const before = await prov.getBalance(mine);

  await page.fill('#depAmt', '0.75');
  await page.click('#depSend');
  await page.waitForFunction(() => document.querySelector('#stTitle').textContent === 'Topped up', null, { timeout: 60000 });
  const link = await page.getAttribute('#stLink', 'href');
  const hash = link.split('/tx/')[1];

  const got = (await prov.getBalance(mine)) - before;
  if (got !== ethers.parseEther('0.75')) throw new Error('the wallet received ' + ethers.formatEther(got));
  const tx = await prov.getTransaction(hash);
  if (tx.from.toLowerCase() !== PAYER.toLowerCase()) throw new Error('the payer was not the linked wallet');
  if (tx.to.toLowerCase() !== mine.toLowerCase()) throw new Error('the funds did not go to the Ward address');
  step(`ON CHAIN: ${hash.slice(0, 18)}… moved 0.75 ETH from the linked wallet into Ward`);

  /* The screen has to agree with the chain. */
  await page.click('#stDone');
  await page.waitForFunction(() => /ETH/.test(document.querySelector('#totalBal').textContent), null, { timeout: 30000 });
  const shown = await page.textContent('#totalBal');
  if (shown !== '0.75 ETH') throw new Error('balance on screen: ' + shown);
  step('balance on screen agrees with the chain: ' + shown);

  await page.click('[data-go="deposit"]');
  await page.click('#unlinkBtn');
  await page.waitForSelector('#depIntro:not([hidden])');
  step('disconnects cleanly');

  if (errors.length) { console.log('\nconsole errors:'); errors.forEach(e => console.log('  ' + e)); process.exit(1); }
  await browser.close();
  console.log('\n✅ TOP-UP FROM AN EXTERNAL WALLET WORKS');
})().catch(e => { console.error('\n❌ FAILED: ' + e.message); process.exit(1); });
