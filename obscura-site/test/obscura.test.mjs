// Run with: npm test (inside obscura-site/)
import test from "node:test";
import assert from "node:assert/strict";
import * as obx from "../js/obscura.js";

const asset = { chain: "Base", symbol: "eth", amount: "1.25", note: "" };

test("cloak produces a 32-byte commitment that verifies", async () => {
  const r = await obx.cloak(asset);
  assert.match(r.commitment, /^[0-9a-f]{64}$/);
  assert.equal(r.asset.symbol, "ETH");
  assert.equal(await obx.verify(r), true);
  assert.equal(await obx.verify(obx.encodeReceipt(r), r.commitment), true);
});

test("same asset, fresh salt and key, different commitment", async () => {
  const a = await obx.cloak(asset);
  const b = await obx.cloak(asset);
  assert.notEqual(a.commitment, b.commitment);
});

test("commit is deterministic for fixed inputs", async () => {
  const salt = new Uint8Array(16);
  const key = new Uint8Array(32);
  assert.equal(await obx.commit(asset, salt, key), await obx.commit({ ...asset, symbol: "ETH" }, salt, key));
});

test("any edit to the receipt fails verification", async () => {
  const r = await obx.cloak(asset);
  assert.equal(await obx.verify({ ...r, asset: { ...r.asset, amount: "2" } }), false);
  assert.equal(await obx.verify({ ...r, salt: "00".repeat(16) }), false);
  assert.equal(await obx.verify(r, "ab".repeat(32)), false);
  assert.equal(await obx.verify("obx1_garbage"), false);
});

test("seal and receive re-cloak under a new commitment", async () => {
  const r = await obx.cloak(asset);
  const pkg = await obx.seal(r, "correct horse battery");
  assert.ok(pkg.startsWith(obx.PACKAGE_PREFIX));
  const mine = await obx.receive(pkg, "correct horse battery");
  assert.equal(mine.prev, r.commitment);
  assert.notEqual(mine.commitment, r.commitment);
  assert.deepEqual(mine.asset, r.asset);
  assert.equal(await obx.verify(mine), true);
  assert.equal(await obx.verify(r), true, "sender's old receipt still verifies");
});

test("wrong passphrase is refused", async () => {
  const pkg = await obx.seal(await obx.cloak(asset), "correct horse battery");
  await assert.rejects(obx.receive(pkg, "wrong horse battery"), /Wrong passphrase/);
});

test("bad assets are refused", async () => {
  await assert.rejects(obx.cloak({ ...asset, amount: "-1" }), /positive/);
  await assert.rejects(obx.cloak({ ...asset, symbol: "" }), /symbol/);
});
