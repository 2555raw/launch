/* End-to-end for trading from a token's public page: launch a token, then buy
   and sell it through Uniswap's Universal Router, with the launch hook's cap
   and cooldown explained when they refuse. In a browser with a stand-in
   wallet, on a local chain that carries Robinhood Chain's own Uniswap code
   (PoolManager, positions, Permit2, Universal Router and Quoter, copied from
   mainnet).

     npm run node                                  # terminal 1
     (cd ../.. && python3 -m http.server 8765)     # terminal 2
     node e2e-swap.js                              # terminal 3 (needs network for mainnet code)

   SOLJSON=path and ETHERS_UMD=path serve local copies of the compiler and ethers. */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const solc = require('solc');
const { chromium } = require('playwright');
const K = require('../../launch-kit.js');

const RPC = 'http://localhost:8545';
const MAINNET = 'https://rpc.mainnet.chain.robinhood.com';
const SITE = 'http://localhost:8765/';
const SHOTS = process.env.SHOTS || '';
const cfgSrc = fs.readFileSync(path.join(__dirname, '../../config.js'), 'utf8');
const pick = (k) => ethers.getAddress(cfgSrc.match(new RegExp(`${k}:\\s*'(0x[0-9a-fA-F]{40})'`))[1]);
const ADDR = { pm: pick('poolManager'), sv: pick('stateView'), posm: pick('positionManager'), permit2: pick('permit2'), proxy: pick('create2Deployer'), router: pick('universalRouter'), quoter: pick('quoter') };

const results = [];
const check = (n, c, x = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  (${x})` : ''}`); };

(async () => {
  const local = new ethers.JsonRpcProvider(RPC, 4663, { staticNetwork: true, cacheTimeout: -1 });
  const main = new ethers.JsonRpcProvider(MAINNET, 4663, { staticNetwork: true });
  for (const [name, a] of Object.entries(ADDR)) {
    const code = await main.getCode(a);
    if (code.length < 10) throw new Error(`no ${name} code on mainnet`);
    await local.send('hardhat_setCode', [a, code]);
  }
  const me = await (await local.getSigner(0)).getAddress();

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(SITE + 'config.js', async (r) => r.fulfill({ contentType: 'application/javascript', body: (await (await r.fetch()).text()).replace(/rpcUrl:\s*'[^']+'/, `rpcUrl: '${RPC}'`) }));
  const sourcify = { submitted: [], verified: new Set() };
  let job = 0;
  await ctx.route(/sourcify\.dev\/server\/v2\/verify\/4663\//, async (r) => {
    sourcify.submitted.push({ address: r.request().url().split('/').pop(), ...JSON.parse(r.request().postData()) });
    sourcify.verified.add(r.request().url().split('/').pop().toLowerCase());
    r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ verificationId: `job-${++job}` }) });
  });
  await ctx.route(/sourcify\.dev\/server\/v2\/verify\/job-/, (r) => r.fulfill({ contentType: 'application/json', body: '{"isJobCompleted":true,"contract":{"match":"exact_match"}}' }));
  await ctx.route(/sourcify\.dev\/server\/v2\/contract\/4663\//, (r) => { const a = r.request().url().split('/').pop().toLowerCase(); r.fulfill(sourcify.verified.has(a) ? { contentType: 'application/json', body: '{"match":"exact_match"}' } : { status: 404, body: '{}' }); });
  await ctx.route(/api\.dexscreener\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"pairs":null}' }));
  if (process.env.SOLJSON) await ctx.route(/cdn\.jsdelivr\.net\/npm\/solc@0\.8\.26\/soljson\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.SOLJSON, 'utf8') }));
  if (process.env.ETHERS_UMD) await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/ethers\//, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.ETHERS_UMD, 'utf8') }));
  await ctx.addInitScript(({ rpc }) => {
    let id = 0;
    const send = async (method, params = []) => {
      const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
      const j = await r.json();
      if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
      return j.result;
    };
    window.__watched = [];
    window.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts') return send('eth_accounts');
        if (/^wallet_(switch|add)/.test(method)) return null;
        if (method === 'wallet_watchAsset') { window.__watched.push(params); return true; }
        return send(method, params);
      },
      on() {}, removeListener() {}
    };
  }, { rpc: RPC });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const wait = (fn, arg, ms = 180000) => page.waitForFunction(fn, arg, { timeout: ms }).catch(async (e) => {
    console.log('PAGE ERRORS:', errors);
    console.log('MSG:', await page.textContent('#ln-msg').catch(() => ''), '| STEPS:', await page.textContent('#ln-steps').catch(() => ''), '| MSG2:', await page.textContent('#msg').catch(() => ''));
    throw e;
  });

  /* ===== launch a token to trade ===== */
  await page.goto(SITE + 'launch.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('#ln-name', 'Sea Dog');
  await page.fill('#ln-symbol', 'SEADOG');
  await page.fill('#ln-eth', '1');
  await page.fill('#ln-share', '90');
  await page.fill('#ln-maxbuy', '0.1');
  await page.click('#ln-go');
  await wait(() => !document.querySelector('#ln-done').hidden);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('unyhooks-deployed'))[0]);
  const L = rec.launch;
  const token = new ethers.Contract(L.token, ['function balanceOf(address) view returns (uint256)'], local);
  check('a token was launched to trade', !!L.token, L.token);

  /* ===== the public page offers trading ===== */
  await page.goto(SITE + 'hook.html?a=' + rec.address, { waitUntil: 'networkidle' });
  await wait(() => !document.querySelector('#swap').hidden, null, 60000);
  check('trade panel shown for an ETH pool', await page.isVisible('#swap h2'), await page.textContent('#swap h2'));
  check('Buy button points at the panel', (await page.getAttribute('[data-to-swap]', 'href')) === '#swap');
  await page.click('#swap [data-el=go]');
  await wait(() => /Buy \$SEADOG/.test(document.querySelector('#swap [data-el=go]').textContent));
  check('connecting turns the button into Buy', true, await page.textContent('#swap [data-el=go]'));
  check('ETH balance shown', /Balance: .* ETH/.test(await page.textContent('#swap [data-el=bal]')), await page.textContent('#swap [data-el=bal]'));

  // over the launch cap: the quote explains it before anything is signed
  await page.fill('#swap [data-el=amount]', '0.5');
  await wait(() => /capped at 0\.1 ETH/.test(document.querySelector('#swap [data-el=msg]').textContent), null, 30000);
  check('a buy over the cap is explained', true, await page.textContent('#swap [data-el=msg]'));

  // a buy inside the cap
  await page.fill('#swap [data-el=amount]', '0.05');
  await wait(() => /SEADOG/.test(document.querySelector('#swap [data-el=out]').textContent), null, 30000);
  const quoted = await page.textContent('#swap [data-el=out]');
  check('a quote is shown', true, quoted);
  check('the minimum after slippage is shown', /At least .* with 1% slippage/.test(await page.textContent('#swap [data-el=min]')));
  const before = await token.balanceOf(me);
  const nonce0 = await local.getTransactionCount(me);
  await page.click('#swap [data-el=go]');
  await wait(() => /Done: bought/.test(document.querySelector('#swap [data-el=msg]').textContent));
  const got = (await token.balanceOf(me)) - before;
  check('the buy went through in one transaction', (await local.getTransactionCount(me)) === nonce0 + 1);
  const quotedNum = Number(quoted.replace(/[^0-9.]/g, ''));
  const gotNum = Number(ethers.formatEther(got));
  check('received about what was quoted', got > 0n && Math.abs(gotNum - quotedNum) / quotedNum < 0.02, `${gotNum.toFixed(0)} vs quoted ${quoted}`);

  // right away again: the per-wallet cooldown refuses it, in words
  await page.fill('#swap [data-el=amount]', '0.01');
  await wait(() => /can buy again in about \d+ s/.test(document.querySelector('#swap [data-el=msg]').textContent), null, 30000);
  check('the cooldown is explained', true, await page.textContent('#swap [data-el=msg]'));

  /* ===== sell ===== */
  await page.click('#swap [data-mode=sell]');
  check('sell tab asks for the token', (await page.textContent('#swap [data-el=pay-unit]')) === 'SEADOG' && /Sell \$SEADOG/.test(await page.textContent('#swap [data-el=go]')));
  await wait(() => /Balance: .* SEADOG/.test(document.querySelector('#swap [data-el=bal]').textContent));
  await page.fill('#swap [data-el=amount]', '1000000');
  await wait(() => /ETH/.test(document.querySelector('#swap [data-el=out]').textContent), null, 30000);
  check('a sale quote is shown in ETH', true, await page.textContent('#swap [data-el=out]'));
  const ethBefore = await local.getBalance(me);
  const tokBefore = await token.balanceOf(me);
  const nonce1 = await local.getTransactionCount(me);
  await page.click('#swap [data-el=go]');
  await wait(() => /Done: sold/.test(document.querySelector('#swap [data-el=msg]').textContent));
  check('the sale took approvals plus the swap', (await local.getTransactionCount(me)) === nonce1 + 3, `${(await local.getTransactionCount(me)) - nonce1} transactions`);
  check('tokens left the wallet', tokBefore - (await token.balanceOf(me)) === ethers.parseEther('1000000'));
  check('ETH came back', (await local.getBalance(me)) > ethBefore, ethers.formatEther((await local.getBalance(me)) - ethBefore));

  // a second sale needs no new approvals
  await page.fill('#swap [data-el=amount]', '500000');
  await wait(() => /ETH/.test(document.querySelector('#swap [data-el=out]').textContent), null, 30000);
  const nonce2 = await local.getTransactionCount(me);
  await page.click('#swap [data-el=go]');
  await wait(() => /Done: sold/.test(document.querySelector('#swap [data-el=msg]').textContent));
  check('a second sale is one transaction', (await local.getTransactionCount(me)) === nonce2 + 1);

  // more than the wallet holds is caught before signing
  await page.fill('#swap [data-el=amount]', '999999999999');
  await page.click('#swap [data-el=go]');
  await wait(() => /less than that/.test(document.querySelector('#swap [data-el=msg]').textContent), null, 20000);
  check('selling more than held is refused before signing', true);

  // the Buy button scrolls to the panel and stays on the page
  const p2 = await ctx.newPage();
  await p2.goto(SITE + 'hook.html?a=' + rec.address, { waitUntil: 'networkidle' });
  await p2.waitForFunction(() => !document.querySelector('#swap').hidden, null, { timeout: 60000 });
  await p2.click('[data-to-swap]');
  await p2.waitForTimeout(400);
  check('Buy scrolls to the panel without leaving the page', p2.url().includes('hook.html') && await p2.evaluate(() => document.activeElement && document.activeElement.dataset.el === 'amount'));
  await p2.close();

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
