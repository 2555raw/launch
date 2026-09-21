// LilyPad protocol tests on an in-process EVM (no node, no keys). Run: npm test
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VM } from '@ethereumjs/vm';
import { Block } from '@ethereumjs/block';
import { Common, Hardfork, Chain } from '@ethereumjs/common';
import { Address, Account, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { Interface, AbiCoder, parseUnits, formatUnits } from 'ethers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'out', 'artifacts.json'), 'utf8'));
const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun });
const vm = await VM.create({ common });
const coder = AbiCoder.defaultAbiCoder();

let blockNumber = 1n;
const blockAt = n => Block.fromBlockData({ header: { number: n, timestamp: 1_700_000_000n + n * 12n, gasLimit: 30_000_000n, baseFeePerGas: 0n } }, { common });
const addr = h => new Address(hexToBytes(h));
const who = { owner: addr('0x1000000000000000000000000000000000000001'), treasury: addr('0x1000000000000000000000000000000000000002'), alice: addr('0x1000000000000000000000000000000000000003'), bob: addr('0x1000000000000000000000000000000000000004'), carol: addr('0x1000000000000000000000000000000000000005') };
for (const a of Object.values(who)) await vm.stateManager.putAccount(a, new Account(0n, 10n ** 24n));

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ✔', msg); } else { failed++; console.log('  ✘', msg); } };
const near = (a, b, tolBps = 1n) => (a > b ? a - b : b - a) * 10_000n <= (b > 0n ? b : 1n) * tolBps;

const ifaces = Object.fromEntries(Object.entries(ART).map(([n, a]) => [n, new Interface(a.abi)]));
const allIfaces = Object.values(ifaces);
function explain(ret) {
  const hex = bytesToHex(ret);
  for (const i of allIfaces) { try { const e = i.parseError(hex); if (e) return `${e.name}(${e.args.map(String).join(', ')})`; } catch {} }
  return hex.slice(0, 20) || 'no data';
}
async function call(from, to, iface, fn, args = [], value = 0n) {
  const data = hexToBytes(iface.encodeFunctionData(fn, args));
  const r = await vm.evm.runCall({ caller: from, origin: from, to, data, value, gasLimit: 12_000_000n, block: blockAt(blockNumber) });
  if (r.execResult.exceptionError) return { reverted: true, reason: explain(r.execResult.returnValue), gas: r.execResult.executionGasUsed };
  const out = iface.decodeFunctionResult(fn, bytesToHex(r.execResult.returnValue));
  const logs = r.execResult.logs.map(([a, t, d]) => { const rec = { address: bytesToHex(a), topics: t.map(bytesToHex), data: bytesToHex(d) }; for (const i of allIfaces) { try { const p = i.parseLog(rec); if (p) return { name: p.name, args: p.args, address: rec.address }; } catch {} } return rec; });
  return { reverted: false, out, logs, gas: r.execResult.executionGasUsed };
}
async function view(to, iface, fn, args = []) { const r = await call(who.owner, to, iface, fn, args); if (r.reverted) throw new Error(`${fn} reverted: ${r.reason}`); return r.out.length === 1 ? r.out[0] : r.out; }
async function deploy(from, name, args = [], value = 0n) {
  const a = ART[name]; const i = ifaces[name];
  const ctor = a.abi.find(x => x.type === 'constructor');
  const data = a.bytecode + (ctor ? coder.encode(ctor.inputs, args).slice(2) : '');
  const r = await vm.evm.runCall({ caller: from, origin: from, data: hexToBytes(data), value, gasLimit: 20_000_000n, block: blockAt(blockNumber) });
  if (r.execResult.exceptionError) throw new Error(`deploy ${name} failed: ${explain(r.execResult.returnValue)}`);
  return r.createdAddress;
}
const A = a => a.toString();
const E18 = 10n ** 18n;

// ---------------------------------------------------------------- setup
console.log('\nsetup');
const tsla = await deploy(who.owner, 'MockStock', ['Tesla', 'TSLA', 18]);
const spy = await deploy(who.owner, 'MockStock', ['S&P 500', 'SPY', 6]);
const v2f = await deploy(who.owner, 'MockV2Factory');
const v2r = await deploy(who.owner, 'MockV2Router', [A(v2f)]);
const grad = await deploy(who.owner, 'UniswapV2Graduator', [A(v2r), A(v2f)]);
const LAUNCH_FEE = parseUnits('0.001', 18);
const factory = await deploy(who.owner, 'LilyPadFactory', [A(who.treasury), A(grad), LAUNCH_FEE]);
const F = ifaces.LilyPadFactory, C = ifaces.LilyPadCurve, T = ifaces.LilyPadToken, S = ifaces.MockStock;
ok(A(await view(factory, F, 'owner')).toLowerCase() === A(who.owner).toLowerCase(), 'factory owner is the deployer');
let r = await call(who.owner, factory, F, 'setStock', [A(tsla), parseUnits('16.64', 18), parseUnits('41.6', 18), true]); ok(!r.reverted, 'TSLA approved: phantom 16.64, graduation at 41.6 TSLA');
r = await call(who.owner, factory, F, 'setStock', [A(spy), parseUnits('10', 6), parseUnits('30', 6), true]); ok(!r.reverted, 'SPY (6 decimals) approved');
r = await call(who.alice, factory, F, 'setStock', [A(spy), 1n, 1n, true]); ok(r.reverted && r.reason.startsWith('NotOwner'), 'only the owner sets stocks');
for (const p of [who.alice, who.bob, who.carol]) { await call(who.owner, tsla, S, 'mint', [A(p), 100n * E18]); await call(who.owner, spy, S, 'mint', [A(p), 100n * 10n ** 6n]); await call(p, tsla, S, 'approve', [A(factory), 2n ** 255n]); await call(p, spy, S, 'approve', [A(factory), 2n ** 255n]); }

// ---------------------------------------------------------------- launch with a first buy
console.log('\nlaunch');
const params = (over = {}) => [{ name: 'Robotaxi Season', symbol: 'ROBO', metadata: '{"logo":"","desc":"For everyone who thinks the robotaxi is the whole thesis."}', stock: A(tsla), creatorTaxBps: 100, snipeExemptions: [], devBuyQuote: parseUnits('0.5', 18), minDevTokens: 0n, salt: '0x' + '11'.repeat(32), ...over }];
r = await call(who.alice, factory, F, 'launch', params(), 0n); ok(r.reverted && r.reason.startsWith('WrongFee'), 'launch without the fee reverts: ' + r.reason);
r = await call(who.alice, factory, F, 'launch', params({ stock: A(who.carol) }), LAUNCH_FEE); ok(r.reverted && r.reason.startsWith('StockNotApproved'), 'launch on an unapproved stock reverts');
r = await call(who.alice, factory, F, 'launch', params({ creatorTaxBps: 300 }), LAUNCH_FEE); ok(r.reverted && r.reason.startsWith('CreatorTaxTooHigh'), 'creator tax above the max reverts');
r = await call(who.alice, factory, F, 'launch', params({ symbol: 'R' }), LAUNCH_FEE); ok(r.reverted && r.reason.startsWith('BadName'), 'a one-letter ticker reverts');
r = await call(who.alice, factory, F, 'launch', params(), LAUNCH_FEE);
ok(!r.reverted, 'alice launches $ROBO paired with TSLA with a 0.5 TSLA first buy' + (r.reverted ? ' — ' + r.reason : ` (gas ${r.gas})`));
const created = r.logs.find(l => l.name === 'PairCreated');
ok(!!created && created.args.stock.toLowerCase() === A(tsla).toLowerCase(), 'PairCreated names TSLA as the pair');
const token = addr(created.args.token), curve = addr(created.args.curve);
ok(A(await view(curve, C, 'quote')).toLowerCase() === A(tsla).toLowerCase(), 'curve.quote() is the TSLA token: the coin can only be bought and sold with it');
ok(await view(token, T, 'totalSupply') === 1_000_000_000n * E18, 'supply is exactly 1,000,000,000');
const aliceTokens = await view(token, T, 'balanceOf', [A(who.alice)]);
const q0 = parseUnits('16.64', 18), net0 = parseUnits('0.5', 18) * 9_800n / 10_000n, T0 = 1_000_000_000n * E18;
const expected0 = net0 * T0 / (q0 + net0);
ok(aliceTokens === expected0, `first buy follows the formula: ${formatUnits(aliceTokens, 18).slice(0, 12)} ROBO for 0.5 TSLA`);
ok(await view(curve, C, 'currentSnipeTaxBps', [A(who.alice)]) === 0n, 'the creator pays no snipe tax');
ok(await view(curve, C, 'quoteReserve') === net0, 'real reserve = 0.5 TSLA minus 1% fee minus 1% creator tax');
ok(await view(curve, C, 'protocolFees') === parseUnits('0.005', 18) && await view(curve, C, 'creatorFees') === parseUnits('0.005', 18), 'protocol and creator fees accrued');
ok(await view(curve, C, 'tokenReserve') + aliceTokens === T0, 'every coin is either on the curve or with alice');
ok(A(await view(factory, F, 'curveOf', [A(token)])).toLowerCase() === A(curve).toLowerCase(), 'factory registry maps coin to curve');

// ---------------------------------------------------------------- a sniper, then a patient buyer
console.log('\ntrading');
blockNumber += 1n;
const snipe = await view(curve, C, 'currentSnipeTaxBps', [A(who.bob)]);
ok(snipe === 2_000n * 59n / 60n, `one block in, the snipe tax is ${snipe} bps`);
await call(who.bob, tsla, S, 'approve', [A(curve), 2n ** 255n]);
const [qBob] = await view(curve, C, 'quoteBuy', [E18, A(who.bob)]);
r = await call(who.bob, curve, C, 'buy', [E18, qBob, A(who.bob)]); ok(!r.reverted, 'bob buys 1 TSLA worth at the quoted amount' + (r.reverted ? ' — ' + r.reason : ''));
const bobTokens = await view(token, T, 'balanceOf', [A(who.bob)]);
ok(bobTokens === qBob, 'he receives exactly what quoteBuy promised');
const [qNoSnipe] = await view(curve, C, 'quoteBuy', [E18, A(who.alice)]);
ok(qNoSnipe > bobTokens, 'the same TSLA buys more once the snipe tax is gone');
r = await call(who.bob, curve, C, 'buy', [E18, qBob * 2n, A(who.bob)]); ok(r.reverted && r.reason.startsWith('Slippage'), 'minTokensOut protects against slippage');
const curveBal = await view(tsla, S, 'balanceOf', [A(curve)]);
const q1 = await view(curve, C, 'quoteReserve'), pf1 = await view(curve, C, 'protocolFees'), cf1 = await view(curve, C, 'creatorFees');
ok(curveBal === q1 + pf1 + cf1, 'curve TSLA balance = reserve + protocol fees + creator fees');
// sell half
await call(who.bob, token, T, 'approve', [A(curve), 2n ** 255n]);
const half = bobTokens / 2n;
const [qs] = await view(curve, C, 'quoteSell', [half]);
const bobTslaBefore = await view(tsla, S, 'balanceOf', [A(who.bob)]);
r = await call(who.bob, curve, C, 'sell', [half, qs, A(who.bob)]); ok(!r.reverted, 'bob sells half back for TSLA' + (r.reverted ? ' — ' + r.reason : ''));
ok(await view(tsla, S, 'balanceOf', [A(who.bob)]) - bobTslaBefore === qs, 'he receives exactly what quoteSell promised');
ok(await view(token, T, 'balanceOf', [A(who.bob)]) === bobTokens - half, 'his coin balance dropped by the half he sold');
const q2 = await view(curve, C, 'quoteReserve'), pf2 = await view(curve, C, 'protocolFees'), cf2 = await view(curve, C, 'creatorFees');
ok(await view(tsla, S, 'balanceOf', [A(curve)]) === q2 + pf2 + cf2, 'accounting still balances after the sell');
r = await call(who.carol, curve, C, 'sell', [E18, 0n, A(who.carol)]); ok(r.reverted, 'selling coins you do not have reverts');
// fees
r = await call(who.carol, curve, C, 'claimProtocolFees'); ok(!r.reverted && await view(tsla, S, 'balanceOf', [A(who.treasury)]) === pf2, 'anyone can push protocol fees to the treasury');
const aliceTslaBefore = await view(tsla, S, 'balanceOf', [A(who.alice)]);
r = await call(who.carol, curve, C, 'claimCreatorFees'); ok(!r.reverted && await view(tsla, S, 'balanceOf', [A(who.alice)]) - aliceTslaBefore === cf2, 'creator fees go to the creator');

// ---------------------------------------------------------------- graduation
console.log('\ngraduation');
blockNumber += 100n;
ok(await view(curve, C, 'currentSnipeTaxBps', [A(who.bob)]) === 0n, 'after the window the snipe tax is 0');
await call(who.carol, tsla, S, 'approve', [A(curve), 2n ** 255n]);
const [virtBefore, tokBefore] = await view(curve, C, 'getReserves');
const priceBefore = virtBefore * E18 / tokBefore;
r = await call(who.carol, curve, C, 'buy', [parseUnits('60', 18), 0n, A(who.carol)]);
ok(!r.reverted, 'a 60 TSLA buy crosses the 41.6 threshold' + (r.reverted ? ' — ' + r.reason : ''));
const gradEv = r.logs.find(l => l.name === 'Graduated');
ok(!!gradEv, 'the same transaction graduates the curve');
ok(await view(curve, C, 'graduated') === true, 'graduated() is true');
const pool = A(await view(curve, C, 'pool'));
ok(pool !== '0x0000000000000000000000000000000000000000', 'a pool exists: ' + pool);
const poolTok = await view(token, T, 'balanceOf', [pool]), poolQuote = await view(tsla, S, 'balanceOf', [pool]);
ok(poolTok === gradEv.args.tokensToPool && poolQuote === gradEv.args.quoteToPool, 'the pool holds exactly the coins and TSLA the event says');
const poolPrice = poolQuote * E18 / poolTok;
const [virtAfterBuy] = [virtBefore]; // price continuity is checked against the curve's final price, which the event lets us rebuild
const raised = gradEv.args.quoteToPool + gradEv.args.graduationFee;
const finalPrice = (q0 + raised) * E18 / (tokBefore - (await view(token, T, 'balanceOf', [A(who.carol)])));
ok(near(poolPrice, finalPrice, 5n), `pool opens at the curve's last price (${formatUnits(poolPrice, 18).slice(0, 12)} vs ${formatUnits(finalPrice, 18).slice(0, 12)} TSLA per coin)`);
ok(await view(curve, C, 'tokenReserve') === 0n && await view(curve, C, 'quoteReserve') === 0n, 'curve reserves are empty');
ok(await view(token, T, 'balanceOf', [A(curve)]) === 0n, 'no coins are left on the curve (the rest burned)');
ok(await view(token, T, 'balanceOf', ['0x000000000000000000000000000000000000dEaD']) === gradEv.args.tokensBurned, 'burned coins sit at the dead address');
ok(await view(curve, C, 'protocolFees') >= gradEv.args.graduationFee, 'the graduation fee is booked for the treasury');
r = await call(who.bob, curve, C, 'buy', [E18, 0n, A(who.bob)]); ok(r.reverted && r.reason.startsWith('Graduated_'), 'buying on a graduated curve reverts');
r = await call(who.bob, curve, C, 'sell', [1n, 0n, A(who.bob)]); ok(r.reverted && r.reason.startsWith('Graduated_'), 'selling on a graduated curve reverts');
const curveTsla = await view(tsla, S, 'balanceOf', [A(curve)]);
ok(curveTsla === await view(curve, C, 'protocolFees') + await view(curve, C, 'creatorFees'), 'only fees remain in the curve, and they are claimable');

// ---------------------------------------------------------------- a 6-decimal stock and the launch fee
console.log('\nsix decimals · fees · pause');
r = await call(who.bob, factory, F, 'launch', params({ name: 'Index Enjoyer', symbol: 'INDEX', stock: A(spy), devBuyQuote: parseUnits('1', 6), creatorTaxBps: 0 }), LAUNCH_FEE);
ok(!r.reverted, 'bob launches $INDEX on SPY (6 decimals)' + (r.reverted ? ' — ' + r.reason : ''));
const spyCurve = addr(r.logs.find(l => l.name === 'PairCreated').args.curve), spyToken = addr(r.logs.find(l => l.name === 'PairCreated').args.token);
const bobIndex = await view(spyToken, T, 'balanceOf', [A(who.bob)]);
const netS = parseUnits('1', 6) * 9_900n / 10_000n;
ok(bobIndex === netS * T0 / (parseUnits('10', 6) + netS), 'the formula works in 6-decimal units');
await call(who.carol, spy, S, 'approve', [A(spyCurve), 2n ** 255n]);
r = await call(who.carol, spyCurve, C, 'buy', [parseUnits('2', 6), 0n, A(who.carol)]); ok(!r.reverted, 'carol buys with 2 SPY');
ok(await view(factory, F, 'allTokensLength') === 2n, 'the factory lists both coins');
const treasuryEthBefore = (await vm.stateManager.getAccount(who.treasury)).balance;
r = await call(who.carol, factory, F, 'withdrawLaunchFees'); ok(!r.reverted && (await vm.stateManager.getAccount(who.treasury)).balance - treasuryEthBefore === 2n * LAUNCH_FEE, 'two launch fees reach the treasury in ETH');
await call(who.owner, factory, F, 'setPaused', [true]);
r = await call(who.alice, factory, F, 'launch', params({ salt: '0x' + '22'.repeat(32) }), LAUNCH_FEE); ok(r.reverted && r.reason.startsWith('IsPaused'), 'a paused factory refuses launches');
await call(who.owner, factory, F, 'setPaused', [false]);
r = await call(who.owner, factory, F, 'transferOwnership', [A(who.carol)]); r = await call(who.carol, factory, F, 'acceptOwnership');
ok(!r.reverted && A(await view(factory, F, 'owner')).toLowerCase() === A(who.carol).toLowerCase(), 'two-step ownership transfer');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
