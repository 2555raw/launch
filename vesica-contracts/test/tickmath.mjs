/* The port of TickMath, checked against arithmetic that shares nothing with it.

   test/fixtures/ticks.json holds sqrt(1.0001^tick) * 2^96 computed in Python
   at 140 significant digits. Uniswap reaches the same number by shifting a
   table of magic constants. If the `unchecked` port had gone wrong, the two
   would not diverge by an ulp — they would diverge by miles. */

import { Chain, Contract } from './chain.mjs';
import { originalArtifact, originalCompiler } from './original/compile076.mjs';
import { hexToBytes } from '@ethereumjs/util';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(resolve(HERE, 'fixtures/ticks.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, label, note = '') => {
  if (c) { pass++; if (note) console.log(`  ok   ${label}   ${note}`); else console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}   ${note}`); }
};

const c = await Chain.create();
const admin = await c.account('admin');
const tm = await c.deploy('TickMathHarness', [], admin);

console.log('=== the constants are Uniswap\'s ===');
const [minTick, maxTick, minRatio, maxRatio] = await tm.read('bounds');
ok(minTick === -887272n, 'MIN_TICK', String(minTick));
ok(maxTick === 887272n, 'MAX_TICK', String(maxTick));
ok(minRatio === 4295128739n, 'MIN_SQRT_RATIO', String(minRatio));
ok(maxRatio === 1461446703485210103287273052203988822378723970342n, 'MAX_SQRT_RATIO', String(maxRatio));

console.log(`\n=== tick -> sqrtPrice, against ${FIXTURE.length} independently computed values ===`);
let worstAbs = 0n, worstRel = 0, worstAt = null;
for (const [tick, expectedStr] of FIXTURE) {
  const expected = BigInt(expectedStr);
  const got = await tm.read('getSqrtRatioAtTick', [tick]);
  const diff = got > expected ? got - expected : expected - got;
  // relative error, since the value spans 2^-128 to 2^128
  const rel = expected === 0n ? 0 : Number(diff * 10n ** 18n / expected) / 1e18;
  if (rel > worstRel) { worstRel = rel; worstAbs = diff; worstAt = tick; }
}
ok(worstAbs <= 1n, 'every tick lands on the independently computed value, to the wei',
   `worst gap ${worstAbs} wei (relative ${worstRel.toExponential(2)}) at tick ${worstAt}`);

console.log('\n=== sqrtPrice -> tick, the inverse ===');
let roundTrips = 0, roundTripFails = 0;
for (const [tick] of FIXTURE) {
  if (tick === 887272) continue;               // getTickAtSqrtRatio excludes MAX_SQRT_RATIO by design
  const sqrtP = await tm.read('getSqrtRatioAtTick', [tick]);
  const back = await tm.read('getTickAtSqrtRatio', [sqrtP]);
  roundTrips++;
  if (back !== BigInt(tick)) { roundTripFails++; if (roundTripFails < 4) console.log(`      ${tick} -> ${sqrtP} -> ${back}`); }
}
ok(roundTripFails === 0, `${roundTrips} ticks survive the round trip exactly`);

console.log(`\n=== against Uniswap's own build (${originalCompiler}) ===`);
{
  const res = await c.vm.evm.runCall({
    caller: admin, origin: admin, gasLimit: 30000000n,
    data: hexToBytes(originalArtifact.bytecode), block: c.block,
  });
  if (res.execResult.exceptionError) throw new Error('could not deploy the original');
  const orig = new Contract(c, res.createdAddress, originalArtifact.abi, 'TickMathOriginal');

  /* Matching the Python fixture proves the maths. Matching Uniswap's own
     bytecode proves the transcription — that the `unchecked` wrapping changed
     nothing, and that not one of the sixty magic constants moved. */
  let mismatches = 0, compared = 0;
  for (const [tick] of FIXTURE) {
    const a = await tm.read('getSqrtRatioAtTick', [tick]);
    const b = await orig.read('getSqrtRatioAtTick', [tick]);
    compared++;
    if (a !== b) { mismatches++; if (mismatches < 4) console.log(`      tick ${tick}: port ${a} vs original ${b}`); }
  }
  ok(mismatches === 0, `${compared} ticks give byte-identical answers to Uniswap's build`);

  let invMismatch = 0, invCompared = 0;
  for (const [tick] of FIXTURE) {
    if (tick === 887272) continue;
    const sqrtP = await tm.read('getSqrtRatioAtTick', [tick]);
    const a = await tm.read('getTickAtSqrtRatio', [sqrtP]);
    const b = await orig.read('getTickAtSqrtRatio', [sqrtP]);
    invCompared++;
    if (a !== b) invMismatch++;
  }
  ok(invMismatch === 0, `and ${invCompared} inverses do too`);
}

console.log('\n=== the range is enforced ===');
for (const [label, tick] of [['below MIN_TICK', -887273], ['above MAX_TICK', 887273]]) {
  const r = await c.call({ to: tm.address, from: admin, iface: tm.iface, isStatic: true,
                           data: tm.iface.encodeFunctionData('getSqrtRatioAtTick', [tick]) });
  ok(!r.ok, `a tick ${label} reverts`);
}
for (const [label, ratio] of [['below MIN_SQRT_RATIO', 4295128738n], ['at MAX_SQRT_RATIO', maxRatio]]) {
  const r = await c.call({ to: tm.address, from: admin, iface: tm.iface, isStatic: true,
                           data: tm.iface.encodeFunctionData('getTickAtSqrtRatio', [ratio]) });
  ok(!r.ok, `a ratio ${label} reverts`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
