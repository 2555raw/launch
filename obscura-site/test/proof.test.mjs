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

test("a USDC proof names the token and checks its balance", async () => {
  const w = Wallet.createRandom();
  const usdc = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC on Base, 6 decimals
  const r = await obx.cloak({ chain: "base", symbol: "USDC", amount: "1000" });
  const proof = { type: "funds-v1", address: w.address.toLowerCase(), chainId: 8453, block: 9, token: usdc };
  const msg = fundsMessage({ commitment: r.commitment, address: proof.address, chainId: 8453, amount: "1000", symbol: "USDC", block: 9, token: usdc });
  assert.match(msg, /Token contract: 0x833589/);
  proof.signature = await w.signMessage(msg);
  let calls = [];
  globalThis.fetch = async (_u, init) => {
    const body = JSON.parse(init.body); calls.push(body.method);
    return { json: async () => ({ result: "0x" + (1500n * 10n ** 6n).toString(16) }) }; // 1,500 USDC
  };
  const ok = await verifyFunds({ ...r, proof });
  assert.equal(ok.signed, true);
  assert.equal(ok.onchain, "pass");
  assert.deepEqual(calls, ["eth_call"], "token balance is read with balanceOf, not eth_getBalance");
  // Swapping the token contract breaks the signature.
  const swapped = { ...r, proof: { ...proof, token: "0xdac17f958d2ee523a2206206994597c13d831ec7" } };
  assert.equal((await verifyFunds(swapped)).signed, false);
});

test("a wallet cannot back a bond that names another asset or chain", async () => {
  const w = Wallet.createRandom();
  fakeChain(10n * 10n ** 18n); // 10 of the chain's coin
  for (const asset of [{ chain: "polygon", symbol: "BTC", amount: "10" }, { chain: "ethereum", symbol: "POL", amount: "10" }]) {
    const r = await obx.cloak(asset);
    const proof = { type: "funds-v1", address: w.address.toLowerCase(), chainId: 137, block: 5 };
    proof.signature = await w.signMessage(fundsMessage({ commitment: r.commitment, address: proof.address, chainId: 137, amount: "10", symbol: asset.symbol, block: 5 }));
    const out = await verifyFunds({ ...r, proof });
    assert.equal(out.signed, true);
    assert.equal(out.onchain, "fail", `${asset.symbol} on ${asset.chain} must not pass on POL`);
  }
});

test("a damaged proof is rejected instead of throwing", async () => {
  const r = await obx.cloak({ chain: "ethereum", symbol: "ETH", amount: "1" });
  for (const proof of [{ type: "funds-v1" }, { type: "funds-v1", address: 5, signature: "0x", chainId: 1, block: 1 }, { type: "funds-v1", address: "0x" + "a".repeat(40), signature: "0x", chainId: "1", block: 1 }]) {
    const out = await verifyFunds({ ...r, proof });
    assert.equal(out.signed, false);
  }
});

test("statements open with the new name, and proofs signed as Obscura still verify", async () => {
  const w = Wallet.createRandom();
  const amount = "2.5";
  const r = await obx.cloak({ chain: "base", symbol: "ETH", amount });
  const fields = { commitment: r.commitment, address: w.address.toLowerCase(), chainId: 8453, amount, symbol: "ETH", block: 1000 };
  assert.match(fundsMessage(fields), /^HeldAt proof of funds\n/);
  fakeChain(parseUnits("3"));
  for (const brand of ["HeldAt", "Obscura"]) {
    const proof = { type: "funds-v1", address: fields.address, chainId: 8453, block: 1000, signature: await w.signMessage(fundsMessage({ ...fields, brand })) };
    const v = await verifyFunds(obx.decodeReceipt(obx.encodeReceipt({ ...r, proof })));
    assert.equal(v.signed, true, brand);
    assert.equal(v.onchain, "pass", brand);
  }
  // any other name is not accepted
  const proof = { type: "funds-v1", address: fields.address, chainId: 8453, block: 1000, signature: await w.signMessage(fundsMessage({ ...fields, brand: "Other" })) };
  assert.equal((await verifyFunds(obx.decodeReceipt(obx.encodeReceipt({ ...r, proof })))).signed, false);
});
