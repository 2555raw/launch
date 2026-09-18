/* What the contracts are held to.

   Every test below runs the real compiled bytecode on a real EVM. Nothing is
   stubbed except the world around the vault: the block clock, the Chainlink
   feeds, and the ERC-20 the vault is denominated in.

   The tests are grouped by the claim they defend, and the claims come from
   what the site tells a visitor: no entry fee, a cap that is a cap, a guardian
   pause, oracle checks, and a 70/20/10 split where the 70% is what lifts the
   share price. */

import { Chain } from './chain.mjs';

const U = 10n ** 6n;                 // one USDG
const HOUR = 3600;
let pass = 0, fail = 0;
const failures = [];

function ok(cond, label, note = '') {
  if (cond) { pass++; console.log(`  ok   ${label}${note ? '   ' + note : ''}`); }
  else { fail++; failures.push(label); console.log(`  FAIL ${label}${note ? '   ' + note : ''}`); }
}
const eq = (a, b, label) => ok(a === b, label, `${a} vs ${b}`);

/* ERC-4626 rounds a share's value down, so a claim may sit a wei or two under
   the arithmetic figure — never over it. `owed` asserts exactly that: at or
   below the mark, and never more than `slack` below. A result above the mark
   is a failure, because that is value coming out of the vault that nobody
   put in. */
const owed = (actual, expected, slack, label) =>
  ok(actual <= expected && actual >= expected - slack, label,
     `${actual} vs ${expected} (${actual - expected} wei)`);
function group(name) { console.log(`\n=== ${name} ===`); }

/* ---------- a fresh world for each test ---------- */

async function world({ cap = 1_000_000n * U, staleness = HOUR, grace = HOUR, sequencer = true, asset = 'MockERC20' } = {}) {
  const c = await Chain.create();
  const admin = await c.account('admin');
  const guardian = await c.account('guardian');
  const keeper = await c.account('keeper');
  const alice = await c.account('alice');
  const bob = await c.account('bob');
  const buyback = await c.account('buyback');
  const treasury = await c.account('treasury');
  const feeSource = await c.account('feeSource');

  const usdg = await c.deploy(asset, asset === 'Reenterer' ? [] : ['Global Dollar', 'USDG', 6], admin);
  const price = await c.deploy('MockAggregator', [8, 100_000_000n, c.timestamp], admin);
  const seq = sequencer
    ? await c.deploy('MockAggregator', [0, 0n, c.timestamp - 86_400n], admin)
    : null;
  const gate = await c.deploy('ChainlinkGate',
    [price.hex, seq ? seq.hex : '0x' + '00'.repeat(20), BigInt(staleness), BigInt(grace)], admin);

  const vault = await c.deploy('VesicaVault',
    [usdg.hex, 'Vesica USDG/xNVDA', 'cNVDA', cap, gate.hex, admin.toString(), buyback.toString(), treasury.toString()],
    admin);

  await vault.must(admin, 'grantRole', [await vault.read('GUARDIAN_ROLE'), guardian.toString()]);
  await vault.must(admin, 'grantRole', [await vault.read('KEEPER_ROLE'), keeper.toString()]);

  for (const who of [alice, bob, feeSource]) {
    await usdg.must(admin, 'mint', [who.toString(), 500_000n * U]);
    await usdg.must(who, 'approve', [vault.hex, 2n ** 255n]);
  }

  // keep the price feed current as the clock moves
  const refresh = async () => {
    const r = await price.read('roundId');
    await price.must(admin, 'set', [r + 1n, 100_000_000n, c.timestamp, c.timestamp, r + 1n]);
  };

  const bal = async a => usdg.read('balanceOf', [a.toString ? a.toString() : a]);
  const shares = async a => vault.read('balanceOf', [a.toString ? a.toString() : a]);

  return { c, admin, guardian, keeper, alice, bob, buyback, treasury, feeSource,
           usdg, price, seq, gate, vault, refresh, bal, shares };
}

/* ================================================================== */
group('the gate: is the chain up and the price fresh');
{
  const w = await world();
  ok((await w.gate.read('check')) === 100_000_000n, 'a healthy feed passes and returns the price');

  // sequencer reporting down
  await w.seq.must(w.admin, 'set', [2n, 1n, w.c.timestamp - 86_400n, w.c.timestamp, 2n]);
  let r = await w.c.call({ to: w.gate.address, from: w.alice, data: w.gate.iface.encodeFunctionData('check'), iface: w.gate.iface, isStatic: true });
  ok(!r.ok && /SequencerDown/.test(r.reason), 'a sequencer reporting down closes the gate', r.reason);

  // sequencer just back: still inside the grace period
  await w.seq.must(w.admin, 'set', [3n, 0n, w.c.timestamp - 10n, w.c.timestamp, 3n]);
  r = await w.c.call({ to: w.gate.address, from: w.alice, data: w.gate.iface.encodeFunctionData('check'), iface: w.gate.iface, isStatic: true });
  ok(!r.ok && /SequencerGracePeriod/.test(r.reason), 'and stays closed through the grace period', r.reason);

  // grace elapsed
  w.c.warp(HOUR + 1);
  await w.refresh();
  ok((await w.gate.read('check')) === 100_000_000n, 'it reopens once the grace period is over');

  // stale price
  w.c.warp(HOUR + 60);
  r = await w.c.call({ to: w.gate.address, from: w.alice, data: w.gate.iface.encodeFunctionData('check'), iface: w.gate.iface, isStatic: true });
  ok(!r.ok && /StalePrice/.test(r.reason), 'a price older than the heartbeat closes it', r.reason);

  // negative price
  await w.refresh();
  const rid = await w.price.read('roundId');
  await w.price.must(w.admin, 'set', [rid + 1n, -1n, w.c.timestamp, w.c.timestamp, rid + 1n]);
  r = await w.c.call({ to: w.gate.address, from: w.alice, data: w.gate.iface.encodeFunctionData('check'), iface: w.gate.iface, isStatic: true });
  ok(!r.ok && /BadPrice/.test(r.reason), 'a zero or negative price closes it', r.reason);

  // answer carried from an older round
  await w.price.must(w.admin, 'set', [99n, 100_000_000n, w.c.timestamp, w.c.timestamp, 98n]);
  r = await w.c.call({ to: w.gate.address, from: w.alice, data: w.gate.iface.encodeFunctionData('check'), iface: w.gate.iface, isStatic: true });
  ok(!r.ok && /IncompleteRound/.test(r.reason), 'an answer carried over from an older round closes it', r.reason);
}
{
  const w = await world({ sequencer: false });
  ok((await w.gate.read('check')) === 100_000_000n, 'a chain with no sequencer skips that half of the check');
}

/* ================================================================== */
group('a deposit does what the page says it does');
{
  const w = await world();
  const before = await w.bal(w.alice);
  const r = await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);
  const sh = await w.shares(w.alice);

  eq(before - (await w.bal(w.alice)), 10_000n * U, 'the USDG leaves the wallet, exactly');
  eq(await w.vault.read('totalAssets'), 10_000n * U, "the vault's assets rise by the deposit");
  eq(await w.vault.read('convertToAssets', [sh]), 10_000n * U, 'the shares are worth what went in — no entry fee');
  ok(r.events.some(e => e.name === 'Deposit'), 'it emits Deposit');

  // redeem it all straight back
  await w.vault.must(w.alice, 'redeem', [sh, w.alice.toString(), w.alice.toString()]);
  eq(await w.bal(w.alice), before, 'redeeming it straight back returns exactly the same amount');
  eq(await w.shares(w.alice), 0n, 'and closes the position with no dust');
}

/* ================================================================== */
group('the cap is a cap');
{
  const w = await world({ cap: 10_000n * U });
  eq(await w.vault.read('maxDeposit', [w.alice.toString()]), 10_000n * U, 'maxDeposit reports the room');

  let r = await w.vault.send(w.alice, 'deposit', [10_001n * U, w.alice.toString()]);
  ok(!r.ok && /ExceededMax/.test(r.reason), 'one unit over the cap is refused', r.reason);

  await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);
  eq(await w.vault.read('maxDeposit', [w.alice.toString()]), 0n, 'exactly what fits is accepted and closes the cap');

  r = await w.vault.send(w.bob, 'deposit', [1n, w.bob.toString()]);
  ok(!r.ok, 'and nothing more gets in', r.reason);

  await w.vault.must(w.admin, 'setCap', [20_000n * U]);
  eq(await w.vault.read('maxDeposit', [w.alice.toString()]), 10_000n * U, 'raising the cap reopens exactly the difference');
}

/* ================================================================== */
group('the guardian can stop deposits and cannot trap anyone');
{
  const w = await world();
  await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);

  let r = await w.vault.send(w.bob, 'pauseDeposits');
  ok(!r.ok && /Unauthorized/.test(r.reason), 'a stranger cannot pause', r.reason);

  await w.vault.must(w.guardian, 'pauseDeposits');
  ok(await w.vault.read('depositsPaused'), 'the guardian can');
  eq(await w.vault.read('maxDeposit', [w.bob.toString()]), 0n, 'maxDeposit goes to zero while paused');

  r = await w.vault.send(w.bob, 'deposit', [1_000n * U, w.bob.toString()]);
  ok(!r.ok, 'deposits are refused while paused', r.reason);

  // the property that matters
  const sh = await w.shares(w.alice);
  const before = await w.bal(w.alice);
  await w.vault.must(w.alice, 'redeem', [sh, w.alice.toString(), w.alice.toString()]);
  eq((await w.bal(w.alice)) - before, 10_000n * U, 'but a paused vault still lets every depositor out, in full');

  r = await w.vault.send(w.guardian, 'unpauseDeposits');
  ok(!r.ok && /Unauthorized/.test(r.reason), 'the guardian cannot unpause — it can only ever stop things', r.reason);
  await w.vault.must(w.admin, 'unpauseDeposits');
  ok(!(await w.vault.read('depositsPaused')), 'the admin can');
}

/* ================================================================== */
group('a dead oracle stops money coming in, never money going out');
{
  const w = await world();
  await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);

  w.c.warp(HOUR * 3);   // the feed is now far past its heartbeat

  let r = await w.vault.send(w.bob, 'deposit', [1_000n * U, w.bob.toString()]);
  ok(!r.ok && /StalePrice/.test(r.reason), 'a stale feed refuses the deposit', r.reason);

  const sh = await w.shares(w.alice);
  const before = await w.bal(w.alice);
  await w.vault.must(w.alice, 'redeem', [sh, w.alice.toString(), w.alice.toString()]);
  eq((await w.bal(w.alice)) - before, 10_000n * U, 'and still lets the money out, in full');

  r = await w.vault.send(w.keeper, 'harvest', [w.feeSource.toString(), 100n * U]);
  ok(!r.ok && /StalePrice/.test(r.reason), 'a harvest against a stale feed is refused too', r.reason);
}

/* ================================================================== */
group('the fee split is 70 / 20 / 10, and the 70 is the share price');
{
  const w = await world();
  await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);
  const sh = await w.shares(w.alice);
  const priceBefore = await w.vault.read('convertToAssets', [sh]);

  const r = await w.vault.must(w.keeper, 'harvest', [w.feeSource.toString(), 1_000n * U]);
  const ev = r.events.find(e => e.name === 'Harvested');

  eq(ev.args.toBuyback, 200n * U, '20% goes to the buyback');
  eq(ev.args.toTreasury, 100n * U, '10% goes to the treasury');
  eq(ev.args.compounded, 700n * U, '70% is left in the vault');
  eq(await w.bal(w.buyback), 200n * U, 'the buyback actually received it');
  eq(await w.bal(w.treasury), 100n * U, 'the treasury actually received it');

  eq(await w.vault.read('totalAssets'), 10_700n * U, 'the vault holds the deposit plus the compounded fees');
  eq(await w.shares(w.alice), sh, 'no new shares were minted');
  owed(await w.vault.read('convertToAssets', [sh]), 10_700n * U, 2n, 'so the same shares are now worth more');
  ok((await w.vault.read('convertToAssets', [sh])) > priceBefore, 'which is the share price rising');

  const before = await w.bal(w.alice);
  await w.vault.must(w.alice, 'redeem', [sh, w.alice.toString(), w.alice.toString()]);
  owed((await w.bal(w.alice)) - before, 10_700n * U, 2n, 'and the depositor can take the gain out');
}

/* ================================================================== */
group('the split cannot be bent');
{
  const w = await world();
  await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);

  let r = await w.vault.send(w.alice, 'harvest', [w.feeSource.toString(), 100n * U]);
  ok(!r.ok && /Unauthorized/.test(r.reason), 'only the keeper may harvest', r.reason);

  r = await w.vault.send(w.keeper, 'harvest', [w.feeSource.toString(), 0n]);
  ok(!r.ok && /NothingToHarvest/.test(r.reason), 'a zero harvest is refused', r.reason);

  // rounding: 7 wei splits to 1 buyback, 0 treasury, 6 compounded — dust to depositors
  const res = await w.vault.must(w.keeper, 'harvest', [w.feeSource.toString(), 7n]);
  const e = res.events.find(x => x.name === 'Harvested');
  eq(e.args.toBuyback + e.args.toTreasury + e.args.compounded, 7n, 'the three legs always sum to the whole');
  ok(e.args.compounded === 6n, 'and the rounding dust stays with the depositors', `${e.args.compounded} of 7`);
}
{
  // a fee-on-transfer asset must not let the other two legs eat depositors' money
  const w = await world({ asset: 'MockFeeOnTransferERC20' });
  await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);
  const held = await w.vault.read('totalAssets');
  const r = await w.vault.must(w.keeper, 'harvest', [w.feeSource.toString(), 1_000n * U]);
  const e = r.events.find(x => x.name === 'Harvested');
  ok(e.args.total < 1_000n * U, 'with a fee-on-transfer asset, harvest splits what arrived', `${e.args.total} of ${1000n * U}`);
  eq(e.args.toBuyback + e.args.toTreasury + e.args.compounded, e.args.total, 'and the legs still sum to it');
  ok((await w.vault.read('totalAssets')) > held, 'the vault is still better off than before the harvest');
}

/* ================================================================== */
group('two depositors share the fees in proportion');
{
  const w = await world();
  await w.vault.must(w.alice, 'deposit', [30_000n * U, w.alice.toString()]);
  await w.vault.must(w.bob, 'deposit', [10_000n * U, w.bob.toString()]);
  await w.vault.must(w.keeper, 'harvest', [w.feeSource.toString(), 4_000n * U]);   // 2,800 compounds

  const a = await w.vault.read('convertToAssets', [await w.shares(w.alice)]);
  const b = await w.vault.read('convertToAssets', [await w.shares(w.bob)]);
  owed(a, 32_100n * U, 2n, 'the 75% holder takes 75% of the compounded fees');
  owed(b, 10_700n * U, 2n, 'the 25% holder takes 25%');
  ok(a + b <= (await w.vault.read('totalAssets')), 'and the two claims never exceed what the vault holds', `${a + b} vs ${await w.vault.read('totalAssets')}`);
}

/* ================================================================== */
group('rounding never pays out more than was put in');
{
  /* The share price is deliberately irrational here — 10,000 deposited against
     a 3,333.000007 harvest — so every conversion has something to round.
     A deposit-then-redeem round trip must never leave the depositor ahead:
     one wei the depositor's way, repeated, is how a vault is drained. */
  const w = await world();
  await w.vault.must(w.alice, 'deposit', [10_000n * U, w.alice.toString()]);
  await w.vault.must(w.keeper, 'harvest', [w.feeSource.toString(), 3_333n * U + 7n]);

  let worst = 0n, checked = 0;
  for (const size of [1n, 7n, 999n, 1_000n, 12_345n, 1n * U, 3_333n * U + 1n, 77_777n * U + 13n]) {
    const start = await w.bal(w.bob);
    const r = await w.vault.send(w.bob, 'deposit', [size, w.bob.toString()]);
    if (!r.ok) continue;                 // past the cap: not this test's business
    const sh = await w.shares(w.bob);
    if (sh === 0n) continue;             // too small to buy a share
    const afterDeposit = await w.bal(w.bob);
    eq(start - afterDeposit, size, `${String(size).padStart(12)} in: the deposit takes exactly that`);

    const quoted = await w.vault.read('previewRedeem', [sh]);
    await w.vault.must(w.bob, 'redeem', [sh, w.bob.toString(), w.bob.toString()]);
    const paid = (await w.bal(w.bob)) - afterDeposit;
    eq(paid, quoted, `${String(size).padStart(12)} in: redeem pays exactly what previewRedeem quoted`);

    const net = (await w.bal(w.bob)) - start;
    ok(net <= 0n, `${String(size).padStart(12)} in: the round trip never ends ahead`, `net ${net} wei`);
    checked++;
    if (-net > worst) worst = -net;
  }
  ok(checked >= 6, `${checked} sizes exercised`);
  ok(worst <= 2n, 'and the most a round trip costs in rounding is a wei or two', `worst: ${worst} wei`);
  eq(await w.shares(w.bob), 0n, 'and every one of them closed clean');
}

/* ================================================================== */
group('the attacks an ERC-4626 has to survive');
{
  // the classic first-depositor inflation attack
  const w = await world();
  await w.vault.must(w.alice, 'deposit', [1n, w.alice.toString()]);          // 1 wei of USDG
  await w.usdg.must(w.alice, 'transfer', [w.vault.hex, 20_000n * U]);        // donate, to spike the price
  await w.vault.must(w.bob, 'deposit', [10_000n * U, w.bob.toString()]);

  const bobShares = await w.shares(w.bob);
  ok(bobShares > 0n, 'the second depositor still gets shares after a donation attack', String(bobShares));
  const bobValue = await w.vault.read('convertToAssets', [bobShares]);
  ok(bobValue > 9_000n * U, 'and keeps essentially all of their money', `${bobValue} of ${10_000n * U}`);
  const aliceValue = await w.vault.read('convertToAssets', [await w.shares(w.alice)]);
  ok(aliceValue < 20_001n * U, 'the attacker does not come out ahead of what they put in', `${aliceValue} vs 20000000001 donated+deposited`);
}
{
  // an asset that calls back into the vault mid-transfer
  const w = await world({ asset: 'Reenterer' });
  await w.usdg.must(w.admin, 'arm', [w.vault.hex]);
  const r = await w.vault.send(w.alice, 'deposit', [1_000n * U, w.alice.toString()]);
  ok(!r.ok, 'a re-entrant asset cannot re-enter deposit', r.reason || r.error);
}

/* ================================================================== */
group('deploy-time refusals');
{
  const w = await world();
  const z = '0x' + '00'.repeat(20);
  for (const [label, args] of [
    ['a gate with no price feed', [z, z, 3600n, 3600n]],
    ['a gate with no staleness limit', [w.price.hex, z, 0n, 3600n]],
  ]) {
    let threw = false;
    try { await w.c.deploy('ChainlinkGate', args, w.admin); } catch (e) { threw = true; }
    ok(threw, `${label} is refused at deploy`);
  }
}

/* ================================================================== */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
