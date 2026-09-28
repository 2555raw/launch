// End-to-end test on Hardhat's in-process EVM against the real Uniswap v4 PoolManager.
// Run from nebari-site/contracts:  node scripts/compile.js test/Harness.sol && node test/run.js
const path = require('path');
const fs = require('fs');
const hre = require('hardhat');
const { ethers } = require('ethers');

const build = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', n + '.json'), 'utf8'));
const ZERO = '0x0000000000000000000000000000000000000000';
let passed = 0;
function ok(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); passed++; console.log('  ok', msg); }

async function deploy(signer, name, ...args) {
  const b = build(name);
  const f = new ethers.ContractFactory(b.abi, b.bytecode, signer);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  return c;
}

const Q96 = 2n ** 96n;
function slot0(pm, poolId) {
  const slot = ethers.keccak256(ethers.concat([poolId, ethers.zeroPadValue('0x06', 32)]));
  return pm['extsload(bytes32)'](slot).then((w) => {
    const v = BigInt(w);
    return { sqrtPriceX96: v & ((1n << 160n) - 1n), tick: Number(BigInt.asIntN(24, (v >> 160n) & 0xffffffn)) };
  });
}

async function main() {
  const provider = new ethers.BrowserProvider(hre.network.provider, undefined, { cacheTimeout: -1 });
  const [deployer, creator, buyer, treasury] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)));

  console.log('deploying PoolManager, USDG, factory, router');
  const pm = await deploy(deployer, 'PoolManager', deployer.address);
  const usdg = await deploy(deployer, 'TestERC20', 0n);
  const factory = await deploy(deployer, 'NebariFactory', await pm.getAddress(), treasury.address, 1000n);
  const router = await deploy(deployer, 'NebariRouter', await pm.getAddress());
  const tokenAbi = build('NebariToken').abi;

  const seen = { zero: false, one: false };
  let round = 0;
  while ((!seen.zero || !seen.one) && round < 12) {
    round++;
    const pairAddr = round % 2 === 1 ? await usdg.getAddress() : ZERO; // alternate ERC20 and native ETH pairs
    const isEth = pairAddr === ZERO;
    const startPrice = isEth ? 1_000_000_000n : 1_000_000_000_000n; // 1e-9 ETH or 1e-6 USDG per token
    const tx = await factory.connect(creator).launch('Sakura ' + round, 'SKR' + round, 'data:,{"image":""}', pairAddr, startPrice);
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'Launched');
    const tokenAddr = ev.args.token;
    const token = new ethers.Contract(tokenAddr, tokenAbi, provider);
    const L = await factory.getLaunch(tokenAddr);
    const tokenIsZero = L.key.currency0.toLowerCase() === tokenAddr.toLowerCase();
    seen[tokenIsZero ? 'zero' : 'one'] = true;
    console.log(`\nround ${round}: pair=${isEth ? 'ETH' : 'USDG'} token is currency${tokenIsZero ? 0 : 1}`);

    ok((await factory.tokenCount()) === BigInt(round), 'tokenCount grows');
    ok((await token.balanceOf(await pm.getAddress())) > 999_999_999n * 10n ** 18n, 'nearly the whole supply is in the pool');
    { const dust = await token.balanceOf(await factory.getAddress()); console.log('  factory dust:', dust.toString()); ok(dust <= 10n ** 15n, 'only dust stays in the factory (under 1e-12 of supply)'); }
    ok((await token.creator()) === creator.address, 'creator recorded');

    const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [L.key.currency0, L.key.currency1, L.key.fee, L.key.tickSpacing, L.key.hooks]));
    const s0 = await slot0(pm, poolId);
    ok(s0.sqrtPriceX96 === L.startSqrtPriceX96, 'pool initialised at the start price');
    const key = [L.key.currency0, L.key.currency1, L.key.fee, L.key.tickSpacing, L.key.hooks];

    // ---- buy
    const buyZeroForOne = !tokenIsZero; // pay with the pair, receive the token
    const amountIn = isEth ? ethers.parseEther('0.01') : ethers.parseEther('1');
    if (!isEth) {
      await (await usdg.connect(buyer).mint(buyer.address, amountIn * 10n)).wait();
      await (await usdg.connect(buyer).approve(await router.getAddress(), ethers.MaxUint256)).wait();
    }
    const quoted = await router.connect(buyer).quoteExactIn.staticCall(key, buyZeroForOne, amountIn);
    ok(quoted > 0n, 'quote gives an amount: ' + ethers.formatEther(quoted) + ' tokens');
    const bal0 = await token.balanceOf(buyer.address);
    await (await router.connect(buyer).swapExactIn(key, buyZeroForOne, amountIn, quoted, buyer.address, { value: isEth ? amountIn : 0n })).wait();
    const got = (await token.balanceOf(buyer.address)) - bal0;
    ok(got === quoted, 'swap delivers exactly the quoted amount');
    // 1 pair unit at the start price buys about 1/startPrice tokens, less the 1% fee and slippage
    const idealTokens = (amountIn * 10n ** 18n) / startPrice;
    ok(got < idealTokens && got > (idealTokens * 90n) / 100n, 'fill is within 10% of the start price');
    const s1 = await slot0(pm, poolId);
    ok(tokenIsZero ? s1.sqrtPriceX96 > s0.sqrtPriceX96 : s1.sqrtPriceX96 < s0.sqrtPriceX96, 'price moved up after the buy');

    // ---- sell half back
    await (await token.connect(buyer).approve(await router.getAddress(), ethers.MaxUint256)).wait();
    const sellAmt = got / 2n;
    const pairBefore = isEth ? await provider.getBalance(buyer.address) : await usdg.balanceOf(buyer.address);
    await (await router.connect(buyer).swapExactIn(key, tokenIsZero, sellAmt, 0n, buyer.address)).wait();
    const pairAfter = isEth ? await provider.getBalance(buyer.address) : await usdg.balanceOf(buyer.address);
    ok(pairAfter > pairBefore - (isEth ? ethers.parseEther('0.001') : 0n), 'selling returns the pair asset');
    const s2 = await slot0(pm, poolId);
    ok(tokenIsZero ? s2.sqrtPriceX96 >= s0.sqrtPriceX96 : s2.sqrtPriceX96 <= s0.sqrtPriceX96, 'price never goes below the floor');

    // ---- fees
    const tBefore = isEth ? await provider.getBalance(treasury.address) : await usdg.balanceOf(treasury.address);
    const cBefore = isEth ? await provider.getBalance(creator.address) : await usdg.balanceOf(creator.address);
    const rc2 = await (await factory.connect(deployer).collectFees(tokenAddr)).wait();
    const fe = rc2.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'FeesCollected');
    ok(fe.args.pairAmount > 0n, 'fees collected in the pair asset: ' + ethers.formatEther(fe.args.pairAmount));
    ok(fe.args.toHolders === fe.args.pairAmount / 2n, 'half of the fees go to holders');
    ok(fe.args.toProtocol === fe.args.pairAmount / 10n, 'a tenth goes to the treasury');
    ok(fe.args.toHolders + fe.args.toCreator + fe.args.toProtocol === fe.args.pairAmount, 'the split adds up');
    ok(fe.args.burned > 0n && (await token.totalSupply()) === 10n ** 27n - fe.args.burned, 'token-side fees are burned out of the supply');
    const tAfter = isEth ? await provider.getBalance(treasury.address) : await usdg.balanceOf(treasury.address);
    const cAfter = isEth ? await provider.getBalance(creator.address) : await usdg.balanceOf(creator.address);
    ok(tAfter - tBefore === fe.args.toProtocol, 'treasury received its share');
    ok(cAfter - cBefore === fe.args.toCreator, 'creator received their share');

    const claimable = await token.claimable(buyer.address);
    console.log('  holders share', fe.args.toHolders.toString(), 'claimable', claimable.toString());
    ok(claimable > 0n && claimable <= fe.args.toHolders && fe.args.toHolders - claimable < 10n, 'the only holder can claim the whole holder share');
    ok((await token.claimable(await pm.getAddress())) === 0n, 'the pool itself never earns');
    const pb = isEth ? await provider.getBalance(buyer.address) : await usdg.balanceOf(buyer.address);
    const ctx = await (await token.connect(buyer).claim()).wait();
    const pa = isEth ? await provider.getBalance(buyer.address) : await usdg.balanceOf(buyer.address);
    const gas = isEth ? ctx.gasUsed * ctx.gasPrice : 0n;
    ok(pa - pb + gas === claimable, 'claim pays out');
    ok((await token.claimable(buyer.address)) === 0n, 'nothing left after claiming');

    // a second collect right away pays nothing new
    const rc3 = await (await factory.collectFees(tokenAddr)).wait();
    const fe3 = rc3.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'FeesCollected');
    ok(fe3.args.pairAmount === 0n, 'collecting twice pays nothing extra');

    // a transfer moves future rewards, not past ones
    await (await token.connect(buyer).transfer(deployer.address, got / 4n)).wait();
    ok((await token.claimable(deployer.address)) === 0n, 'a new holder starts with nothing claimable');

    // launches with a bad price revert
    await factory.connect(creator).launch('x', 'x', '', pairAddr, 0n).then(() => { throw new Error('should revert'); }, () => passed++);
    console.log('  ok zero start price reverts');
  }
  ok(seen.zero && seen.one, 'both currency orderings were exercised');

  // ---- registry
  const all = await factory.getLaunches(0, 50);
  ok(all.length === Number(await factory.tokenCount()), 'getLaunches lists everything');
  const abi = build('NebariFactory').abi;
  ok(!abi.some((f) => /remove|withdraw|burnLiquidity|decreaseLiquidity/i.test(f.name || '')), 'the factory has no function to remove liquidity');

  console.log(`\n${passed} checks passed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
