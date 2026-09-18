/* The strategy, against a real Uniswap V3 pool.

   The pool here is Uniswap's shipped bytecode — the same contract that is on
   mainnet — deployed by Uniswap's own factory. Nothing about the market is
   mocked. The only stand-in is PoolSeeder, which plays the rest of the world:
   it provides the liquidity the strategy trades against, and it plays the
   attacker when a test needs the price shoved.

   The three groups are named after the three rules the contract is built on.
   The middle one is the important one: it is the attack that has emptied more
   vaults of this shape than every other bug put together. */

import { Chain, Contract } from './chain.mjs';
import { uniswapArtifacts } from './uniswap.mjs';
import { createAddressFromString } from '@ethereumjs/util';

const Q96 = 2n ** 96n;
let pass = 0, fail = 0;
const failures = [];
const ok = (c, label, note = '') => {
  if (c) { pass++; console.log(`  ok   ${label}${note ? '   ' + note : ''}`); }
  else { fail++; failures.push(label); console.log(`  FAIL ${label}${note ? '   ' + note : ''}`); }
};
const group = n => console.log(`\n=== ${n} ===`);
const near = (a, b, tolBps) => {
  const [x, y] = [a < b ? a : b, a < b ? b : a];
  return y === 0n ? x === 0n : (y - x) * 10_000n <= y * BigInt(tolBps);
};

const USDG_DEC = 6n, STOCK_DEC = 18n, PRICE_DEC = 8n;
const U = 10n ** USDG_DEC;
const PRICE = 219_44000000n;            // $219.44, Chainlink style

async function world({ slippageBps = 100, halfBand = 6000, drift = 600, cooldown = 3600 } = {}) {
  const c = await Chain.create();
  const admin = await c.account('admin');
  const keeper = await c.account('keeper');
  const vaultEOA = await c.account('vault');      // stands in for the vault contract
  const attacker = await c.account('attacker');

  const factory = await c.deploy('UniswapV3Factory', [], admin);
  const usdg = await c.deploy('MockERC20', ['Global Dollar', 'USDG', Number(USDG_DEC)], admin);
  const stock = await c.deploy('MockERC20', ['xNVDA', 'xNVDA', Number(STOCK_DEC)], admin);

  const r = await factory.must(admin, 'createPool', [usdg.hex, stock.hex, 3000]);
  const poolAddr = r.events.find(e => e.name === 'PoolCreated').args.pool;
  const pool = new Contract(c, createAddressFromString(poolAddr), uniswapArtifacts.UniswapV3Pool.abi, 'Pool');

  const feed = await c.deploy('MockAggregator', [Number(PRICE_DEC), PRICE, c.timestamp], admin);
  const gate = await c.deploy('ChainlinkGate', [feed.hex, '0x' + '00'.repeat(20), 3600n, 0n], admin);

  const usdgIsToken0 = (await pool.read('token0')).toLowerCase() === usdg.hex.toLowerCase();

  // start the pool exactly where the oracle says
  const oph = await c.deploy('OraclePriceHarness', [], admin);
  const sqrtOracle = await oph.read('toSqrtPriceX96',
    [PRICE, Number(PRICE_DEC), Number(USDG_DEC), Number(STOCK_DEC), usdgIsToken0]);
  await pool.must(admin, 'initialize', [sqrtOracle]);

  const strat = await c.deploy('VesicaStrategy',
    [pool.hex, usdg.hex, gate.hex, vaultEOA.toString(), admin.toString(),
     halfBand, drift, BigInt(slippageBps), BigInt(cooldown)], admin);
  await strat.must(admin, 'grantRole', [await strat.read('KEEPER_ROLE'), keeper.toString()]);

  // the rest of the market
  const seeder = await c.deploy('PoolSeeder', [pool.hex], admin);
  await usdg.must(admin, 'mint', [seeder.hex, 500_000_000n * U]);
  await stock.must(admin, 'mint', [seeder.hex, 5_000_000n * 10n ** STOCK_DEC]);
  /* Depth matters: at 5e16 of liquidity a 50,000 USDG swap moves the pool about
     a percent all by itself and the strategy's own guard refuses the trade,
     which is correct behaviour against a thin pool but tells us nothing. 1e19
     is roughly $150M of USDG depth, so the 0.30% pool fee dominates and the
     tests measure the strategy rather than the seeding. */
  await seeder.must(admin, 'seed', [-887220, 887220, 10n ** 19n]);

  // the vault's money
  await usdg.must(admin, 'mint', [vaultEOA.toString(), 10_000_000n * U]);
  await usdg.must(vaultEOA, 'approve', [strat.hex, 2n ** 255n]);

  const tick = async () => (await pool.read('slot0'))[1];
  const refresh = async (p = PRICE) => {
    const rid = await feed.read('roundId');
    await feed.must(admin, 'set', [rid + 1n, p, c.timestamp, c.timestamp, rid + 1n]);
  };

  /* Move the pool. Uniswap requires the price limit to sit on the side the
     swap is heading, so the direction picks the limit rather than the caller.
     `down` means selling token0, which is what pushes the price down. */
  const shove = async (down, fraction = 4n) => {
    const cur = (await pool.read('slot0'))[0];
    const limit = down ? cur / 3n : cur * 3n;
    const tokenIn = new Contract(c, createAddressFromString(
      await pool.read(down ? 'token0' : 'token1')), usdg.iface.fragments, 'in');
    const bal = await tokenIn.read('balanceOf', [seeder.hex]);
    return seeder.send(attacker, 'shove', [down, bal / fraction, limit]);
  };

  /* Real pools follow the oracle because somebody is paid to make them. The
     tests need that actor too, or every scenario after an oracle move happens
     in a pool nobody has corrected. */
  const arb = async () => {
    const target = await strat.read('oracleSqrtPriceX96');
    const cur = (await pool.read('slot0'))[0];
    if (cur === target) return;
    const down = cur > target;
    const tokenIn = new Contract(c, createAddressFromString(
      await pool.read(down ? 'token0' : 'token1')), usdg.iface.fragments, 'in');
    const bal = await tokenIn.read('balanceOf', [seeder.hex]);
    return seeder.send(admin, 'shove', [down, bal / 2n, target]);
  };

  return { c, admin, keeper, vaultEOA, attacker, factory, usdg, stock, pool, feed, gate,
           strat, seeder, usdgIsToken0, sqrtOracle, oph, tick, refresh, shove, arb };
}

/* ================================================================== */
group('it puts money to work in a real pool');
let w = await world();
{
  console.log(`   pool ${w.pool.hex}  usdg is token${w.usdgIsToken0 ? 0 : 1}  tick ${await w.tick()}`);
  const r = await w.strat.must(w.vaultEOA, 'deposit', [100_000n * U]);
  const ev = r.events.find(e => e.name === 'Deployed');
  ok(!!ev, 'a deposit deploys a position', ev ? `liquidity ${ev.args.liquidity}` : '');
  ok(ev.args.swapped === 50_000n * U, 'exactly half is swapped into the Stock Token, as the page says',
     `${ev.args.swapped / U} of ${100_000}`);
  ok(ev.args.liquidity > 0n, 'and the liquidity landed in the pool');
  ok(ev.args.lower < ev.args.upper, 'inside a band around the oracle tick',
     `[${ev.args.lower}, ${ev.args.upper}]`);

  const ta = await w.strat.read('totalAssets');
  ok(near(ta, 100_000n * U, 60), 'the strategy is worth what went in, less the pool fee',
     `${ta / U} USDG of 100,000`);
}

/* ================================================================== */
group('the oracle prices it, the pool only executes');
{
  /* The attack, in full: shove the pool far away from the oracle inside one
     transaction, and see whether the vault believes the new price. A strategy
     that reads slot0 to value itself reprices every share here, and that is
     the moment the money leaves. */
  const before = await w.strat.read('totalAssets');
  const tickBefore = await w.tick();

  const down = await w.shove(true);
  ok(down.ok, 'the attacker can move the pool at will', down.reason || '');
  const tickAfter = await w.tick();
  const after = await w.strat.read('totalAssets');
  ok(tickAfter !== tickBefore, 'and really did move it', `tick ${tickBefore} -> ${tickAfter}`);
  ok(after === before, 'yet totalAssets did not move one wei', `${before} on both sides`);

  const up = await w.shove(false);
  ok(up.ok, 'the attacker can shove it the other way too');
  ok((await w.strat.read('totalAssets')) === before, 'and that does nothing either',
     `tick now ${await w.tick()}`);

  /* The point is not that the number is frozen — a vault that ignored price
     entirely would also pass the two checks above. It is that the number
     follows the oracle and nothing else. */
  await w.refresh(PRICE * 2n);
  const doubled = await w.strat.read('totalAssets');
  ok(doubled !== before, 'but a real oracle move does reprice it', `${before} -> ${doubled}`);
  await w.refresh(PRICE);
  ok((await w.strat.read('totalAssets')) === before, 'and it comes back when the oracle does');
}

/* ================================================================== */
group('no swap runs unbounded');
{
  const w2 = await world({ slippageBps: 50 });
  await w2.strat.must(w2.vaultEOA, 'deposit', [50_000n * U]);

  // an attacker sets up a sandwich: move the pool well away from the oracle,
  // then let the vault's deposit run into it
  /* The sandwich only pays one way round. The strategy's deposit buys the
     Stock Token, so an attacker profits by making it dear first — pushing the
     pool price up — then selling into the vault's purchase. */
  const tickWas = await w2.tick();
  await w2.shove(false, 2n);
  console.log(`   the attacker walked the pool from tick ${tickWas} to ${await w2.tick()}; the oracle has not moved`);

  const r = await w2.strat.send(w2.vaultEOA, 'deposit', [50_000n * U]);
  ok(!r.ok, 'a deposit into a pool walked away from the oracle is refused, not executed', r.reason);
  ok(/SlippageTooHigh|PoolDislocated/.test(String(r.reason)), 'and refused in the strategy\'s own words', r.reason);
}
{
  /* The guard is one-sided on purpose, and that is worth pinning down rather
     than leaving to the reader: buying below the oracle price is not a loss to
     defend against — the attacker paid for that discount — so the vault takes
     it. Only getting less than the oracle says is refused. */
  const w2b = await world({ slippageBps: 50 });
  await w2b.strat.must(w2b.vaultEOA, 'deposit', [50_000n * U]);
  await w2b.shove(true, 2n);       // the Stock Token is now cheap in the pool
  const worthBefore = await w2b.strat.read('totalAssets');
  const r2 = await w2b.strat.send(w2b.vaultEOA, 'deposit', [50_000n * U]);
  ok(r2.ok, 'a pool that has moved in the vault\'s favour is not refused', r2.reason || '');
  const gained = (await w2b.strat.read('totalAssets')) - worthBefore;
  ok(gained > 50_000n * U, 'and the vault keeps the discount', `+${gained / U} USDG for 50,000 in`);
}
{
  const w3 = await world();
  await w3.strat.must(w3.vaultEOA, 'deposit', [50_000n * U]);
  const r = await w3.strat.send(w3.admin, 'setSlippage', [2000n]);
  ok(!r.ok && /BadSlippage/.test(r.reason), 'and the admin cannot widen the guard past 5%', r.reason);
  ok((await w3.strat.read('maxSlippageBps')) === 100n, 'the guard is unchanged');
}

/* ================================================================== */
group('rebalancing is permissioned, banded and rate-limited');
{
  const w4 = await world({ drift: 600, cooldown: 3600 });
  await w4.strat.must(w4.vaultEOA, 'deposit', [100_000n * U]);

  let r = await w4.strat.send(w4.attacker, 'rebalance');
  ok(!r.ok && /Unauthorized/.test(r.reason), 'a stranger cannot rebalance', r.reason);

  r = await w4.strat.send(w4.keeper, 'rebalance');
  ok(!r.ok && /StillInBand/.test(r.reason), 'and the keeper cannot while the price is still in band', r.reason);

  // the oracle moves enough to justify it
  await w4.refresh(PRICE * 3n / 2n);
  await w4.arb();                 // the market catches up, as it would
  const before = await w4.strat.read('totalAssets');
  r = await w4.strat.must(w4.keeper, 'rebalance');
  const ev = r.events.find(e => e.name === 'Rebalanced');
  ok(!!ev, 'once the oracle has drifted, the keeper may move the position',
     ev ? `[${ev.args.oldLower},${ev.args.oldUpper}] -> [${ev.args.newLower},${ev.args.newUpper}]` : '');
  ok(ev.args.newLower !== ev.args.oldLower, 'and the band really moved');
  const after = await w4.strat.read('totalAssets');
  ok(near(after, before, 120), 'a rebalance does not lose more than the round trip costs',
     `${before} -> ${after}`);

  r = await w4.strat.send(w4.keeper, 'rebalance');
  ok(!r.ok && /CooldownNotOver|StillInBand/.test(r.reason), 'and it cannot be done again immediately', r.reason);
}

/* ================================================================== */
group('the money comes back out');
{
  const w5 = await world();
  await w5.strat.must(w5.vaultEOA, 'deposit', [100_000n * U]);
  const held = await w5.strat.read('totalAssets');

  const balBefore = await w5.usdg.read('balanceOf', [w5.vaultEOA.toString()]);
  await w5.strat.must(w5.vaultEOA, 'withdraw', [40_000n * U]);
  const got = (await w5.usdg.read('balanceOf', [w5.vaultEOA.toString()])) - balBefore;
  ok(near(got, 40_000n * U, 50), 'a partial withdrawal sends what was asked for', `${got / U} USDG`);
  ok(near(await w5.strat.read('totalAssets'), held - 40_000n * U, 120), 'and the rest stays at work',
     `${(await w5.strat.read('totalAssets')) / U} USDG`);

  const b2 = await w5.usdg.read('balanceOf', [w5.vaultEOA.toString()]);
  await w5.strat.must(w5.vaultEOA, 'withdraw', [10_000_000n * U]);
  const rest = (await w5.usdg.read('balanceOf', [w5.vaultEOA.toString()])) - b2;
  ok(rest > 0n, 'asking for everything empties the position', `${rest / U} USDG back`);
  const left = await w5.strat.read('totalAssets');
  ok(left < 1n * U, 'and leaves nothing meaningful behind', `${left} wei`);

  const total = got + rest;
  ok(near(total, 100_000n * U, 150), 'a full round trip costs only the pool fee and the spread',
     `${total / U} USDG of 100,000 — ${Number((100_000n * U - total) * 10000n / (100_000n * U)) / 100}% lost`);
}

/* ================================================================== */
group('only the vault may move the money');
{
  const w6 = await world();
  await w6.usdg.must(w6.admin, 'mint', [w6.attacker.toString(), 1_000n * U]);
  await w6.usdg.must(w6.attacker, 'approve', [w6.strat.hex, 2n ** 255n]);
  let r = await w6.strat.send(w6.attacker, 'deposit', [1_000n * U]);
  ok(!r.ok && /OnlyVault/.test(r.reason), 'a stranger cannot deposit', r.reason);
  r = await w6.strat.send(w6.attacker, 'withdraw', [1n]);
  ok(!r.ok && /OnlyVault/.test(r.reason), 'nor withdraw', r.reason);
  r = await w6.strat.send(w6.attacker, 'uniswapV3MintCallback', [0n, 0n, '0x']);
  ok(!r.ok && /OnlyPool/.test(r.reason), 'and cannot impersonate the pool calling back', r.reason);
  r = await w6.strat.send(w6.attacker, 'uniswapV3SwapCallback', [0n, 0n, '0x']);
  ok(!r.ok && /OnlyPool/.test(r.reason), 'on either callback', r.reason);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) failures.forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
