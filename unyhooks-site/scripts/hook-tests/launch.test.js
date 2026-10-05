/* The one-transaction launch and the liquidity lock, on a local chain that
   carries Robinhood Chain's own Uniswap code (PoolManager, PositionManager,
   StateView, Permit2 and the CREATE2 deployer copied from mainnet to the same
   addresses), with the sources the browser compiles (launch-kit.js, builder.js).

   Checks: the launch lands everything in one transaction (token, hook at its
   mined address, pool, full-range position, lock) and leaves nothing behind;
   the protection works on the new pool; the lock refuses early withdrawals,
   sends fees to the owner, only moves its date later, and gives the position
   back after the date; a lock made on its own (My hooks) announces a position
   sent to it; the code hashes the public page relies on match.

     npm run node            # terminal 1
     node launch.test.js     # terminal 2 (needs network for the mainnet code) */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const solc = require('solc');
const K = require('../../launch-kit.js');
const B = require('../../builder.js');
const M = require('../../pool-math.js');

const RPC = 'http://localhost:8545';
const MAINNET = 'https://rpc.mainnet.chain.robinhood.com';
const cfgSrc = fs.readFileSync(path.join(__dirname, '../../config.js'), 'utf8');
const pick = (k) => ethers.getAddress(cfgSrc.match(new RegExp(`${k}:\\s*'(0x[0-9a-fA-F]{40})'`))[1]);
const NET = { poolManager: pick('poolManager'), stateView: pick('stateView'), positionManager: pick('positionManager'), permit2: pick('permit2'), create2Deployer: pick('create2Deployer') };
const DEPS = require('../../vendor/v4-sources.json').sources;

const results = [];
const check = (n, c, x = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  (${x})` : ''}`); };
const reverts = async (p, name) => {
  try { await p; return false; } catch (e) { const m = `${e.shortMessage || ''} ${e.message || ''} ${e.data || ''} ${(e.revert && e.revert.name) || ''}`; return name ? m.includes(name) : true; }
};

// The browser's compiler input: the given files plus every vendored Uniswap source.
const compileKit = (files) => {
  const sources = {};
  for (const [f, c] of Object.entries(files)) sources[f] = { content: c };
  for (const [f, c] of Object.entries(DEPS)) sources[f] = { content: c };
  const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] } } } })));
  const errs = (out.errors || []).filter((e) => e.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.formattedMessage).join('\n'));
  return out.contracts;
};
const art = (out, file, name) => ({ abi: out[file][name].abi, bytecode: '0x' + out[file][name].evm.bytecode.object, runtime: '0x' + out[file][name].evm.deployedBytecode.object });

const resolve = (p) => fs.readFileSync(require.resolve(p.replace(/^solmate\//, '@uniswap/v4-core/lib/solmate/').replace(/^forge-std\//, '@uniswap/v4-core/lib/forge-std/src/')), 'utf8');
const compileFiles = (files) => {
  const sources = {};
  for (const f of Object.values(files)) sources[f] = { content: resolve(f) };
  const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } }), { import: (p) => { try { return { contents: resolve(p) }; } catch (_) { return { error: 'nf ' + p }; } } }));
  const a = {}; for (const [n, f] of Object.entries(files)) a[n] = { abi: out.contracts[f][n].abi, bytecode: '0x' + out.contracts[f][n].evm.bytecode.object };
  return a;
};

(async () => {
  // No response cache: balances are read right after transactions.
  const local = new ethers.JsonRpcProvider(RPC, 4663, { staticNetwork: true, cacheTimeout: -1 });
  const main = new ethers.JsonRpcProvider(MAINNET, 4663, { staticNetwork: true });
  for (const [name, a] of Object.entries(NET)) {
    const code = await main.getCode(a);
    if (code.length < 10) throw new Error(`no ${name} code on mainnet`);
    await local.send('hardhat_setCode', [a, code]);
  }
  const creator = await local.getSigner(1);
  const creatorAddr = await creator.getAddress();
  const trader = await local.getSigner(2);
  const traderAddr = await trader.getAddress();
  const later = async (seconds) => { await local.send('evm_increaseTime', [seconds]); await local.send('evm_mine', []); };
  const now = async () => (await local.getBlock('latest')).timestamp;

  /* ---------- compile what the browser compiles ---------- */

  const settings = { token: '0x1111111111111111111111111111111111111111', windowMinutes: 60, maxBuy: 0.5, cooldownSeconds: 30, pairDecimals: 18 };
  const hookGen = B.generate('launch', settings);
  const out = compileKit(K.files(NET, hookGen.source));
  const L = art(out, 'UnyLaunch.sol', 'UnyLaunch');
  const T = art(out, 'UnyToken.sol', 'UnyToken');
  const LK = art(out, 'LiquidityLock.sol', 'LiquidityLock');
  const H = art(out, 'LaunchGuardHook.sol', 'LaunchGuardHook');
  check('launcher creation code under the 48 KB initcode limit', (L.bytecode.length - 2) / 2 < 49152, `${(L.bytecode.length - 2) / 2} bytes`);

  // The same token and lock compiled on their own (My hooks compiles the lock alone).
  const alone = compileKit({ 'UnyToken.sol': K.token(), 'LiquidityLock.sol': K.lock(NET.positionManager) });
  const tokenHash = ethers.keccak256(T.runtime);
  const lockHash = ethers.keccak256(LK.runtime);
  check('token code hash is the same compiled alone or with a launch', tokenHash === ethers.keccak256(art(alone, 'UnyToken.sol', 'UnyToken').runtime));
  check('lock code hash is the same compiled alone or with a launch', lockHash === ethers.keccak256(art(alone, 'LiquidityLock.sol', 'LiquidityLock').runtime));
  check('launch-kit.js CODEHASH.token matches the token', K.CODEHASH.token === tokenHash, tokenHash);
  check('launch-kit.js CODEHASH.lock matches the lock', K.CODEHASH.lock === lockHash, lockHash);

  /* ---------- launch ---------- */

  const supply = ethers.parseEther('1000000000');
  const poolTokens = ethers.parseEther('900000000');
  const eth = ethers.parseEther('2');
  const unlockAt = BigInt((await now()) + 30 * 86400);
  const nonce = await local.getTransactionCount(creatorAddr, 'pending');
  const plan = await K.prepare({
    ethers, math: M, net: NET, creator: creatorAddr, nonce,
    launcherBytecode: L.bytecode, hookBytecode: H.bytecode, flags: hookGen.flags,
    name: 'Pink Moon', symbol: 'PINK', supply, poolTokens, eth, fee: 10000, tickSpacing: 200, unlockAt
  });
  check('hook address carries the launch permission bits', (BigInt(plan.hook) & 0x3fffn) === BigInt(hookGen.flags), plan.hook);

  // Dry run, as the page does before asking for the signature.
  const dry = await local.call({ from: creatorAddr, data: plan.data, value: plan.value });
  check('dry run of the launch succeeds', dry.length > 2);

  const ethBefore = await local.getBalance(creatorAddr);
  const tx = await creator.sendTransaction({ data: plan.data, value: plan.value });
  const rc = await tx.wait();
  check('launch is one transaction', rc.status === 1, `${rc.gasUsed} gas`);
  check('launcher landed where it was predicted', rc.contractAddress === plan.launcher);
  const ev = new ethers.Interface([K.LAUNCHED]).parseLog(rc.logs.find((l) => l.address === plan.launcher));
  check('Launched event names token, hook, pool, position and lock', ev && ev.args.token === plan.token && ev.args.hook === plan.hook && ev.args.creator === creatorAddr && ev.args.lock !== ethers.ZeroAddress);

  const token = new ethers.Contract(plan.token, T.abi, local);
  const key = { currency0: ethers.ZeroAddress, currency1: plan.token, fee: 10000, tickSpacing: 200, hooks: plan.hook };
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address', 'uint24', 'int24', 'address'], [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]));
  check('pool ID in the event matches the pool key', ev.args.poolId === poolId);
  check('token has its name, symbol and supply', (await token.name()) === 'Pink Moon' && (await token.symbol()) === 'PINK' && (await token.totalSupply()) === supply);
  check('token code hash is the known UnyToken hash', ethers.keccak256(await local.getCode(plan.token)) === tokenHash);

  const sv = new ethers.Contract(NET.stateView, ['function getSlot0(bytes32) view returns (uint160, int24, uint24, uint24)', 'function getLiquidity(bytes32) view returns (uint128)'], local);
  const [sqrtNow] = await sv.getSlot0(poolId);
  check('pool started at the planned price', sqrtNow === plan.sqrtPriceX96);
  check('pool holds the planned liquidity', (await sv.getLiquidity(poolId)) === plan.liquidity);
  const price = M.priceOf(sqrtNow, { address: ethers.ZeroAddress, decimals: 18 }, { address: plan.token, decimals: 18 });
  check('1 ETH buys about 450 million PINK at the start', Math.abs(price / 450e6 - 1) < 1e-6, price.toExponential(4));

  const creatorTokens = await token.balanceOf(creatorAddr);
  const inPool = supply - creatorTokens;
  check('the rest of the supply went to the creator', creatorTokens >= supply - poolTokens && inPool <= poolTokens && inPool > (poolTokens * 9999n) / 10000n, `${ethers.formatEther(creatorTokens)} PINK`);
  const spent = ethBefore - (await local.getBalance(creatorAddr));
  check('ETH spent is the pool deposit (unused ETH came back)', spent <= eth + ethers.parseEther('0.01') && spent > (eth * 9999n) / 10000n, `${ethers.formatEther(spent)} ETH incl. gas`);
  check('nothing left in the launcher', (await local.getBalance(plan.launcher)) === 0n && (await token.balanceOf(plan.launcher)) === 0n);

  const posm = new ethers.Contract(NET.positionManager, ['function ownerOf(uint256) view returns (address)', 'function getPositionLiquidity(uint256) view returns (uint128)', 'function safeTransferFrom(address,address,uint256)', 'function nextTokenId() view returns (uint256)', 'function modifyLiquidities(bytes,uint256) payable'], local);
  const tokenId = ev.args.tokenId;
  const lockAddr = ev.args.lock;
  const lock = new ethers.Contract(lockAddr, LK.abi, creator);
  check('position belongs to the lock', (await posm.ownerOf(tokenId)) === lockAddr, `#${tokenId}`);
  check('lock code hash is the known LiquidityLock hash', ethers.keccak256(await local.getCode(lockAddr)) === lockHash);
  check('lock is owned by the creator, until the chosen date', (await lock.owner()) === creatorAddr && (await lock.unlockAt()) === unlockAt);
  const lockedLog = rc.logs.find((l) => l.address === lockAddr);
  const locked = lockedLog && lock.interface.parseLog(lockedLog);
  check('lock announced the position (Locked event, by pool)', locked && locked.args.tokenId === tokenId && locked.args.poolId === poolId && locked.args.unlockAt === unlockAt);

  /* ---------- protection on the new pool ---------- */

  const sw = compileFiles({ PoolSwapTest: '@uniswap/v4-core/src/test/PoolSwapTest.sol' }).PoolSwapTest;
  const swapper = await new ethers.ContractFactory(sw.abi, sw.bytecode, trader).deploy(NET.poolManager);
  await swapper.waitForDeployment();
  const buy = (wei, from = trader) => swapper.connect(from).swap(key, { zeroForOne: true, amountSpecified: -wei, sqrtPriceLimitX96: M.MIN_SQRT_PRICE + 1n }, { takeClaims: false, settleUsingBurn: false }, '0x', { value: wei });
  check('a buy above the launch cap is refused', await reverts(buy(ethers.parseEther('1')), ''));
  await (await buy(ethers.parseEther('0.4'))).wait();
  check('a buy under the cap goes through', (await token.balanceOf(traderAddr)) > 0n, `${ethers.formatEther(await token.balanceOf(traderAddr))} PINK`);
  check('a second buy inside the cooldown is refused', await reverts(buy(ethers.parseEther('0.1')), ''));
  await later(61 * 60);
  await (await buy(ethers.parseEther('1.5'))).wait();
  check('after the launch window, big buys go through', true);

  /* ---------- the lock ---------- */

  check('withdraw before the date is refused', await reverts(lock.withdraw(tokenId), ''));
  check('someone else cannot withdraw or extend', await reverts(lock.connect(trader).extend(unlockAt + 1n), '') && await reverts(lock.connect(trader).withdraw(tokenId), ''));
  check('the date cannot move sooner', await reverts(lock.extend(unlockAt - 1n), ''));
  const ethBeforeFees = await local.getBalance(creatorAddr);
  await (await lock.connect(trader).collectFees(tokenId)).wait();
  const feeEth = (await local.getBalance(creatorAddr)) - ethBeforeFees;
  check('collecting fees (anyone can call it) pays the owner', feeEth > 0n, `${ethers.formatEther(feeEth)} ETH in fees`);
  check('collecting fees leaves the liquidity in place', (await posm.getPositionLiquidity(tokenId)) === plan.liquidity);
  await (await lock.extend(unlockAt + 86400n)).wait();
  check('the date moves later', (await lock.unlockAt()) === unlockAt + 86400n);
  await later(32 * 86400);
  await (await lock.withdraw(tokenId)).wait();
  check('after the date the owner gets the position back', (await posm.ownerOf(tokenId)) === creatorAddr);

  /* ---------- launch without a lock ---------- */

  const nonce2 = await local.getTransactionCount(creatorAddr, 'pending');
  const plan2 = await K.prepare({
    ethers, math: M, net: NET, creator: creatorAddr, nonce: nonce2,
    launcherBytecode: L.bytecode, hookBytecode: H.bytecode, flags: hookGen.flags,
    name: 'Second', symbol: 'TWO', supply: ethers.parseEther('1000000'), poolTokens: ethers.parseEther('1000000'), eth: ethers.parseEther('0.1'), fee: 3000, tickSpacing: 60, unlockAt: 0n
  });
  const rc2 = await (await creator.sendTransaction({ data: plan2.data, value: plan2.value })).wait();
  const ev2 = new ethers.Interface([K.LAUNCHED]).parseLog(rc2.logs.find((l) => l.address === plan2.launcher));
  check('without a lock the position goes to the creator', ev2.args.lock === ethers.ZeroAddress && (await posm.ownerOf(ev2.args.tokenId)) === creatorAddr);

  /* ---------- a lock made on its own, for an existing position ---------- */

  const lockInit = ethers.concat([art(alone, 'LiquidityLock.sol', 'LiquidityLock').bytecode, ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [creatorAddr, K.MAX_UINT256])]);
  const salt = ethers.id('lock-test');
  const lock2Addr = ethers.getCreate2Address(NET.create2Deployer, salt, ethers.keccak256(lockInit));
  await (await creator.sendTransaction({ to: NET.create2Deployer, data: ethers.concat([salt, lockInit]) })).wait();
  check('a standalone lock deploys through the CREATE2 deployer', ethers.keccak256(await local.getCode(lock2Addr)) === lockHash);
  const rc3 = await (await posm.connect(creator).safeTransferFrom(creatorAddr, lock2Addr, ev2.args.tokenId)).wait();
  const lock2 = new ethers.Contract(lock2Addr, LK.abi, creator);
  const ann = rc3.logs.filter((l) => l.address === lock2Addr).map((l) => lock2.interface.parseLog(l))[0];
  check('sending a position to it announces the lock', ann && ann.name === 'Locked' && ann.args.tokenId === ev2.args.tokenId && ann.args.owner === creatorAddr);
  await later(400 * 86400);
  check('a forever lock never opens', await reverts(lock2.withdraw(ev2.args.tokenId), ''));
  check('other NFTs cannot be pushed into the lock', await reverts(lock2.onERC721Received(creatorAddr, creatorAddr, 1, '0x'), ''));

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
