/* End-to-end: the builder deploys hooks and creates pools from a simulated
   browser wallet, on a local chain that answers as Robinhood Chain (4663) with
   Uniswap's PoolManager, the standard CREATE2 deployer and StateView deployed
   on it. Then liquidity and swaps go through the new pool to prove the hook
   works. mainnet-sim.js covers the real Robinhood Chain contracts.

     npm run node                                     # terminal 1
     (cd ../.. && python3 -m http.server 8765)        # terminal 2: the site
     npm run e2e                                      # terminal 3

   A local chain rather than a fork: the public RPC keeps very little history,
   so a fork loses its state within minutes. */
const fs = require('fs');
const { ethers } = require('ethers');
const solc = require('solc');
const { chromium } = require('playwright');

const RPC = 'http://localhost:8545';
const SITE = 'http://localhost:8765/';
const PROXY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
// Runtime code of Arachnid's deterministic deployment proxy, as on Robinhood Chain.
const PROXY_CODE = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3';
const results = [];
const check = (n, c, x = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  (${x})` : ''}`); };

function compileLib() {
  const files = {
    PoolManager: '@uniswap/v4-core/src/PoolManager.sol',
    StateView: '@uniswap/v4-periphery/src/lens/StateView.sol',
    MockERC20: '@uniswap/v4-core/lib/solmate/src/test/utils/mocks/MockERC20.sol',
    PoolSwapTest: '@uniswap/v4-core/src/test/PoolSwapTest.sol',
    PoolModifyLiquidityTest: '@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol'
  };
  const sources = {};
  for (const f of Object.values(files)) sources[f] = { content: fs.readFileSync(require.resolve(f), 'utf8') };
  const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } }), {
    import: (p) => { try { return { contents: fs.readFileSync(require.resolve(p.replace(/^solmate\//, '@uniswap/v4-core/lib/solmate/').replace(/^forge-std\//, '@uniswap/v4-core/lib/forge-std/src/')), 'utf8') }; } catch (_) { return { error: 'nf ' + p }; } }
  }));
  const errs = (out.errors || []).filter((e) => e.severity === 'error'); if (errs.length) throw new Error(errs[0].formattedMessage);
  const art = {}; for (const [n, f] of Object.entries(files)) art[n] = { abi: out.contracts[f][n].abi, bytecode: '0x' + out.contracts[f][n].evm.bytecode.object };
  return art;
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC, 4663, { staticNetwork: true });
  const owner = await provider.getSigner(0);
  const ownerAddr = await owner.getAddress();
  const art = compileLib();
  await provider.send('hardhat_setCode', [PROXY, PROXY_CODE]);
  const pmC = await (await new ethers.ContractFactory(art.PoolManager.abi, art.PoolManager.bytecode, owner).deploy(ownerAddr)).waitForDeployment();
  const PM = await pmC.getAddress();
  const svC = await (await new ethers.ContractFactory(art.StateView.abi, art.StateView.bytecode, owner).deploy(PM)).waitForDeployment();
  const STATE_VIEW = await svC.getAddress();
  const dep = async (a, ...args) => { const c = await new ethers.ContractFactory(a.abi, a.bytecode, owner).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await dep(art.MockERC20, 'Test Token', 'TEST', 18);
  const TOKEN = await token.getAddress();
  await (await token.mint(ownerAddr, 10n ** 30n)).wait();
  const lp = await dep(art.PoolModifyLiquidityTest, PM);
  const sw = await dep(art.PoolSwapTest, PM);
  await (await token.approve(await lp.getAddress(), ethers.MaxUint256)).wait();
  await (await token.approve(await sw.getAddress(), ethers.MaxUint256)).wait();
  console.log('test token', TOKEN);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  await ctx.route(SITE + 'config.js', async (r) => {
    const body = (await (await r.fetch()).text())
      .replace("rpcUrl:      'https://rpc.mainnet.chain.robinhood.com'", `rpcUrl:      '${RPC}'`)
      .replace("poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951'", `poolManager: '${PM}'`);
    r.fulfill({ body, contentType: 'application/javascript' });
  });
  await ctx.addInitScript(({ rpc }) => {
    let id = 0;
    const send = async (method, params = []) => {
      const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
      const j = await r.json();
      if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
      return j.result;
    };
    window.__calls = [];
    window.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }) => {
        window.__calls.push(method);
        if (window.__reject === method) { const e = new Error('User rejected the request.'); e.code = 4001; throw e; }
        if (method === 'eth_requestAccounts') return send('eth_accounts');
        if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
        return send(method, params);
      },
      on() {}, removeListener() {}
    };
  }, { rpc: RPC });

  const page = await ctx.newPage();
  // On any wait timeout, say where the page was.
  const origWait = page.waitForFunction.bind(page);
  page.waitForFunction = async (...a) => {
    try { return await origWait(...a); } catch (e) {
      console.log('WAIT FAILED. hook note:', await page.textContent('#dp-hook-note'), '| pool note:', await page.textContent('#dp-pool-note'), '| msg:', await page.textContent('#dp-msg'));
      throw e;
    }
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(SITE + 'build.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });

  /* --- fee hook --- */
  const R = ethers.Wallet.createRandom().address;
  await page.click('[data-recipe=fee]');
  await page.fill('[data-key=recipient]', R);
  check('deploy button waits for a wallet', await page.$eval('#dp-deploy', (b) => b.disabled));
  await page.click('#dp-connect');
  try {
    await page.waitForFunction(() => document.querySelector('#dp-step-connect').dataset.state === 'done', null, { timeout: 30000 });
  } catch (e) {
    console.log('STUCK msg:', await page.textContent('#dp-msg'), '| note:', await page.textContent('#dp-connect-note'), '| btn disabled:', await page.$eval('#dp-connect', b => b.disabled), '| calls:', await page.evaluate(() => window.__calls.join(',')));
    throw e;
  }
  check('wallet connects', (await page.textContent('#dp-connect-note')).includes('on Robinhood Chain'));
  check('top chip shows the account', (await page.textContent('#wallet')).startsWith('0x'));

  // rejection first
  await page.evaluate(() => { window.__reject = 'eth_sendTransaction'; });
  await page.click('#dp-deploy');
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#dp-msg').textContent), null, { timeout: 120000 });
  check('rejecting in the wallet sends nothing', true, await page.textContent('#dp-msg'));
  await page.evaluate(() => { window.__reject = null; });

  const t0 = Date.now();
  await page.click('#dp-deploy');
  await page.waitForFunction(() => document.querySelector('#dp-step-hook').dataset.state === 'done', null, { timeout: 120000 });
  const hookAddr = (await page.textContent('#dp-hook-result')).match(/0x[0-9a-fA-F]{40}/)[0];
  check('fee hook deploys from the browser', true, `${hookAddr} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  check('hook address carries afterSwap + return-delta bits', (BigInt(hookAddr) & 0x3fffn) === 0x44n, '0x' + (BigInt(hookAddr) & 0x3fffn).toString(16));
  check('hook has code on chain', (await provider.getCode(hookAddr)).length > 10);
  const hook = new ethers.Contract(hookAddr, ['function recipient() view returns (address)', 'function FEE_BPS() view returns (uint256)'], provider);
  check('hook stores the recipient', (await hook.recipient()) === R);
  check('hook fee is 1%', (await hook.FEE_BPS()) === 100n);

  // pool: TEST / ETH, 1 TEST = 0.001 ETH
  await page.fill('#dp-token-a', TOKEN);
  await page.dispatchEvent('#dp-token-a', 'change');
  try { await page.waitForFunction(() => /decimals/.test(document.querySelector('#dp-token-a-info').textContent), null, { timeout: 20000 }); }
  catch (e) { console.log('TOKEN INFO:', await page.textContent('#dp-token-a-info'), '| pool form hidden:', await page.$eval('#dp-pool', f => f.hidden), '| msg:', await page.textContent('#dp-msg')); throw e; }
  check('pool form reads the token', (await page.textContent('#dp-token-a-info')).includes('18 decimals'));
  check('ETH is the default pair', (await page.textContent('#dp-token-b-info')).includes('ETH'));
  await page.fill('#dp-price', '0.001');
  await page.click('#dp-create');
  await page.waitForFunction(() => document.querySelector('#dp-step-pool').dataset.state === 'done', null, { timeout: 120000 });
  const poolId = (await page.textContent('#dp-pool-result')).match(/0x[0-9a-fA-F]{64}/)[0];
  check('pool is created from the browser', true, poolId);

  const sv = new ethers.Contract(STATE_VIEW, ['function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)'], provider);
  const slot = await sv.getSlot0(poolId);
  // ETH (0x0) is currency0, TEST is currency1: price1/0 = 1000 → sqrt = 31.62 → ~ 2.505e30
  const want = 1000;
  const got = Number(slot.sqrtPriceX96) ** 2 / 2 ** 192;
  check('pool starts at the right price', Math.abs(got - want) / want < 1e-9, `1 ETH = ${got.toFixed(6)} TEST`);

  // liquidity + swaps through the new pool
  const key = { currency0: ethers.ZeroAddress, currency1: TOKEN, fee: 3000, tickSpacing: 60, hooks: hookAddr };
  const lpc = new ethers.Contract(await lp.getAddress(), art.PoolModifyLiquidityTest.abi, owner);
  await (await lpc['modifyLiquidity((address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)'](
    key, { tickLower: 60, tickUpper: 138120, liquidityDelta: 10n ** 20n, salt: ethers.ZeroHash }, '0x', { value: 10n ** 20n })).wait();
  const swc = new ethers.Contract(await sw.getAddress(), art.PoolSwapTest.abi, owner);
  const MIN = 4295128740n, MAX = 1461446703485210103287273052203988822378723970341n;
  await (await swc.swap(key, { zeroForOne: true, amountSpecified: -(10n ** 17n), sqrtPriceLimitX96: MIN }, { takeClaims: false, settleUsingBurn: false }, '0x', { value: 10n ** 17n })).wait();
  const feeTokens = await token.balanceOf(R);
  check('swap ETH→TEST pays 1% to the recipient in TEST', feeTokens > 0n, ethers.formatEther(feeTokens) + ' TEST');
  await (await swc.swap(key, { zeroForOne: false, amountSpecified: -(10n ** 18n), sqrtPriceLimitX96: MAX }, { takeClaims: false, settleUsingBurn: false }, '0x')).wait();
  const feeEth = await provider.getBalance(R);
  check('swap TEST→ETH pays 1% to the recipient in ETH', feeEth > 0n, ethers.formatEther(feeEth) + ' ETH');

  /* --- dynamic fee hook --- */
  await page.click('[data-recipe=dynamic]');
  await page.waitForFunction(() => !document.querySelector('#dp-deploy').disabled);
  check('changing the hook re-opens step 2', (await page.textContent('#dp-deploy')) === 'Deploy new version');
  await page.click('#dp-deploy');
  await page.waitForFunction(() => document.querySelector('#dp-step-hook').dataset.state === 'done', null, { timeout: 120000 });
  const dynAddr = (await page.textContent('#dp-hook-result')).match(/0x[0-9a-fA-F]{40}/)[0];
  check('dynamic hook deploys', (BigInt(dynAddr) & 0x3fffn) === 0x1080n, dynAddr);
  check('fee picker hidden for dynamic', await page.$eval('#dp-fee-field', (e) => e.hidden));
  // second pool is a fresh form: the previous pool step was done, a new hook resets it
  await page.waitForSelector('#dp-pool:not([hidden])');
  await page.fill('#dp-token-a', TOKEN); await page.dispatchEvent('#dp-token-a', 'change');
  await page.fill('#dp-price', '0.002');
  await page.click('#dp-create');
  await page.waitForFunction(() => document.querySelector('#dp-step-pool').dataset.state === 'done' && /0x[0-9a-f]{64}/i.test(document.querySelector('#dp-pool-result').textContent), null, { timeout: 120000 });
  const dynPool = (await page.textContent('#dp-pool-result')).match(/0x[0-9a-fA-F]{64}/)[0];
  check('dynamic-fee pool created', dynPool !== poolId, dynPool);

  /* --- launch hook: refuses a pool without its token --- */
  await page.click('[data-recipe=launch]');
  await page.fill('[data-key=token]', TOKEN);
  await page.click('#dp-deploy');
  await page.waitForFunction(() => document.querySelector('#dp-step-hook').dataset.state === 'done', null, { timeout: 120000 });
  check('launch hook deploys', true);
  await page.waitForSelector('#dp-pool:not([hidden])');
  check('launch pool locks token A to the protected token', await page.$eval('#dp-token-a', (e) => e.readOnly && e.value.toLowerCase()) === TOKEN.toLowerCase());
  await page.fill('#dp-price', '0');
  await page.click('#dp-create');
  check('zero price refused with a clear message', (await page.textContent('#dp-msg')).includes('above zero'));
  await page.fill('#dp-price', '0.001');
  await page.click('#dp-create');
  await page.waitForFunction(() => document.querySelector('#dp-step-pool').dataset.state === 'done', null, { timeout: 120000 });
  check('launch pool created', true);
  // same pool again → friendly "already exists"
  await page.evaluate(() => { document.querySelector('#dp-pool').hidden = false; document.querySelector('#dp-step-pool').dataset.state = 'active'; });
  await page.click('#dp-create');
  await page.waitForFunction(() => document.querySelector('#dp-msg').textContent.length > 0, null, { timeout: 60000 });
  check('creating the same pool twice explains why it fails', (await page.textContent('#dp-msg')).includes('already exists'), await page.textContent('#dp-msg'));

  await page.screenshot({ path: '../deploy-done.png', fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  await page.$eval('#deploy', (e) => e.scrollIntoView());
  await page.screenshot({ path: '../deploy-panel.png' });
  check('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
