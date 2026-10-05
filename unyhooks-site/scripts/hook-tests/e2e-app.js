/* End-to-end for the whole app flow, on a local chain that carries Robinhood
   Chain's own contract code: the runtime bytecode of Uniswap's PoolManager,
   PositionManager, StateView, Permit2 and the CREATE2 deployer is copied from
   mainnet to the same addresses, so the pages run with their real config.

   In a browser with a stand-in wallet: deploy a hook, publish its source
   (Sourcify stubbed, and the submitted input recompiled here to prove it
   reproduces the deployed bytecode), create a pool, add liquidity (full range
   and a custom range) through Permit2 and the PositionManager, swap through
   the pool, then use "My hooks": source badge, live price, positions,
   unfollow / follow by address, add a pool by ID, create a pool.

     npm run node                                  # terminal 1
     (cd ../.. && python3 -m http.server 8765)     # terminal 2
     node e2e-app.js                               # terminal 3 (needs network for mainnet code) */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const solc = require('solc');
const { chromium } = require('playwright');

const RPC = 'http://localhost:8545';
const MAINNET = 'https://rpc.mainnet.chain.robinhood.com';
const SITE = 'http://localhost:8765/';
const cfgSrc = fs.readFileSync(path.join(__dirname, '../../config.js'), 'utf8');
const pick = (k) => cfgSrc.match(new RegExp(`${k}:\\s*'(0x[0-9a-fA-F]{40})'`))[1];
const ADDR = { pm: pick('poolManager'), sv: pick('stateView'), posm: pick('positionManager'), permit2: pick('permit2'), proxy: pick('create2Deployer') };

const results = [];
const check = (n, c, x = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  (${x})` : ''}`); };

const resolve = (p) => fs.readFileSync(require.resolve(p.replace(/^solmate\//, '@uniswap/v4-core/lib/solmate/').replace(/^forge-std\//, '@uniswap/v4-core/lib/forge-std/src/')), 'utf8');
function compile(files) {
  const sources = {};
  for (const f of Object.values(files)) sources[f] = { content: resolve(f) };
  const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } }), { import: (p) => { try { return { contents: resolve(p) }; } catch (_) { return { error: 'nf ' + p }; } } }));
  const errs = (out.errors || []).filter((e) => e.severity === 'error'); if (errs.length) throw new Error(errs[0].formattedMessage);
  const art = {}; for (const [n, f] of Object.entries(files)) art[n] = { abi: out.contracts[f][n].abi, bytecode: '0x' + out.contracts[f][n].evm.bytecode.object };
  return art;
}

(async () => {
  const local = new ethers.JsonRpcProvider(RPC, 4663, { staticNetwork: true });
  const main = new ethers.JsonRpcProvider(MAINNET, 4663, { staticNetwork: true });
  for (const [name, a] of Object.entries(ADDR)) {
    const code = await main.getCode(a);
    if (code.length < 10) throw new Error(`no ${name} code on mainnet`);
    await local.send('hardhat_setCode', [a, code]);
  }
  const owner = await local.getSigner(0);
  const ownerAddr = await owner.getAddress();
  const art = compile({ MockERC20: '@uniswap/v4-core/lib/solmate/src/test/utils/mocks/MockERC20.sol', PoolSwapTest: '@uniswap/v4-core/src/test/PoolSwapTest.sol' });
  const dep = async (a, ...args) => { const c = await new ethers.ContractFactory(a.abi, a.bytecode, owner).deploy(...args); await c.waitForDeployment(); return c; };
  const test = await dep(art.MockERC20, 'Test Token', 'TEST', 18);
  const test2 = await dep(art.MockERC20, 'Second Token', 'TWO', 6);
  await (await test.mint(ownerAddr, 10n ** 30n)).wait();
  await (await test2.mint(ownerAddr, 10n ** 18n)).wait();
  const TEST = await test.getAddress();
  const TWO = await test2.getAddress();
  const swapper = await dep(art.PoolSwapTest, ADDR.pm);
  await (await test.approve(await swapper.getAddress(), ethers.MaxUint256)).wait();

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  await ctx.route(SITE + 'config.js', async (r) => r.fulfill({ contentType: 'application/javascript', body: (await (await r.fetch()).text()).replace(/rpcUrl:\s*'[^']+'/, `rpcUrl: '${RPC}'`) }));
  // Sourcify, stubbed: remembers what was submitted and reports a match.
  const sourcify = { submitted: null, verified: new Set() };
  await ctx.route(/sourcify\.dev\/server\/v2\/verify\/4663\//, async (r) => { sourcify.submitted = JSON.parse(r.request().postData()); sourcify.verified.add(r.request().url().split('/').pop().toLowerCase()); r.fulfill({ status: 202, contentType: 'application/json', body: '{"verificationId":"job-1"}' }); });
  await ctx.route(/sourcify\.dev\/server\/v2\/verify\/job-1/, (r) => r.fulfill({ contentType: 'application/json', body: '{"isJobCompleted":true,"contract":{"match":"exact_match"}}' }));
  await ctx.route(/sourcify\.dev\/server\/v2\/contract\/4663\//, (r) => { const a = r.request().url().split('/').pop().toLowerCase(); r.fulfill(sourcify.verified.has(a) ? { contentType: 'application/json', body: '{"match":"exact_match"}' } : { status: 404, body: '{}' }); });
  // Optional local copies of ethers (ETHERS_UMD=path) and the compiler (SOLJSON=path),
  // so a slow CDN cannot fail the run.
  if (process.env.SOLJSON) await ctx.route(/cdn\.jsdelivr\.net\/npm\/solc@0\.8\.26\/soljson\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.SOLJSON, 'utf8') }));
  if (process.env.ETHERS_UMD) await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/ethers\//, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.ETHERS_UMD, 'utf8') }));
  await ctx.route(/api\.dexscreener\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"pairs":null}' }));
  await ctx.addInitScript(({ rpc }) => {
    let id = 0;
    const send = async (method, params = []) => {
      const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
      const j = await r.json();
      if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
      return j.result;
    };
    window.ethereum = { isMetaMask: true, request: async ({ method, params }) => (method === 'eth_requestAccounts' ? send('eth_accounts') : /^wallet_(switch|add)/.test(method) ? null : send(method, params)), on() {}, removeListener() {} };
  }, { rpc: RPC });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const wait = (fn, arg, ms = 120000) => page.waitForFunction(fn, arg, { timeout: ms }).catch(async (e) => {
    console.log('PAGE ERRORS:', errors, '| list:', (await page.textContent('#list').catch(() => '')).replace(/\s+/g, ' ').slice(0, 400));
    console.log('WAIT FAILED. msg:', await page.textContent('#dp-msg').catch(() => ''), '| lq:', await page.$$eval('.lq [data-el=msg]', (els) => els.map((x) => x.textContent)).catch(() => ''));
    throw e;
  });

  /* ===== builder: deploy + publish source ===== */
  await page.goto(SITE + 'build.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  const R = ethers.Wallet.createRandom().address;
  await page.click('[data-recipe=fee]');
  await page.fill('[data-key=recipient]', R);
  await page.click('#dp-connect');
  await wait(() => document.querySelector('#dp-step-connect').dataset.state === 'done');
  await page.click('#dp-deploy');
  await wait(() => document.querySelector('#dp-step-hook').dataset.state === 'done');
  const hook = (await page.textContent('#dp-hook-result')).match(/0x[0-9a-fA-F]{40}/)[0];
  check('hook deployed with mainnet contract code in place', (await local.getCode(hook)).length > 10, hook);
  await wait(() => /Source published/.test(document.querySelector('#dp-source').textContent), null, 60000);
  check('source published automatically after deploy', true);
  const sub = sourcify.submitted;
  check('Sourcify request names compiler and contract', sub.compilerVersion === '0.8.26+commit.8a97fa7a' && sub.contractIdentifier === 'SwapFeeHook.sol:SwapFeeHook' && /^0x[0-9a-f]{64}$/.test(sub.creationTransactionHash), `${sub.compilerVersion} ${sub.contractIdentifier}`);
  // The submitted input must rebuild the exact bytes that were deployed.
  const re = JSON.parse(solc.compile(JSON.stringify({ ...sub.stdJsonInput, settings: { ...sub.stdJsonInput.settings, outputSelection: { '*': { '*': ['evm.bytecode.object'] } } } })));
  const rebuilt = '0x' + re.contracts['SwapFeeHook.sol'].SwapFeeHook.evm.bytecode.object;
  const deployTx = await local.getTransaction(sub.creationTransactionHash);
  check('submitted source recompiles to the deployed bytecode', deployTx.data.toLowerCase().slice(66).startsWith(rebuilt.slice(2).toLowerCase()), `${rebuilt.length / 2 - 1} bytes`);

  /* ===== builder: pool + liquidity ===== */
  await page.fill('#dp-token-a', TEST);
  await page.dispatchEvent('#dp-token-a', 'change');
  await wait(() => /decimals/.test(document.querySelector('#dp-token-a-info').textContent));
  await page.fill('#dp-price', '0.001');
  await page.click('#dp-create');
  await wait(() => document.querySelector('#dp-step-pool').dataset.state === 'done');
  const poolId = (await page.textContent('#dp-pool-result')).match(/0x[0-9a-fA-F]{64}/)[0];
  check('pool created on the mainnet PoolManager code', true, poolId.slice(0, 18));
  await wait(() => document.querySelector('#dp-step-liquidity').dataset.state === 'active' && /1 TEST = 0\.001 ETH/.test(document.querySelector('.lq [data-el=price]').textContent));
  check('liquidity step opens with the live price', true, await page.textContent('.lq [data-el=price]'));

  await page.fill('.lq [data-el=amt-a]', '1000');
  await wait(() => document.querySelector('.lq [data-el=amt-b]').value !== '');
  const ethShown = Number(await page.inputValue('.lq [data-el=amt-b]'));
  check('typing TEST fills the matching ETH', Math.abs(ethShown - 1) < 0.01, `${ethShown} ETH for 1000 TEST`);
  const ethBefore = await local.getBalance(ownerAddr);
  await page.click('.lq [data-el=go]');
  await wait(() => /Liquidity added/.test(document.querySelector('.lq [data-el=msg]').textContent));
  const lqMsg = await page.textContent('.lq [data-el=msg]');
  check('liquidity added from the page', true, lqMsg.slice(0, 60));
  const steps = await page.$$eval('.lq-steps li', (ls) => ls.map((l) => l.textContent.trim()));
  check('approvals then mint, as separate steps', steps.length === 3 && /Permit2/.test(steps[0]) && /Uniswap/.test(steps[1]) && /Add the liquidity/.test(steps[2]), steps.join(' | '));
  const sv = new ethers.Contract(ADDR.sv, ['function getLiquidity(bytes32) view returns (uint128)'], local);
  const L1 = await sv.getLiquidity(poolId);
  check('pool has liquidity on chain', L1 > 0n, L1.toString());
  const spent = ethBefore - (await local.getBalance(ownerAddr));
  check('unused ETH came back (sweep)', spent < ethers.parseEther('1.01') && spent > ethers.parseEther('0.98'), `${ethers.formatEther(spent)} ETH spent incl. gas`);
  const tokenId = (lqMsg.match(/#(\d+)/) || [])[1];
  const posm = new ethers.Contract(ADDR.posm, ['function getPositionLiquidity(uint256) view returns (uint128)', 'function ownerOf(uint256) view returns (address)'], local);
  check('position NFT belongs to the wallet', tokenId !== undefined && (await posm.ownerOf(tokenId)) === ownerAddr, `#${tokenId}`);

  // second deposit: custom range, TEST only side check
  await page.click('.lq input[value=custom]');
  await page.fill('.lq [data-el=min]', '0.0005');
  await page.fill('.lq [data-el=max]', '0.002');
  await page.fill('.lq [data-el=amt-a]', '100');
  await wait(() => document.querySelector('.lq [data-el=amt-b]').value !== '');
  await page.click('.lq [data-el=go]');
  await wait(() => /Liquidity added/.test(document.querySelector('.lq [data-el=msg]').textContent) && document.querySelectorAll('.lq-steps li').length === 1);
  check('custom range deposit needs no new approvals', (await page.$$eval('.lq-steps li', (ls) => ls.length)) === 1);
  check('pool liquidity grew', (await sv.getLiquidity(poolId)) > L1);

  // a swap through the new pool pays the hook's fee
  const key = { currency0: ethers.ZeroAddress, currency1: TEST, fee: 3000, tickSpacing: 60, hooks: hook };
  await (await swapper.swap(key, { zeroForOne: true, amountSpecified: -(10n ** 16n), sqrtPriceLimitX96: 4295128740n }, { takeClaims: false, settleUsingBurn: false }, '0x', { value: 10n ** 16n })).wait();
  check('a swap through the pool pays the hook fee', (await test.balanceOf(R)) > 0n, `${ethers.formatEther(await test.balanceOf(R))} TEST`);

  /* ===== My hooks ===== */
  await page.goto(SITE + 'hooks.html', { waitUntil: 'networkidle' });
  await wait(() => document.querySelectorAll('.mh-card').length === 1 && /Source published/.test(document.querySelector('[data-source]').textContent) && /1 TEST = 0\.001/.test(document.querySelector('[data-live]').textContent));
  check('My hooks lists the hook, source badge and live price', true, await page.textContent('[data-live]'));
  check('positions listed with Uniswap links', (await page.$$eval('.mh-stats a', (as) => as.map((a) => a.href))).filter((h) => h.includes('/positions/v4/robinhood/')).length === 2);
  check('what it does is described', (await page.textContent('.mh-does')).includes('1%'));

  await page.click('[data-act=unfollow]');
  check('stop following empties the list', await page.isVisible('#empty'));
  await page.fill('#follow-input', hook);
  await page.click('#follow button[type=submit]');
  await wait(() => document.querySelectorAll('.mh-card').length === 1);
  check('following by address recognises a 1% fee hook', (await page.textContent('.mh-card h2')).includes('SwapFeeHook') && (await page.textContent('.mh-does')).includes('1%'), await page.textContent('.mh-card h2'));
  await page.click('[data-act=find-pool]');
  await page.fill('[data-find-pool] input[name=poolid]', poolId);
  await page.click('[data-find-pool] button[type=submit]');
  await wait(() => document.querySelectorAll('.mh-pool').length === 1 && /1 TEST = 0\.001/.test(document.querySelector('[data-live]').textContent));
  check('pool found by its ID, through the Initialize event', (await page.textContent('.mh-pool-top b')) === 'TEST/ETH');

  await page.click('#wallet');
  await wait(() => document.querySelector('#wallet').classList.contains('is-on'));
  await page.click('[data-act=new-pool]');
  await page.fill('[data-new-pool] input[name=a]', TEST);
  await page.fill('[data-new-pool] input[name=b]', TWO);
  await page.fill('[data-new-pool] input[name=price]', '2.5');
  await page.click('[data-new-pool] button[type=submit]');
  await wait(() => document.querySelectorAll('.mh-pool').length === 2);
  check('a second pool created from My hooks', (await page.$$eval('.mh-pool-top b', (bs) => bs.map((b) => b.textContent))).includes('TEST/TWO'));
  await wait(() => [...document.querySelectorAll('[data-live]')].some((e) => /1 TEST = 2\.5 TWO/.test(e.textContent)));
  check('its price reads back with mixed decimals (18 and 6)', true);
  const second = await page.$('.mh-pool:has(.mh-pool-top b:text("TEST/TWO"))');
  await (await second.$('[data-act=liquidity]')).click();
  await (await second.$('[data-el=amt-a]')).fill('10');
  await page.waitForTimeout(200);
  check('liquidity form on My hooks computes the other side', Math.abs(Number(await (await second.$('[data-el=amt-b]')).inputValue()) - 25) < 0.1);
  await (await second.$('[data-el=go]')).click();
  await page.waitForFunction((el) => /Liquidity added|refused|Not enough/i.test(el.querySelector('[data-el=msg]').textContent), second, { timeout: 120000 });
  check('liquidity added to an ERC-20/ERC-20 pool', /Liquidity added/.test(await (await second.$('[data-el=msg]')).textContent()), (await (await second.$('[data-el=msg]')).textContent()).slice(0, 80));

  await page.waitForFunction((el) => /#\d+/.test(el.querySelector('[data-pos]').textContent), second, { timeout: 20000 });
  check('the new position shows in its pool without a reload, message kept', /#\d+/.test(await (await second.$('[data-pos]')).textContent()) && /Liquidity added/.test(await (await second.$('[data-el=msg]')).textContent()));
  check('pool liquidity reads "added" before DexScreener knows it', (await (await second.$('[data-liq]')).textContent()) === 'added');
  await page.screenshot({ path: path.join(__dirname, 'e2e-app-hooks.png'), fullPage: true });
  check('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
