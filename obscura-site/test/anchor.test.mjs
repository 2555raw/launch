// Anchors and the multi-node RPC, with the network faked.
import test from "node:test";
import assert from "node:assert/strict";
import * as obx from "../js/obscura.js";
import { rpc, CHAINS } from "../js/proof.js";
import { checkAnchor, normalizeAnchor, sendAnchor } from "../js/anchor.js";

const TX = "0x" + "ab".repeat(32);
const FROM = "0x" + "11".repeat(20);

// A fake chain: answers by method, and records which node was asked.
function fakeNodes(answer, { failFirst = false } = {}) {
  const asked = [];
  globalThis.fetch = async (url, init) => {
    const { method, params } = JSON.parse(init.body);
    asked.push(url);
    if (failFirst && asked.length === 1) return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, json: async () => ({ result: answer(method, params) }) };
  };
  return asked;
}

test("a busy node falls through to the next one", async () => {
  const asked = fakeNodes(() => "0x10", { failFirst: true });
  assert.equal(await rpc(1, "eth_blockNumber", []), "0x10");
  assert.deepEqual(asked, CHAINS[1].rpcs.slice(0, 2));
});

test("every mainnet chain has a history node and an explorer", () => {
  for (const [id, c] of Object.entries(CHAINS)) {
    assert.ok(c.rpcs.length >= 2, `${c.name} needs a fallback node`);
    assert.match(c.explorer, /^https:\/\//);
    assert.equal(!!c.testnet, Number(id) === 11155111);
  }
});

test("an anchor travels in the receipt and checks out on the chain", async () => {
  const r = await obx.cloak({ chain: "base", symbol: "ETH", amount: "1" });
  const link = obx.decodeReceipt(obx.encodeReceipt({ ...r, anchor: { tx: TX, chainId: 8453, block: 7 } }));
  assert.deepEqual(link.anchor, { chainId: 8453, tx: TX });
  fakeNodes((m) => ({
    eth_getTransactionByHash: { from: FROM, input: "0x" + r.commitment, blockNumber: "0x7" },
    eth_getTransactionReceipt: { status: "0x1", blockNumber: "0x7" },
    eth_getBlockByNumber: { timestamp: "0x6700ab00" },
  })[m]);
  const a = await checkAnchor(link);
  assert.equal(a.state, "pass");
  assert.equal(a.block, 7);
  assert.equal(a.from, FROM);
  assert.equal(a.time, 0x6700ab00);
});

test("an anchor carrying another seal code, or a made-up one, fails", async () => {
  const r = await obx.cloak({ chain: "base", symbol: "ETH", amount: "1" });
  fakeNodes((m) => (m === "eth_getTransactionByHash" ? { from: FROM, input: "0x" + "00".repeat(32), blockNumber: "0x7" } : null));
  assert.equal((await checkAnchor({ ...r, anchor: { tx: TX, chainId: 8453 } })).state, "fail");
  fakeNodes(() => null);
  assert.equal((await checkAnchor({ ...r, anchor: { tx: TX, chainId: 8453 } })).state, "fail");
  assert.equal((await checkAnchor({ ...r, anchor: { tx: "nope", chainId: 8453 } })).state, "fail");
  assert.equal((await checkAnchor({ ...r, anchor: { tx: TX, chainId: 999 } })).state, "fail");
});

test("old vault anchors (a bare hash) are read but not put in links", async () => {
  assert.deepEqual(normalizeAnchor(TX), { tx: TX, chainId: null });
  const r = await obx.cloak({ chain: "base", symbol: "ETH", amount: "1" });
  assert.equal(obx.decodeReceipt(obx.encodeReceipt({ ...r, anchor: TX })).anchor, undefined);
});

test("sending an anchor puts exactly the seal code in the data and waits for the block", async () => {
  const sent = [];
  let polls = 0;
  const provider = { request: async ({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_sendTransaction") { sent.push(params[0]); return TX; }
    if (method === "eth_getTransactionReceipt") return ++polls < 2 ? null : { status: "0x1", blockNumber: "0x99" };
  } };
  fakeNodes(() => null);
  const commitment = "cd".repeat(32);
  const a = await sendAnchor(provider, FROM, commitment, { timeoutMs: 20000 });
  assert.deepEqual(sent[0], { from: FROM, to: FROM, value: "0x0", data: "0x" + commitment });
  assert.deepEqual(a, { tx: TX, chainId: 8453, block: 0x99 });
});
