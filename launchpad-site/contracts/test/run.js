/* Runs the whole launchpad flow on an in-process EVM (@ethereumjs/vm): deploys
   the factory with a mock router, registers a mock stock token for one
   restaurant and BNB for another, creates coins, buys (cap clipping, change
   returned), finalizes (graduation into the router, refund path), claims and
   refunds. No network, no keys. `node contracts/test/run.js` */
'use strict';
const path = require('path'); const fs = require('fs');
const solc = require('solc');
const { ethers } = require('ethers');
const { VM } = require('@ethereumjs/vm');
const { Address, Account, hexToBytes, bytesToHex } = require('@ethereumjs/util');
const { Block } = require('@ethereumjs/block');
const { Common, Chain, Hardfork } = require('@ethereumjs/common');

function compile(files) {
  const sources = {}; for (const f of files) sources[path.basename(f)] = { content: fs.readFileSync(f, 'utf8') };
  const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { viaIR: true, optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
  const errs = (out.errors || []).filter((e) => e.severity === 'error'); if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join('\n')); process.exit(1); }
  const c = {}; for (const f of Object.values(out.contracts)) for (const [n, v] of Object.entries(f)) c[n] = { abi: v.abi, bytecode: '0x' + v.evm.bytecode.object, iface: new ethers.Interface(v.abi) };
  return c;
}
const C = compile([path.join(__dirname, '..', 'ForkLaunch.sol'), path.join(__dirname, 'Mocks.sol')]);
const E18 = 10n ** 18n;
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ok  ' + msg); } else { failed++; console.log('  FAIL ' + msg); } };

(async () => {
  const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun });
  const vm = await VM.create({ common });
  let now = 1_800_000_000n;
  const block = () => Block.fromBlockData({ header: { timestamp: now, gasLimit: 30_000_000n, baseFeePerGas: 0n } }, { common });
  const acct = (hex) => Address.fromString(hex);
  const DEPLOYER = acct('0x' + '11'.repeat(20)), ALICE = acct('0x' + '22'.repeat(20)), BOB = acct('0x' + '33'.repeat(20)), FEE = acct('0x' + '44'.repeat(20));
  for (const a of [DEPLOYER, ALICE, BOB, FEE]) await vm.stateManager.putAccount(a, Account.fromAccountData({ balance: 1000n * E18, nonce: 0n }));
  async function call(from, to, data, value = 0n, expectRevert = false) {
    const res = await vm.evm.runCall({ caller: from, origin: from, to, data: hexToBytes(data), value, gasLimit: 20_000_000n, block: block() });
    const err = res.execResult.exceptionError;
    if (expectRevert) { if (!err) throw new Error('expected revert'); return null; }
    if (err) { let reason = ''; try { reason = C.ForkRaise.iface.parseError(bytesToHex(res.execResult.returnValue))?.args?.[0] || ''; } catch {} try { reason = reason || new ethers.AbiCoder().decode(['string'], '0x' + bytesToHex(res.execResult.returnValue).slice(10))[0]; } catch {} throw new Error(`revert ${err.error} ${reason}`); }
    return res;
  }
  async function deploy(from, name, args = [], value = 0n) {
    const data = C[name].bytecode + (args.length ? C[name].iface.encodeDeploy(args).slice(2) : '');
    const res = await vm.evm.runCall({ caller: from, origin: from, data: hexToBytes(data), value, gasLimit: 20_000_000n, block: block() });
    if (res.execResult.exceptionError) throw new Error('deploy failed ' + name + ' ' + res.execResult.exceptionError.error);
    return res.createdAddress;
  }
  const send = async (from, to, name, fn, args, value = 0n, expectRevert = false) => call(from, to, C[name].iface.encodeFunctionData(fn, args), value, expectRevert);
  const read = async (to, name, fn, args = []) => { const r = await call(DEPLOYER, to, C[name].iface.encodeFunctionData(fn, args)); return C[name].iface.decodeFunctionResult(fn, bytesToHex(r.execResult.returnValue)); };
  const balance = async (a) => (await vm.stateManager.getAccount(a))?.balance ?? 0n;

  console.log('deploying');
  const router = await deploy(DEPLOYER, 'MockRouter');
  const stock = await deploy(DEPLOYER, 'MockStock');
  const factory = await deploy(DEPLOYER, 'ForkFactory', [FEE.toString(), router.toString()]);
  await send(DEPLOYER, factory, 'ForkFactory', 'setStocks', [['mcdonalds', 'wendys'], [stock.toString(), ethers.ZeroAddress]]);
  await send(ALICE, factory, 'ForkFactory', 'createCoin', ['x', 'XX', 'luckin', 10n * E18, 7200n], 0n, true);
  ok(true, 'unregistered restaurant cannot be paired');

  console.log('coin paid in MCDx (stock path)');
  await send(ALICE, factory, 'ForkFactory', 'createCoin', ['Golden Arches Club', 'ARCHES', 'mcdonalds', 10n * E18, 7200n]);
  const [raises] = await read(factory, 'ForkFactory', 'all', [0, 10]);
  const raise = acct(raises[0]);
  let info = await read(raise, 'ForkRaise', 'info');
  ok(info[1].toLowerCase() === stock.toString().toLowerCase(), 'raise pays in the registered stock token');
  ok(info[6] === 10n * E18 && info[7] === 10n * E18 / 3n && info[8] === 1n * E18, 'target 10, minimum 10/3, cap 1');
  await send(DEPLOYER, stock, 'MockStock', 'mint', [BOB.toString(), 100n * E18]);
  await send(DEPLOYER, stock, 'MockStock', 'mint', [ALICE.toString(), 100n * E18]);
  await send(BOB, raise, 'ForkRaise', 'buyWith', [E18 / 2n], 0n, true);
  ok(true, 'buyWith without approval reverts');
  await send(BOB, stock, 'MockStock', 'approve', [raise.toString(), 1000n * E18]);
  await send(BOB, raise, 'ForkRaise', 'buyWith', [E18 / 2n]);
  await send(BOB, raise, 'ForkRaise', 'buyWith', [5n * E18]);                 // clipped to the cap
  const [paidBob] = await read(raise, 'ForkRaise', 'paid', [BOB.toString()]);
  const [bobStock] = await read(stock, 'MockStock', 'balanceOf', [BOB.toString()]);
  ok(paidBob === 1n * E18, 'cap per wallet clips the second buy to 1.0 total');
  ok(bobStock === 99n * E18, 'only the accepted amount leaves the buyer (99 left of 100)');
  await send(BOB, raise, 'ForkRaise', 'buy', [], E18, true);
  ok(true, 'buy() in BNB reverts on a stock-paid raise');
  await send(ALICE, stock, 'MockStock', 'approve', [raise.toString(), 1000n * E18]);
  await send(ALICE, raise, 'ForkRaise', 'buyWith', [1n * E18]);
  await send(ALICE, raise, 'ForkRaise', 'finalize', [], 0n, true);
  ok(true, 'finalize before close reverts');
  now += 7201n;
  await send(ALICE, raise, 'ForkRaise', 'finalize', []);
  info = await read(raise, 'ForkRaise', 'info');
  ok(info[14] === true && info[15] === false, 'closed at deadline below the minimum: finalized, not graduated');
  const before = await read(stock, 'MockStock', 'balanceOf', [BOB.toString()]);
  await send(BOB, raise, 'ForkRaise', 'refund', []);
  const after = await read(stock, 'MockStock', 'balanceOf', [BOB.toString()]);
  ok(after[0] - before[0] === 1n * E18, 'refund returns 100% of the stock tokens');
  await send(BOB, raise, 'ForkRaise', 'refund', [], 0n, true);
  ok(true, 'second refund reverts');

  console.log('coin paid in MCDx that fills its target and graduates');
  await send(ALICE, factory, 'ForkFactory', 'createCoin', ['Big Mac Index', 'BIGMAC', 'mcdonalds', 2n * E18, 7200n]);
  const [raises2] = await read(factory, 'ForkFactory', 'all', [0, 10]);
  const r2 = acct(raises2[1]);
  const buyers = [];
  for (let i = 0; i < 10; i++) { const who = acct('0x' + (0x50 + i).toString(16).padStart(2, '0').repeat(20)); buyers.push(who);
    await vm.stateManager.putAccount(who, Account.fromAccountData({ balance: 10n * E18, nonce: 0n }));
    await send(DEPLOYER, stock, 'MockStock', 'mint', [who.toString(), 10n * E18]); await send(who, stock, 'MockStock', 'approve', [r2.toString(), 10n * E18]);
    await send(who, r2, 'ForkRaise', 'buyWith', [E18 / 5n]); }            // 10 × 0.2 = 2.0 = target
  info = await read(r2, 'ForkRaise', 'info');
  ok(info[11] === 2n * E18 && info[12] > 0n, 'target reached: raise closed early');
  await send(buyers[0], r2, 'ForkRaise', 'buyWith', [E18 / 10n], 0n, true);
  ok(true, 'buy after close reverts');
  await send(buyers[3], r2, 'ForkRaise', 'finalize', []);
  info = await read(r2, 'ForkRaise', 'info');
  ok(info[15] === true, 'graduated');
  const [lpTokens] = await read(router, 'MockRouter', 'lastTokens'); const [lpStock] = await read(router, 'MockRouter', 'lastEth'); const [pairTok] = await read(router, 'MockRouter', 'lastPair');
  ok(lpTokens === 200_000_000n * E18, '20% of supply went to the pool');
  ok(lpStock === 2n * E18 * 99n / 100n, '99% of the raised stock went to the pool');
  ok(pairTok.toLowerCase() === stock.toString().toLowerCase(), 'pool is COIN/MCDx');
  const [feeBal] = await read(stock, 'MockStock', 'balanceOf', [FEE.toString()]);
  ok(feeBal === 2n * E18 / 100n, '1% fee paid in the stock token');
  const [cl] = await read(r2, 'ForkRaise', 'claimable', [buyers[0].toString()]);
  ok(cl === 80_000_000n * E18, 'each of 10 equal buyers can claim 80M tokens');
  await send(buyers[0], r2, 'ForkRaise', 'claim', []);
  const [tokenAddr] = await read(r2, 'ForkRaise', 'token');
  const [tb] = await read(acct(tokenAddr), 'ForkToken', 'balanceOf', [buyers[0].toString()]);
  ok(tb === 80_000_000n * E18, 'claimed tokens arrive');
  await send(buyers[0], r2, 'ForkRaise', 'claim', [], 0n, true);
  ok(true, 'double claim reverts');
  await send(buyers[1], r2, 'ForkRaise', 'refund', [], 0n, true);
  ok(true, 'refund on a graduated raise reverts');

  console.log('coin paid in BNB (restaurant registered with address(0))');
  await send(ALICE, factory, 'ForkFactory', 'createCoin', ['Frosty', 'FROSTY', 'wendys', 1n * E18, 7200n]);
  const [raises3] = await read(factory, 'ForkFactory', 'all', [0, 10]);
  const r3 = acct(raises3[2]);
  const b0 = await balance(BOB);
  await send(BOB, r3, 'ForkRaise', 'buy', [], E18 / 2n);                     // cap is 0.1: 0.4 change returned
  const b1 = await balance(BOB);
  ok(b0 - b1 === E18 / 10n, 'BNB buy clipped to the cap and change returned');
  await send(BOB, r3, 'ForkRaise', 'buyWith', [E18], 0n, true);
  ok(true, 'buyWith reverts on a BNB raise');
  for (let i = 0; i < 9; i++) await send(buyers[i], r3, 'ForkRaise', 'buy', [], E18 / 10n);
  info = await read(r3, 'ForkRaise', 'info');
  ok(info[11] === 1n * E18, 'ten wallets fill 1 BNB');
  const feeBnb0 = await balance(FEE);
  await send(ALICE, r3, 'ForkRaise', 'finalize', []);
  const [lpEth] = await read(router, 'MockRouter', 'lastEth');
  ok(lpEth === E18 * 99n / 100n, '99% of BNB went into addLiquidityETH');
  ok((await balance(FEE)) - feeBnb0 === E18 / 100n, '1% BNB fee paid');
  const [cnt] = await read(factory, 'ForkFactory', 'count');
  ok(cnt === 3n, 'factory lists three coins');
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
