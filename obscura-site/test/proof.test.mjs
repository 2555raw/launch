// Proof of funds: the wallet signature and the balance check, with the network faked.
import test from "node:test";
import assert from "node:assert/strict";
import * as obx from "../js/obscura.js";
import { fundsMessage, verifyFunds, parseUnits, formatUnits, floorAmount } from "../js/proof.js";
import { Wallet } from "../assets/vendor/ethers.min.js";

async function provenReceipt(wallet, amount = "2.5") {
  const r = await obx.cloak({ chain: "base", symbol: "ETH", amount });
  const proof = { type: "funds-v1", address: wallet.address.toLowerCase(), chainId: 8453, block: 1000 };
  proof.signature = await wallet.signMessage(fundsMessage({ commitment: r.commitment, address: proof.address, chainId: 8453, amount, symbol: "ETH", block: 1000 }));
  return obx.decodeReceipt(obx.encodeReceipt({ ...r, proof }));
}

function fakeChain(balanceWei, { historical = true } = {}) {
  globalThis.fetch = async (_url, init) => {
    const { params } = JSON.parse(init.body);
    if (params[1] !== "latest" && !historical) return { json: async () => ({ error: { message: "missing trie node" } }) };
    return { json: async () => ({ result: "0x" + balanceWei.toString(16) }) };
  };
}

test("amounts round-trip exactly", () => {
  assert.equal(parseUnits("2.5"), 2500000000000000000n);
  assert.equal(formatUnits(2500000000000000000n), "2.5");
  assert.equal(floorAmount(3204199999999999999n), "3.2041");
});

test("a signed receipt survives encoding and verifies against the chain", async () => {
  const w = Wallet.createRandom();
  const r = await provenReceipt(w);
  assert.equal(await obx.verify(r), true);
  fakeChain(parseUnits("3"));
  const v = await verifyFunds(r);
  assert.equal(v.signed, true);
  assert.equal(v.onchain, "pass");
  assert.equal(v.heldAt, "block");
});

test("a balance below the claim fails", async () => {
  const r = await provenReceipt(Wallet.createRandom());
  fakeChain(parseUnits("1"));
  assert.equal((await verifyFunds(r)).onchain, "fail");
});

test("falls back to the current balance when old blocks are unavailable", async () => {
  const r = await provenReceipt(Wallet.createRandom());
  fakeChain(parseUnits("5"), { historical: false });
  const v = await verifyFunds(r);
  assert.equal(v.onchain, "pass");
  assert.equal(v.heldAt, "latest");
});

test("a signature from another wallet, or an edited amount, is rejected", async () => {
  const w = Wallet.createRandom();
  const r = await provenReceipt(w);
  const forged = { ...r, proof: { ...r.proof, address: Wallet.createRandom().address.toLowerCase() } };
  assert.equal((await verifyFunds(forged)).signed, false);
  const edited = { ...r, asset: { ...r.asset, amount: "250" } };
  assert.equal((await verifyFunds(edited)).signed, false);
});

test("the wallet signs the expiry too", async () => {
  const w = Wallet.createRandom();
  const expires = Math.floor(Date.now() / 1000) + 600;
  const r = await obx.cloak({ chain: "base", symbol: "ETH", amount: "1", expires });
  const proof = { type: "funds-v1", address: w.address.toLowerCase(), chainId: 8453, block: 7 };
  const msg = fundsMessage({ commitment: r.commitment, address: proof.address, chainId: 8453, amount: "1", symbol: "ETH", block: 7, expires });
  assert.match(msg, /Valid until: /);
  proof.signature = await w.signMessage(msg);
  fakeChain(parseUnits("2"));
  assert.equal((await verifyFunds({ ...r, proof })).signed, true);
  // A message signed without the expiry does not match a receipt that has one.
  const bare = await w.signMessage(fundsMessage({ commitment: r.commitment, address: proof.address, chainId: 8453, amount: "1", symbol: "ETH", block: 7 }));
  assert.equal((await verifyFunds({ ...r, proof: { ...proof, signature: bare } })).signed, false);
});
