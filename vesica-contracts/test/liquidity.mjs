/* The liquidity maths, held against Uniswap's own build.

   These formulas decide how much of each token backs a position, which is how
   the vault values itself and how much it pays out on a withdrawal. A wrong
   answer here is not a rounding nuisance — it misprices every share. */

import { Chain, Contract } from './chain.mjs';
import { originals, originalCompiler } from './original/compile076.mjs';
import { hexToBytes } from '@ethereumjs/util';

let pass = 0, fail = 0;
const ok = (c, label, note = '') => {
  if (c) { pass++; console.log(`  ok   ${label}${note ? '   ' + note : ''}`); }
  else { fail++; console.log(`  FAIL ${label}${note ? '   ' + note : ''}`); }
};

const c = await Chain.create();
const admin = await c.account('admin');
const mine = await c.deploy('LiquidityHarness', [], admin);

const res = await c.vm.evm.runCall({
  caller: admin, origin: admin, gasLimit: 30_000_000n,
  data: hexToBytes(originals.LiquidityOriginal.bytecode), block: c.block,
});
if (res.execResult.exceptionError) throw new Error('could not deploy the original');
const theirs = new Contract(c, res.createdAddress, originals.LiquidityOriginal.abi, 'LiquidityOriginal');

const tm = await c.deploy('TickMathHarness', [], admin);
const at = t => tm.read('getSqrtRatioAtTick', [t]);

/* A spread of ranges: tight and wide, and prices below, inside and above each,
   because the function takes a different branch in all three. */
const RANGES = [[-60, 60], [-600, 600], [-6000, 6000], [-60000, 60000], [0, 120], [-120, 0], [-887220, 887220]];
const PRICE_AT = [-900000, -60001, -6001, -601, -61, -1, 0, 1, 61, 601, 6001, 60001, 900000];
const AMOUNTS = [1n, 1000n, 10n ** 6n, 10n ** 18n, 10n ** 24n, 12345678901234567890n];

console.log(`=== against Uniswap's own build (${originalCompiler}) ===`);

let cases = 0, diffs = 0, branches = { below: 0, inside: 0, above: 0 };
for (const [lo, hi] of RANGES) {
  const [sa, sb] = [await at(lo), await at(hi)];
  for (const pt of PRICE_AT) {
    const clamped = Math.max(-887272, Math.min(887272, pt));
    const sp = await at(clamped);
    if (sp <= sa) branches.below++; else if (sp < sb) branches.inside++; else branches.above++;

    for (const amt of AMOUNTS) {
      let a, b;
      try { a = await mine.read('getLiquidityForAmounts', [sp, sa, sb, amt, amt]); } catch (_) { a = 'revert'; }
      try { b = await theirs.read('getLiquidityForAmounts', [sp, sa, sb, amt, amt]); } catch (_) { b = 'revert'; }
      cases++;
      if (String(a) !== String(b)) { diffs++; if (diffs < 4) console.log(`      L(${lo},${hi})@${clamped} amt ${amt}: ${a} vs ${b}`); }

      if (a !== 'revert' && a > 0n) {
        let x, y;
        try { x = (await mine.read('getAmountsForLiquidity', [sp, sa, sb, a])).map(String).join('/'); } catch (_) { x = 'revert'; }
        try { y = (await theirs.read('getAmountsForLiquidity', [sp, sa, sb, a])).map(String).join('/'); } catch (_) { y = 'revert'; }
        cases++;
        if (x !== y) { diffs++; if (diffs < 4) console.log(`      A(${lo},${hi})@${clamped} L ${a}: ${x} vs ${y}`); }
      }
    }
  }
}

ok(diffs === 0, `${cases} comparisons, every one identical to Uniswap's`);
ok(branches.below > 0 && branches.inside > 0 && branches.above > 0,
   'all three price branches were exercised',
   `below ${branches.below}, inside ${branches.inside}, above ${branches.above}`);

console.log('\n=== a round trip through the two directions ===');
{
  const [sa, sb] = [await at(-6000), await at(6000)];
  const sp = await at(0);
  const amt = 10n ** 18n;
  const L = await mine.read('getLiquidityForAmounts', [sp, sa, sb, amt, amt]);
  const [a0, a1] = await mine.read('getAmountsForLiquidity', [sp, sa, sb, L]);
  ok(a0 <= amt && a1 <= amt, 'the amounts a position needs never exceed the amounts offered',
     `${a0} and ${a1} of ${amt}`);
  const L2 = await mine.read('getLiquidityForAmounts', [sp, sa, sb, a0, a1]);
  ok(L2 <= L, 'and feeding them back never conjures more liquidity', `${L2} vs ${L}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
