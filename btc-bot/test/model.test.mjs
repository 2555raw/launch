import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normCdf, probPointAbove, probTwapAbove, feePerShare, planBuy, sigmaFromCloses } from '../src/model.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('normCdf matches known values', () => {
  close(normCdf(0), 0.5);
  close(normCdf(1), 0.841345, 1e-5);
  close(normCdf(-1.96), 0.024998, 1e-5);
  close(normCdf(3) + normCdf(-3), 1);
});

test('point probability is 50% at the money and moves with price', () => {
  const sigma = 5e-5;
  close(probPointAbove({ S: 80000, K: 80000, sigma, tau: 300 }), 0.5);
  assert.ok(probPointAbove({ S: 80100, K: 80000, sigma, tau: 300 }) > 0.6);
  assert.ok(probPointAbove({ S: 79900, K: 80000, sigma, tau: 300 }) < 0.4);
  assert.equal(probPointAbove({ S: 80001, K: 80000, sigma, tau: 0 }), 1);
});

test('TWAP before its window behaves like a point with less variance', () => {
  const args = { S: 80050, K: 80000, sigma: 5e-5, now: 0, end: 600_000, L: 60 };
  const twap = probTwapAbove(args);
  const point = probPointAbove({ S: 80050, K: 80000, sigma: 5e-5, tau: 600 });
  assert.ok(twap > point, 'averaging removes variance, so the favourite is more likely');
  close(probTwapAbove({ ...args, S: 80000 }), 0.5);
});

test('TWAP inside its window leans on what is already averaged', () => {
  const base = { sigma: 5e-5, end: 60_000, L: 60, K: 80000 };
  // 50s of the 60s window averaged at 80040; spot has dropped back to the strike.
  const p = probTwapAbove({ ...base, S: 80000, now: 50_000, realizedAvg: 80040 });
  assert.ok(p > 0.95, `got ${p}`);
  // Continuity at the window edge.
  const outside = probTwapAbove({ ...base, S: 80020, now: 0 });
  const edge = probTwapAbove({ ...base, S: 80020, now: 1, realizedAvg: 80020 });
  close(outside, edge, 1e-3);
});

test('fee peaks at 50 cents and vanishes at the edges', () => {
  const sch = { rate: 0.07, exponent: 1 };
  close(feePerShare(0.5, sch), 0.0175);
  assert.ok(feePerShare(0.9, sch) < feePerShare(0.5, sch));
  assert.equal(feePerShare(0.5, null), 0);
});

test('planBuy stops at the first level without enough edge and respects budget', () => {
  const fee = () => 0.01;
  const asks = [[0.50, 10], [0.55, 10], [0.62, 100]];
  const plan = planBuy({ asks, prob: 0.65, budget: 1000, minEdge: 0.04, fee });
  assert.equal(plan.shares, 20); // 0.62 leaves only 2c of edge
  close(plan.cost, 10.5);
  close(plan.expectedProfit, 10 * 0.14 + 10 * 0.09);

  const small = planBuy({ asks, prob: 0.65, budget: 3.06, minEdge: 0.04, fee });
  assert.equal(small.shares, 6);
  assert.equal(planBuy({ asks, prob: 0.65, budget: 1, minEdge: 0.04, fee, minShares: 5 }), null);
  assert.equal(planBuy({ asks, prob: 0.5, budget: 100, minEdge: 0.04, fee }), null);
});

test('sigmaFromCloses recovers a constant-return series as zero vol', () => {
  close(sigmaFromCloses([100, 101, 102.01, 103.0301], 60), 0, 1e-9);
  assert.equal(sigmaFromCloses([100], 60), null);
});
