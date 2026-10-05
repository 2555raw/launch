/* End-to-end for "Launch a token", the public hook page and locks on My hooks,
   in a browser with a stand-in wallet, on a local chain that carries Robinhood
   Chain's own Uniswap code (copied from mainnet, as in e2e-app.js).

     npm run node                                  # terminal 1
     (cd ../.. && python3 -m http.server 8765)     # terminal 2
     node e2e-launch.js                            # terminal 3 (needs network for mainnet code)

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
const ADDR = { pm: pick('poolManager'), sv: pick('stateView'), posm: pick('positionManager'), permit2: pick('permit2'), proxy: pick('create2Deployer') };

const results = [];
const check = (n, c, x = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  (${x})` : ''}`); };

// The public page of a launch locked afterwards also finds the lock (through its Locked event).
async function fresh2(page, rec, _) {
  const p = await page.context().newPage();
  await p.goto(SITE + 'hook.html?a=' + rec.address, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('.hk-check').length >= 3, null, { timeout: 60000 });
  check('public page sees a lock added later from My hooks', /All of the pool's liquidity is locked/.test(await p.textContent('#checks')));
  await p.close();
}

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

  /* ===== launch ===== */
  await page.goto(SITE + 'launch.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  check('launch button starts disabled-free with a default label', (await page.textContent('#ln-go')).trim() === 'Launch token');
  await page.fill('#ln-name', 'Pink Moon');
  await page.fill('#ln-symbol', 'pink');
  await page.fill('#ln-eth', '1');
  await page.fill('#ln-share', '90');
  await page.fill('#ln-maxbuy', '0.1');
  check('button names the token', (await page.textContent('#ln-go')).trim() === 'Launch $PINK');
  const summary = await page.textContent('#ln-summary');
  check('summary shows price, market cap and what goes to the wallet', /1 ETH = 900M PINK/.test(summary) && /Starting market cap1\.111 ETH/.test(summary) && /To your wallet100M PINK/.test(summary), summary.replace(/\s+/g, ' ').slice(0, 160));
  check('price impact of the biggest buy is explained', /about 21%/.test(await page.textContent('#ln-impact')), await page.textContent('#ln-impact'));
  await page.click('#ln-lock label:has-text("30 days")');
  check('lock choice shows in the summary', /locked 30 days/.test(await page.textContent('#ln-summary')));

  // A bad symbol is caught before anything is signed.
  await page.fill('#ln-symbol', 'PINK MOON!');
  await page.click('#ln-go');
  check('a bad symbol is refused before signing', /symbol/i.test(await page.textContent('#ln-msg')));
  await page.fill('#ln-symbol', 'PINK');

  const ethBefore = await local.getBalance(me);
  const nonceBefore = await local.getTransactionCount(me);
  await page.click('#ln-go');
  await wait(() => !document.querySelector('#ln-done').hidden);
  const doneText = await page.textContent('#ln-done');
  check('page says the token is live', /\$PINK is live/.test(doneText), doneText.replace(/\s+/g, ' ').slice(0, 120));
  check('one transaction from the wallet', (await local.getTransactionCount(me)) === nonceBefore + 1);
  const stepLabels = await page.$$eval('#ln-steps li', (ls) => ls.map((l) => l.className + ':' + l.textContent.trim()));
  check('steps: compile, addresses, dry run, confirm, launch', stepLabels.length === 5 && stepLabels.every((s) => s.startsWith('is-done')), stepLabels.join(' | ').slice(0, 200));

  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('unyhooks-deployed'))[0]);
  const L = rec.launch;
  const token = new ethers.Contract(L.token, ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)', 'function totalSupply() view returns (uint256)'], local);
  check('token exists with its symbol and supply', (await token.symbol()) === 'PINK' && (await token.totalSupply()) === ethers.parseEther('1000000000'));
  check('10% of the supply (plus dust) went to the wallet', (await token.balanceOf(me)) >= ethers.parseEther('100000000'), ethers.formatEther(await token.balanceOf(me)));
  const spent = ethBefore - (await local.getBalance(me));
  check('about 1 ETH spent', spent > ethers.parseEther('0.999') && spent < ethers.parseEther('1.01'), ethers.formatEther(spent));
  const posm = new ethers.Contract(ADDR.posm, ['function ownerOf(uint256) view returns (address)', 'function safeTransferFrom(address,address,uint256)'], local);
  check('the position sits in a genuine lock', (await posm.ownerOf(L.tokenId)) === L.lock && ethers.keccak256(await local.getCode(L.lock)) === K.CODEHASH.lock);
  check('the token is a genuine UnyToken', ethers.keccak256(await local.getCode(L.token)) === K.CODEHASH.token);
  const lock = new ethers.Contract(L.lock, ['function unlockAt() view returns (uint256)'], local);
  const blockNow = (await local.getBlock('latest')).timestamp;
  const days = Number((await lock.unlockAt()) - BigInt(blockNow)) / 86400;
  check('locked for 30 days', days > 29.9 && days <= 30.01, days.toFixed(3));

  await wait(() => document.querySelectorAll('#ln-sources .ln-ok').length === 3, null, 60000);
  check('source of token, hook and lock published', true);
  const ids = sourcify.submitted.map((s) => s.contractIdentifier).sort();
  check('Sourcify got the three contracts, without a creation transaction', ids.join() === 'LaunchGuardHook.sol:LaunchGuardHook,LiquidityLock.sol:LiquidityLock,UnyToken.sol:UnyToken' && sourcify.submitted.every((s) => !s.creationTransactionHash), ids.join());
  // The submitted input rebuilds exactly the code on chain (runtime, immutables aside for the hook).
  const sub = sourcify.submitted.find((s) => s.contractIdentifier === 'UnyToken.sol:UnyToken');
  const re = JSON.parse(solc.compile(JSON.stringify({ ...sub.stdJsonInput, settings: { ...sub.stdJsonInput.settings, outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } })));
  check('submitted source rebuilds the token\'s code on chain', '0x' + re.contracts['UnyToken.sol'].UnyToken.evm.deployedBytecode.object === (await local.getCode(L.token)));

  await page.click('[data-act=watch]');
  const watched = await page.evaluate(() => window.__watched);
  check('"Add to wallet" asks the wallet to watch the token', watched.length === 1 && watched[0].options.address === L.token && watched[0].options.symbol === 'PINK');
  const share = await page.getAttribute('#ln-done a:has-text("Share on X")', 'href');
  check('share link carries the public page', decodeURIComponent(share).includes(`hook.html?a=${rec.address}`));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'launch-done.png'), fullPage: true });

  /* ===== public page ===== */
  await page.click('#ln-done a:has-text("Open its page")');
  await wait(() => document.querySelectorAll('.hk-check').length >= 4 && document.querySelector('#title').textContent.includes('PINK'));
  const checks = await page.$$eval('.hk-check', (cs) => cs.map((c) => `${c.className.replace('hk-check ', '')}: ${c.textContent.trim()}`));
  console.log('   ' + checks.join('\n   '));
  check('title is the token', (await page.textContent('#title')).startsWith('$PINK'));
  check('hook source shown as published', checks.some((c) => c.startsWith('is-ok') && /Hook source/.test(c)));
  check('token recognised: fixed supply, no owner', checks.some((c) => c.startsWith('is-ok') && /fixed supply of 1B, no owner/.test(c)));
  check('all liquidity shown as locked, with the date', checks.some((c) => c.startsWith('is-ok') && /All of the pool's liquidity is locked until/.test(c)));
  check('launch protection on, with a countdown', checks.some((c) => /Launch protection on, \d+:\d\d left/.test(c)));
  check('who launched it, in one transaction', checks.some((c) => /Launched by/.test(c) && /one transaction/.test(c)));
  const stats = await page.textContent('#stats');
  check('market cap and ETH in the pool from the chain', /Market cap1\.111\d* ETH/.test(stats) && /ETH in the poolabout (0\.999\d*|1)(?!\d)/.test(stats), stats.replace(/\s+/g, ' '));
  check('what the hook does, from its settings', /0\.1/.test(await page.textContent('#does')));
  await wait(() => /Locked until .* \d+d \d+h left/.test(document.querySelector('.hk-lock-time').textContent));
  check('the lock has a live countdown', true, await page.textContent('.hk-lock-time'));
  check('buy button goes to Uniswap with the token', (await page.getAttribute('#actions a:has-text("Buy $PINK")', 'href')).includes(`outputCurrency=${L.token}`));
  if (SHOTS) {
    await page.screenshot({ path: path.join(SHOTS, 'hook-page.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(SHOTS, 'hook-page-m.png'), fullPage: true });
    check('no sideways scroll on a phone', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  // A visitor without this browser's records sees the same, from the chain alone.
  const fresh = await ctx.newPage();
  await fresh.goto(SITE + 'hook.html?a=' + rec.address.toLowerCase(), { waitUntil: 'networkidle' });
  // Same origin, so this browser's records are set aside and put back afterwards.
  const kept = await fresh.evaluate(() => { const v = localStorage.getItem('unyhooks-deployed'); localStorage.clear(); return v; });
  await fresh.reload({ waitUntil: 'networkidle' });
  await fresh.waitForFunction(() => document.querySelectorAll('.hk-check').length >= 4, null, { timeout: 60000 });
  check('a fresh visitor gets the same checks from the chain', /All of the pool's liquidity is locked/.test(await fresh.textContent('#checks')));
  await fresh.evaluate((v) => localStorage.setItem('unyhooks-deployed', v), kept);
  await fresh.close();

  /* ===== My hooks ===== */
  await page.goto(SITE + 'hooks.html', { waitUntil: 'networkidle' });
  await wait(() => document.querySelectorAll('.mh-card').length === 1 && /1 PINK = /.test((document.querySelector('[data-live]') || {}).textContent || ''));
  check('My hooks lists the launch with its pool', (await page.textContent('.mh-pool-top b')) === 'PINK/ETH');
  await wait(() => /Locked until .* left/.test((document.querySelector('.mh-posrow.is-locked') || {}).textContent || ''));
  check('the launch position shows as locked, with time left', true, (await page.textContent('.mh-lockbadge')).trim());
  check('the card links to the public page', (await page.getAttribute('.mh-public a', 'href')).includes(`hook.html?a=${rec.address}`));

  // Trades earn fees for the locked position; anyone can send them to the owner.
  const swp = '@uniswap/v4-core/src/test/PoolSwapTest.sol';
  const rd = (q) => fs.readFileSync(require.resolve(q.replace(/^solmate\//, '@uniswap/v4-core/lib/solmate/').replace(/^forge-std\//, '@uniswap/v4-core/lib/forge-std/src/')), 'utf8');
  const art = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { [swp]: { content: rd(swp) } }, settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 }, outputSelection: { [swp]: { PoolSwapTest: ['abi', 'evm.bytecode.object'] } } } }), { import: (q) => { try { return { contents: rd(q) }; } catch (_) { return { error: 'nf ' + q }; } } })).contracts[swp].PoolSwapTest;
  const trader = await local.getSigner(3);
  const swapper = await new ethers.ContractFactory(art.abi, '0x' + art.evm.bytecode.object, trader).deploy(ADDR.pm);
  await swapper.waitForDeployment();
  const key = rec.pools[0].key;
  for (let i = 0; i < 3; i++) {
    await (await swapper.swap(key, { zeroForOne: true, amountSpecified: -(5n * 10n ** 16n), sqrtPriceLimitX96: 4295128740n }, { takeClaims: false, settleUsingBurn: false }, '0x', { value: 5n * 10n ** 16n })).wait();
    await local.send('evm_increaseTime', [31]);
  }
  await page.click('#wallet');
  await wait(() => document.querySelector('#wallet').classList.contains('is-on') && !!document.querySelector('.mh-posrow.is-locked [data-act=collect]'));
  const beforeFees = await local.getBalance(me);
  await page.click('.mh-posrow.is-locked [data-act=collect]');
  await wait(() => /Fees from position/.test(document.querySelector('#msg').textContent));
  const got = (await local.getBalance(me)) - beforeFees;
  check('"Collect fees" sends the trading fees to the owner', got > 10n ** 15n, `${ethers.formatEther(got)} ETH net of gas`);
  check('"Take back" is not offered before the date', !(await page.$('.mh-posrow.is-locked [data-act=withdraw]')));

  /* ===== a second launch without a lock, locked afterwards from My hooks ===== */
  await page.goto(SITE + 'launch.html', { waitUntil: 'networkidle' });
  await page.fill('#ln-name', 'Second');
  await page.fill('#ln-symbol', 'TWO');
  await page.fill('#ln-eth', '0.2');
  await page.click('#ln-lock label:has-text("No lock")');
  await page.click('#ln-fee label:has-text("0.3%")');
  await page.click('#ln-go');
  await wait(() => !document.querySelector('#ln-done').hidden);
  const rec2 = await page.evaluate(() => JSON.parse(localStorage.getItem('unyhooks-deployed'))[0]);
  check('a launch without a lock leaves the position in the wallet', rec2.launch.lock === null && (await posm.ownerOf(rec2.launch.tokenId)) === me && rec2.pools[0].key.fee === 3000);

  await page.goto(SITE + 'hooks.html', { waitUntil: 'networkidle' });
  await page.click('#wallet');
  const row = `[data-hook="${rec2.address}"] .mh-posrow`;
  await wait((sel) => /Not locked/.test((document.querySelector(sel) || {}).textContent || ''), row);
  check('My hooks shows the unlocked position', true);
  await page.click(`${row} [data-act=lock-open]`);
  await page.click(`${row} label:has-text("90 days")`);
  const nonceLock = await local.getTransactionCount(me);
  await page.click(`${row} [data-act=lock-go]`);
  await wait((sel) => /Locked until/.test((document.querySelector(sel) || {}).textContent || ''), row);
  check('locking takes two transactions', (await local.getTransactionCount(me)) === nonceLock + 2);
  const holder = await posm.ownerOf(rec2.launch.tokenId);
  check('the position now sits in a genuine lock', ethers.keccak256(await local.getCode(holder)) === K.CODEHASH.lock, holder);
  const lock2 = new ethers.Contract(holder, ['function unlockAt() view returns (uint256)', 'function owner() view returns (address)'], local);
  const d2 = Number((await lock2.unlockAt()) - BigInt((await local.getBlock('latest')).timestamp)) / 86400;
  check('locked for 90 days, owned by the wallet', d2 > 89.9 && d2 <= 90.01 && (await lock2.owner()) === me, d2.toFixed(2));
  check('the new lock\'s source was sent to Sourcify', sourcify.submitted.some((x) => x.address.toLowerCase() === holder.toLowerCase() && x.contractIdentifier === 'LiquidityLock.sol:LiquidityLock' && x.creationTransactionHash));

  await fresh2(page, rec2, 'Liquidity');
  await local.send('evm_increaseTime', [91 * 86400]);
  await local.send('evm_mine', []);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#wallet');
  await wait((sel) => !!document.querySelector(`${sel} [data-act=withdraw]`), row);
  await page.click(`${row} [data-act=withdraw]`);
  await wait(() => /back in your wallet/.test(document.querySelector('#msg').textContent));
  check('after the date, "Take back" returns the position', (await posm.ownerOf(rec2.launch.tokenId)) === me);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'hooks-locks.png'), fullPage: true });

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed${errors.length ? `  page errors: ${errors.join(' | ')}` : ''}`);
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
