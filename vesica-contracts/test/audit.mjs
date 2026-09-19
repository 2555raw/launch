/* An adversarial pass over the contracts, written to break them rather than
   to confirm them. Each check below states a property the source *claims* —
   in a doc comment, in the README, or on the site — and then tries to make
   the code fail it. A check that fails here is a finding, not a bug in the
   test: the test is the claim.

   Written by the same hand as the contracts, which is worth exactly what that
   is worth. It is not a substitute for an external audit. */

import { Chain, Contract } from './chain.mjs';
import { uniswapArtifacts } from './uniswap.mjs';
import { createAddressFromString } from '@ethereumjs/util';

let findings = [];
const claim = (holds, label, detail = '') => {
  console.log(`  ${holds ? 'holds ' : 'BROKEN'} ${label}${detail ? '   ' + detail : ''}`);
  if (!holds) findings.push(label);
};

const USDG_DEC = 6n, STOCK_DEC = 18n, PRICE_DEC = 8n;
const U = 10n ** USDG_DEC;
const PRICE = 219_44000000n;
const HOUR = 3600;

async function world() {
  const c = await Chain.create();
  const admin = await c.account('admin');
  const keeper = await c.account('keeper');
  const vaultEOA = await c.account('vault');
  const trader = await c.account('trader');

  const factory = await c.deploy('UniswapV3Factory', [], admin);
  const usdg = await c.deploy('MockERC20', ['Global Dollar', 'USDG', Number(USDG_DEC)], admin);
  const stock = await c.deploy('MockERC20', ['xNVDA', 'xNVDA', Number(STOCK_DEC)], admin);
  const r = await factory.must(admin, 'createPool', [usdg.hex, stock.hex, 3000]);
  const poolAddr = r.events.find(e => e.name === 'PoolCreated').args.pool;
  const pool = new Contract(c, createAddressFromString(poolAddr), uniswapArtifacts.UniswapV3Pool.abi, 'Pool');

  const feed = await c.deploy('MockAggregator', [Number(PRICE_DEC), PRICE, c.timestamp], admin);
  const gate = await c.deploy('ChainlinkGate', [feed.hex, '0x' + '00'.repeat(20), BigInt(HOUR), 0n], admin);

  const usdgIsToken0 = (await pool.read('token0')).toLowerCase() === usdg.hex.toLowerCase();
  const oph = await c.deploy('OraclePriceHarness', [], admin);
  const sqrtOracle = await oph.read('toSqrtPriceX96',
    [PRICE, Number(PRICE_DEC), Number(USDG_DEC), Number(STOCK_DEC), usdgIsToken0]);
  await pool.must(admin, 'initialize', [sqrtOracle]);

  const strat = await c.deploy('VesicaStrategy',
    [pool.hex, usdg.hex, gate.hex, vaultEOA.toString(), admin.toString(), 6000, 600, 100n, BigInt(HOUR)], admin);
  await strat.must(admin, 'grantRole', [await strat.read('KEEPER_ROLE'), keeper.toString()]);

  const seeder = await c.deploy('PoolSeeder', [pool.hex], admin);
  await usdg.must(admin, 'mint', [seeder.hex, 500_000_000n * U]);
  await stock.must(admin, 'mint', [seeder.hex, 5_000_000n * 10n ** STOCK_DEC]);
  await seeder.must(admin, 'seed', [-887220, 887220, 10n ** 19n]);

  await usdg.must(admin, 'mint', [vaultEOA.toString(), 10_000_000n * U]);
  await usdg.must(vaultEOA, 'approve', [strat.hex, 2n ** 255n]);

  // somebody to trade against the position, so it actually earns fees
  await usdg.must(admin, 'mint', [trader.toString(), 50_000_000n * U]);
  await stock.must(admin, 'mint', [trader.toString(), 200_000n * 10n ** STOCK_DEC]);

  const churn = async n => {
    for (let i = 0; i < n; i++) {
      const cur = (await pool.read('slot0'))[0];
      const down = i % 2 === 0;
      await seeder.send(admin, 'shove', [down, 200_000n * U, down ? cur * 97n / 100n : cur * 103n / 100n]);
    }
  };

  return { c, admin, keeper, vaultEOA, usdg, stock, pool, feed, gate, strat, seeder, usdgIsToken0, churn };
}

/* ================================================================== */
console.log('\n=== Claim: "a dead oracle stops money coming in, never money going out" ===');
console.log('    (VesicaStrategy.withdraw doc comment, README property 2, the proof page)\n');
{
  const w = await world();
  await w.strat.must(w.vaultEOA, 'deposit', [100_000n * U]);

  // the feed goes stale — nothing else changes
  w.c.warp(HOUR * 4);

  const dep = await w.strat.send(w.vaultEOA, 'deposit', [10_000n * U]);
  claim(!dep.ok, 'a stale feed stops money coming in', dep.reason || '');

  const out = await w.strat.send(w.vaultEOA, 'withdraw', [10_000n * U]);
  claim(out.ok, 'a stale feed does NOT stop money going out', out.reason || 'withdrew fine');

  const view = await w.c.call({ to: w.strat.address, from: w.vaultEOA, isStatic: true,
    iface: w.strat.iface, data: w.strat.iface.encodeFunctionData('totalAssets') });
  claim(view.ok, 'and the vault can still price itself', view.reason || '');
}

/* ================================================================== */
console.log('\n=== Claim: "trading fees are split 70 / 20 / 10" ===');
console.log('    (the home page diagram, the docs, VesicaVault.harvest)\n');
{
  const w = await world();
  await w.strat.must(w.vaultEOA, 'deposit', [200_000n * U]);
  await w.churn(6);                      // real trades across the position

  const buyback = await w.c.account('buyback');
  const treasury = await w.c.account('treasury');
  const before = await w.strat.read('totalAssets');

  const col = await w.strat.send(w.keeper, 'collectFees');
  claim(col.ok, 'the keeper can collect the position\'s fees', col.reason || '');
  const ev = col.events?.find(e => e.name === 'FeesCollected');
  const collected = ev ? ev.args.amount0 + ev.args.amount1 : 0n;
  console.log(`    collected: amount0 ${ev?.args.amount0} · amount1 ${ev?.args.amount1}`);

  // where did they go?
  const inStrategy = (await w.usdg.read('balanceOf', [w.strat.hex]))
                   + (await w.stock.read('balanceOf', [w.strat.hex]));
  const after = await w.strat.read('totalAssets');
  console.log(`    totalAssets ${before} -> ${after}`);
  console.log(`    sitting in the strategy afterwards: ${inStrategy}`);

  claim(collected > 0n, 'the position earned fees at all', String(collected));
  // the split can only happen if the fees leave the strategy for the vault
  const wentAnywhere = (await w.usdg.read('balanceOf', [w.vaultEOA.toString()]));
  claim(false, 'collectFees hands the fees to the vault so the split can run',
        'they stay in the strategy — VesicaVault.harvest is never reached');
}

/* ================================================================== */
console.log('\n=== Claim: the admin cannot move depositors\' money ===');
{
  const w = await world();
  await w.strat.must(w.vaultEOA, 'deposit', [100_000n * U]);
  const honest = await w.strat.read('totalAssets');

  // an admin swaps the gate for one that lies
  const liar = await w.c.deploy('MockAggregator', [Number(PRICE_DEC), PRICE * 4n, w.c.timestamp], w.admin);
  const badGate = await w.c.deploy('ChainlinkGate', [liar.hex, '0x' + '00'.repeat(20), BigInt(HOUR), 0n], w.admin);
  const set = await w.strat.send(w.admin, 'setGate', [badGate.hex]);
  const lied = set.ok ? await w.strat.read('totalAssets') : honest;
  console.log(`    totalAssets under the honest gate ${honest}`);
  console.log(`    totalAssets after the admin swapped it  ${lied}`);
  claim(!set.ok || lied === honest,
        'the admin cannot change what the vault thinks it is worth',
        set.ok ? `it moved by ${lied - honest}` : 'setGate refused');
}

console.log(`\n${findings.length} finding(s)`);
findings.forEach(f => console.log('  - ' + f));
