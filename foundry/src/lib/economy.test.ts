import { test } from "node:test";
import assert from "node:assert/strict";
import { burnedSupply, burnSummary, computeRates, generatorCost, maxAffordable, requirementMet } from "./economy";
import { GENERATOR_BY_ID } from "./content/generators";

test("generator cost grows 15% per unit", () => {
  const c = GENERATOR_BY_ID.cursor;
  assert.equal(generatorCost(c, 0), 15);
  assert.equal(generatorCost(c, 1), Math.ceil(15 * 1.15));
  assert.equal(maxAffordable(c, 0, 15), 1);
  assert.equal(maxAffordable(c, 0, 14), 0);
});

test("rates derive from owned generators and upgrades", () => {
  const r0 = computeRates([], []);
  assert.equal(r0.productionPerSec, 0);
  assert.equal(r0.clickPower, 1);
  const r1 = computeRates([{ id: "cursor", count: 10, level: 1 }], ["steady_hands", "pickaxes"]);
  assert.ok(Math.abs(r1.productionPerSec - 12.5) < 1e-9);
  assert.ok(Math.abs(r1.clickPower - 1.1) < 1e-9);
  const r2 = computeRates([{ id: "cursor", count: 10, level: 2 }], ["burn1"], { clickMultiplier: 2, cursorMultiplier: 2, generatorMultiplier: 1 });
  assert.ok(Math.abs(r2.productionPerSec - 30) < 1e-9);
  assert.equal(r2.burnMultiplier, 2);
  assert.ok(Math.abs(r2.burnPerSec - 30 * 0.5 * 2) < 1e-9);
  assert.equal(r2.clickPower, 2);
});

test("burn never exceeds max burn or initial supply", () => {
  const cfg = { initialSupply: 1_000_000_000, maxBurnPercent: 40, burnFormula: "linear", burnRate: 0.0001, burnHalfLife: 1 };
  assert.equal(burnedSupply(cfg, 0), 0);
  assert.equal(burnedSupply(cfg, 1_000_000), 100);
  assert.equal(burnedSupply(cfg, 1e30), 400_000_000);
  assert.equal(burnedSupply(cfg, -5), 0);
  assert.equal(burnedSupply(cfg, NaN), 0);
  assert.equal(burnedSupply({ ...cfg, maxBurnPercent: 500 }, 1e30), 1_000_000_000);
  const s = burnSummary(cfg, 1e30);
  assert.equal(s.finalSupply, 600_000_000);
  assert.equal(s.burnPercent, 40);
});

test("asymptotic formula approaches max burn", () => {
  const cfg = { initialSupply: 1e9, maxBurnPercent: 40, burnFormula: "asymptotic", burnRate: 0, burnHalfLife: 1000 };
  assert.ok(Math.abs(burnedSupply(cfg, 1000) - 2e8) < 1e-3);
  assert.ok(burnedSupply(cfg, 1e9) <= 4e8);
  assert.ok(burnedSupply(cfg, 1e9) > 3.99e8);
});

test("upgrade requirements", () => {
  const ctx = { totalClicks: 5, totalProduced: 0, burnPower: 0, owned: [{ id: "miner", count: 10, level: 1 }] };
  assert.equal(requirementMet({ type: "clicks", value: 10 }, ctx), false);
  assert.equal(requirementMet({ type: "generator_count", generatorId: "miner", value: 10 }, ctx), true);
});
