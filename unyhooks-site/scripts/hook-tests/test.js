/* Behaviour tests for the UnyHooks templates.

   Builds each recipe with builder.js, compiles it together with Uniswap V4's
   own PoolManager and test routers (solc 0.8.26), deploys everything on
   Hardhat's in-process chain, mines a CREATE2 salt so the hook lands on an
   address with the right permission bits, then swaps through real pools and
   checks the outcome.

     cd unyhooks-site/scripts/hook-tests
     npm install
     npm test
*/

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const hre = require('hardhat');
const { ethers } = require('ethers');
const B = require('../../builder.js');

// Hardhat's in-process chain, driven through plain ethers.
const provider = new ethers.BrowserProvider(hre.network.provider);

/* ---------- compile ---------- */

const pkg = (p) => require.resolve(p, { paths: [__dirname] });
const REMAP = [
  ['solmate/', '@uniswap/v4-core/lib/solmate/'],
  ['forge-std/', '@uniswap/v4-core/lib/forge-std/src/'],
  ['@openzeppelin/', '@uniswap/v4-core/lib/openzeppelin-contracts/']
];
const readImport = (p) => {
  let target = p;
  for (const [from, to] of REMAP) if (target.startsWith(from)) target = to + target.slice(from.length);
  try { return { contents: fs.readFileSync(pkg(target), 'utf8') }; } catch (_) { return { error: `not found: ${p}` }; }
};

const LIB = {
  PoolManager: '@uniswap/v4-core/src/PoolManager.sol',
  PoolSwapTest: '@uniswap/v4-core/src/test/PoolSwapTest.sol',
  PoolModifyLiquidityTest: '@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol',
  TestERC20: '@uniswap/v4-core/src/test/TestERC20.sol'
};

const ADDR_PLACEHOLDER = '0x1111111111111111111111111111111111111111';
const HOOKS = {
  fee: B.generate('fee', { feePercent: 1, recipient: ADDR_PLACEHOLDER }),
  dynamic: B.generate('dynamic', { floorPercent: 0.05, ceilingPercent: 1, fullMovePercent: 2, windowMinutes: 5 }),
  launch: B.generate('launch', { token: ADDR_PLACEHOLDER, windowMinutes: 60, maxBuy: 0.5, cooldownSeconds: 30, pairDecimals: 18 }),
  hours: B.generate('hours', { open: '13:30', close: '20:00', weekdaysOnly: true }),
  overnight: B.generate('hours', { open: '22:00', close: '04:30', weekdaysOnly: false })
};

function compileAll() {
  const sources = {};
  for (const file of Object.values(LIB)) sources[file] = { content: fs.readFileSync(pkg(file), 'utf8') };
  sources['Create2Deployer.sol'] = { content: fs.readFileSync(path.join(__dirname, 'Create2Deployer.sol'), 'utf8') };
  for (const [key, h] of Object.entries(HOOKS)) sources[`hooks/${key}/${h.file}`] = { content: h.source };

  const out = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity',
    sources,
    settings: {
      evmVersion: 'cancun',
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
    }
  }), { import: readImport }));

  const errors = (out.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) {
    errors.forEach((e) => console.error(e.formattedMessage));
    throw new Error('compile failed');
  }
  const get = (file, name) => {
    const c = out.contracts[file][name];
    return { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
  };
  const art = {};
  for (const [name, file] of Object.entries(LIB)) art[name] = get(file, name);
  art.Create2Deployer = get('Create2Deployer.sol', 'Create2Deployer');
  for (const [key, h] of Object.entries(HOOKS)) art[key] = get(`hooks/${key}/${h.file}`, h.contract);
  return art;
}

/* ---------- tiny test runner ---------- */

const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

// Hook reverts reach us wrapped by the PoolManager (ERC-7751), so look for the
// hook's own error selector anywhere in the revert data.
async function reverts(promise, iface, errorName) {
  const selector = iface.getError(errorName).selector.slice(2);
  try {
    const tx = await promise;
    await tx.wait();
    return { reverted: false };
  } catch (e) {
    const data = String(e.data || e.info?.error?.data || e.error?.data || '');
    return { reverted: true, matched: data.includes(selector), data };
  }
}

/* ---------- chain helpers ---------- */

const MIN_PRICE_LIMIT = 4295128739n + 1n;
const MAX_PRICE_LIMIT = 1461446703485210103287273052203988822378723970342n - 1n;
const SQRT_PRICE_1_1 = 79228162514264337593543950336n;
const DYNAMIC_FEE_FLAG = 0x800000;
const E18 = 10n ** 18n;

async function main() {
  const art = compileAll();
  const [owner, alice, bob] = await Promise.all([0, 1, 2].map((i) => provider.getSigner(i)));

  const deploy = async (a, ...args) => {
    const c = await new ethers.ContractFactory(a.abi, a.bytecode, owner).deploy(...args);
    await c.waitForDeployment();
    return c;
  };

  const manager = await deploy(art.PoolManager, owner.address);
  const swapRouter = await deploy(art.PoolSwapTest, await manager.getAddress());
  const lpRouter = await deploy(art.PoolModifyLiquidityTest, await manager.getAddress());
  const deployer = await deploy(art.Create2Deployer);

  let tA = await deploy(art.TestERC20, 2n ** 200n);
  let tB = await deploy(art.TestERC20, 2n ** 200n);
  if (BigInt(await tA.getAddress()) > BigInt(await tB.getAddress())) [tA, tB] = [tB, tA];
  const token0 = tA;
  const token1 = tB;
  const c0 = await token0.getAddress();
  const c1 = await token1.getAddress();

  for (const signer of [owner, alice, bob]) {
    if (signer !== owner) {
      await (await token0.transfer(signer.address, 10n ** 30n)).wait();
      await (await token1.transfer(signer.address, 10n ** 30n)).wait();
    }
    for (const t of [token0, token1]) {
      for (const r of [swapRouter, lpRouter]) await (await t.connect(signer).approve(await r.getAddress(), ethers.MaxUint256)).wait();
    }
  }

  // Deploys a hook on an address whose low 14 bits equal its permission flags.
  const deployHook = async (a, flags, ...args) => {
    const factory = new ethers.ContractFactory(a.abi, a.bytecode, owner);
    const init = (await factory.getDeployTransaction(await manager.getAddress(), ...args)).data;
    const initHash = ethers.keccak256(init);
    const from = await deployer.getAddress();
    for (let i = 0; i < 2_000_000; i++) {
      const salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
      const addr = ethers.getCreate2Address(from, salt, initHash);
      if ((BigInt(addr) & 0x3fffn) === BigInt(flags)) {
        await (await deployer.deploy(init, salt)).wait();
        return new ethers.Contract(addr, a.abi, owner);
      }
    }
    throw new Error('no salt found');
  };

  const keyFor = (hook, fee = 3000, tickSpacing = 60) => ({ currency0: c0, currency1: c1, fee, tickSpacing, hooks: hook });

  const addLiquidity = (key, liquidity, lower = -6000, upper = 6000) =>
    lpRouter['modifyLiquidity((address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)'](
      key, { tickLower: lower, tickUpper: upper, liquidityDelta: liquidity, salt: ethers.ZeroHash }, '0x'
    ).then((tx) => tx.wait());

  const swap = (key, zeroForOne, amountSpecified, signer = owner) =>
    swapRouter.connect(signer).swap(
      key,
      { zeroForOne, amountSpecified, sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT },
      { takeClaims: false, settleUsingBurn: false },
      '0x',
      // A fixed gas limit skips gas estimation: Hardhat estimates at a block
      // time that ignores evm_increaseTime, which would test the wrong moment.
      { gasLimit: 3_000_000 }
    );

  const swapFeeOf = async (txPromise) => {
    const receipt = await (await txPromise).wait();
    for (const log of receipt.logs) {
      try {
        const ev = manager.interface.parseLog(log);
        if (ev?.name === 'Swap') return Number(ev.args.fee);
      } catch (_) { /* not a manager log */ }
    }
    return null;
  };

  // Read block times straight from Hardhat: ethers caches 'latest'.
  const now = async () => Number((await hre.network.provider.request({ method: 'eth_getBlockByNumber', params: ['latest', false] })).timestamp);
  const setNext = (ts) => provider.send('evm_setNextBlockTimestamp', [ts]);
  const advance = async (s) => { await provider.send('evm_increaseTime', [s]); await provider.send('evm_mine', []); };

  /* ===== Fee on every swap ===== */
  console.log('\nFee on every swap (1%)');
  {
    const recipient = ethers.Wallet.createRandom().address;
    const hook = await deployHook(art.fee, HOOKS.fee.flags, recipient);
    check('fee: hook deploys at a flagged address', (BigInt(await hook.getAddress()) & 0x3fffn) === BigInt(HOOKS.fee.flags));
    check('fee: recipient stored', (await hook.recipient()) === recipient);
    const key = keyFor(await hook.getAddress());
    await (await manager.initialize(key, SQRT_PRICE_1_1)).wait();
    await addLiquidity(key, 10n ** 22n);

    // exact input, token0 -> token1: fee is taken from the token1 output
    const before1 = await token1.balanceOf(alice.address);
    await (await swap(key, true, -1n * E18, alice)).wait();
    const got = (await token1.balanceOf(alice.address)) - before1;
    const fee1 = await token1.balanceOf(recipient);
    const gross = got + fee1;
    check('fee: exact-input swap pays the recipient in the output token', fee1 > 0n, `${ethers.formatEther(fee1)} token1`);
    check('fee: exact-input fee is 1% of the output', fee1 === gross * 100n / 10000n, `fee ${fee1}, gross ${gross}`);

    // exact output, token0 -> token1: fee is taken from the token0 input
    const before0 = await token0.balanceOf(alice.address);
    await (await swap(key, true, E18 / 2n, alice)).wait();
    const spent = before0 - (await token0.balanceOf(alice.address));
    const fee0 = await token0.balanceOf(recipient);
    check('fee: exact-output swap pays the recipient in the input token', fee0 > 0n, `${ethers.formatEther(fee0)} token0`);
    check('fee: exact-output fee is 1% of the input', fee0 === (spent - fee0) * 100n / 10000n, `fee ${fee0}, spent ${spent}`);

    // the other direction
    const before = await token0.balanceOf(recipient);
    await (await swap(key, false, -1n * E18, bob)).wait();
    check('fee: works in the other direction too', (await token0.balanceOf(recipient)) > before);

    let refused = false;
    try { await deployHook(art.fee, HOOKS.fee.flags, ethers.ZeroAddress); } catch (_) { refused = true; }
    check('fee: refuses the zero address as recipient', refused);
  }

  /* ===== Dynamic fees ===== */
  console.log('\nDynamic fees (0.05% to 1%, full at a 2% move, 5 min window)');
  {
    const hook = await deployHook(art.dynamic, HOOKS.dynamic.flags);
    const iface = hook.interface;
    const fixedKey = keyFor(await hook.getAddress(), 3000);
    const r = await reverts(manager.initialize(fixedKey, SQRT_PRICE_1_1), iface, 'MustUseDynamicFee');
    check('dynamic: refuses a pool with a fixed fee', r.reverted && r.matched);

    const key = keyFor(await hook.getAddress(), DYNAMIC_FEE_FLAG);
    await (await manager.initialize(key, SQRT_PRICE_1_1)).wait();
    await addLiquidity(key, 10n ** 20n, -60000, 60000);

    const calm = await swapFeeOf(swap(key, true, -(10n ** 15n)));
    check('dynamic: calm market pays the lowest fee', calm === 500, `fee ${calm} (500 = 0.05%)`);
    await swapFeeOf(swap(key, true, -3n * E18));
    const after = await swapFeeOf(swap(key, true, -(10n ** 15n)));
    check('dynamic: after a big move the fee is at the top', after === 10000, `fee ${after} (10000 = 1%)`);
    check('dynamic: fee curve is linear in between', Number(await hook.feeForMove(Math.floor(B.ticksFor(2) / 2))) > 500 && Number(await hook.feeForMove(Math.floor(B.ticksFor(2) / 2))) < 10000);

    await advance(6 * 60);
    await swapFeeOf(swap(key, false, -(10n ** 15n)));
    const later = await swapFeeOf(swap(key, false, -(10n ** 15n)));
    check('dynamic: once things calm down the fee drops again', later === 500, `fee ${later}`);
  }

  /* ===== Launch protection ===== */
  console.log('\nLaunch protection (60 min, max 0.5 per buy, 30 s between buys)');
  {
    // token1 is the token being launched, so buying it is zeroForOne.
    const hook = await deployHook(art.launch, HOOKS.launch.flags, c1);
    const iface = hook.interface;

    const other = await deploy(art.TestERC20, 10n ** 30n);
    const oa = await other.getAddress();
    const wrongKey = BigInt(oa) < BigInt(c0)
      ? { currency0: oa, currency1: c0, fee: 3000, tickSpacing: 60, hooks: await hook.getAddress() }
      : { currency0: c0, currency1: oa, fee: 3000, tickSpacing: 60, hooks: await hook.getAddress() };
    const wrong = await reverts(manager.initialize(wrongKey, SQRT_PRICE_1_1), iface, 'TokenNotInPool');
    check('launch: refuses a pool without the launched token', wrong.reverted && wrong.matched);

    const key = keyFor(await hook.getAddress());
    await (await manager.initialize(key, SQRT_PRICE_1_1)).wait();
    await addLiquidity(key, 10n ** 22n);

    let r = await reverts(swap(key, true, -(6n * E18) / 10n, alice), iface, 'BuyTooLarge');
    check('launch: a 0.6 buy is refused', r.reverted && r.matched);
    r = await reverts(swap(key, true, -(4n * E18) / 10n, alice), iface, 'BuyTooLarge');
    check('launch: a 0.4 buy goes through', !r.reverted);
    r = await reverts(swap(key, true, -(E18 / 10n), alice), iface, 'CooldownActive');
    check('launch: the same wallet buying again at once is refused', r.reverted && r.matched);
    r = await reverts(swap(key, true, -(E18 / 10n), bob), iface, 'CooldownActive');
    check('launch: another wallet can buy', !r.reverted);
    r = await reverts(swap(key, true, E18 / 10n, owner), iface, 'ExactOutputBuyDuringLaunch');
    check('launch: exact-output buys are refused during launch', r.reverted && r.matched);
    r = await reverts(swap(key, false, -5n * E18, owner), iface, 'BuyTooLarge');
    check('launch: selling is never limited', !r.reverted);
    await advance(31);
    r = await reverts(swap(key, true, -(E18 / 10n), alice), iface, 'CooldownActive');
    check('launch: after 30 s the same wallet can buy again', !r.reverted, r.reverted ? `reverted with ${['BuyTooLarge', 'CooldownActive', 'ExactOutputBuyDuringLaunch'].filter((n) => r.data.includes(iface.getError(n).selector.slice(2))).join(',') || r.data}` : '');
    await advance(61 * 60);
    r = await reverts(swap(key, true, -5n * E18, alice), iface, 'BuyTooLarge');
    check('launch: after the window, big buys go through', !r.reverted);
  }

  /* ===== Trading hours ===== */
  console.log('\nTrading hours (13:30-20:00 UTC weekdays, and 22:00-04:30 every day)');
  {
    const hook = await deployHook(art.hours, HOOKS.hours.flags);
    const iface = hook.interface;
    const key = keyFor(await hook.getAddress());
    await (await manager.initialize(key, SQRT_PRICE_1_1)).wait();
    await addLiquidity(key, 10n ** 22n);

    const night = await deployHook(art.overnight, HOOKS.overnight.flags);
    const nightKey = keyFor(await night.getAddress());
    await (await manager.initialize(nightKey, SQRT_PRICE_1_1)).wait();
    await addLiquidity(nightKey, 10n ** 22n);

    // Next Monday 00:00 UTC, at least a day ahead.
    const DAY = 86400;
    let t = Math.floor((await now()) / DAY) * DAY + 2 * DAY;
    while (Math.floor(t / DAY + 4) % 7 !== 1) t += DAY;
    const monday = t;
    const at = (dayOffset, hh, mm = 0) => monday + dayOffset * DAY + hh * 3600 + mm * 60;

    const attempt = async (k, i, ts) => {
      await setNext(ts);
      const r = await reverts(swap(k, true, -(E18 / 100n)), i, 'MarketClosed');
      // Hardhat does not mine a swap that reverts, so only a successful one
      // can be checked for the time it landed at.
      if (!r.reverted) {
        const landed = await now();
        if (landed !== ts) throw new Error(`swap landed at ${landed}, wanted ${ts}`);
      }
      return r;
    };

    let r = await attempt(key, iface, at(0, 13, 29));
    check('hours: Monday 13:29 is closed', r.reverted && r.matched);
    r = await attempt(key, iface, at(0, 13, 30));
    check('hours: Monday 13:30 is open', !r.reverted);
    r = await attempt(key, iface, at(2, 15));
    check('hours: Wednesday 15:00 is open', !r.reverted);
    r = await attempt(key, iface, at(2, 20));
    check('hours: Wednesday 20:00 is closed', r.reverted && r.matched);
    r = await attempt(nightKey, night.interface, at(2, 23));
    check('overnight: Wednesday 23:00 is open', !r.reverted);
    r = await attempt(nightKey, night.interface, at(3, 3));
    check('overnight: Thursday 03:00 is open', !r.reverted);
    r = await attempt(nightKey, night.interface, at(3, 12));
    check('overnight: Thursday 12:00 is closed', r.reverted && r.matched);
    r = await attempt(key, iface, at(5, 15));
    check('hours: Saturday 15:00 is closed', r.reverted && r.matched);
    r = await attempt(nightKey, night.interface, at(5, 23));
    check('overnight: Saturday 23:00 is open (every day)', !r.reverted);
    await setNext(at(6, 12));
    await (await lpRouter['modifyLiquidity((address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)'](
      key, { tickLower: -6000, tickUpper: 6000, liquidityDelta: 10n ** 18n, salt: ethers.ZeroHash }, '0x')).wait();
    check('hours: liquidity can be added while closed', true);
  }

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
