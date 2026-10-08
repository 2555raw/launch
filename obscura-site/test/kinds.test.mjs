// Dollar totals, NFTs and Solana proofs, with the network faked.
import test from "node:test";
import assert from "node:assert/strict";
import * as obx from "../js/obscura.js";
import { usdMessage, verifyUsd, nftMessage, verifyNft, usdValue, FEEDS } from "../js/kinds.js";
import { solMessage, verifySol, b58encode, b58decode, signSol } from "../js/solana.js";
import { Wallet } from "../assets/vendor/ethers.min.js";

const word = (v) => BigInt(v).toString(16).padStart(64, "0");
const roundData = (price8) => "0x" + word(1) + word(price8) + word(0) + word(0) + word(1);
const strData = (s) => "0x" + word(32) + word(s.length) + Buffer.from(s).toString("hex").padEnd(64, "0");

test("a dollar total adds each asset at its Chainlink price", async () => {
  const w = Wallet.createRandom();
  const r = await obx.cloak({ chain: "base", symbol: "USD", amount: "5000" });
  const proof = { type: "usd-v1", address: w.address.toLowerCase(), chainId: 8453, block: 100, priceBlock: 900, parts: ["ETH", "USDC"] };
  proof.signature = await w.signMessage(usdMessage({ commitment: r.commitment, ...proof, amount: "5000" }));
  // 1.5 ETH at $3,000 plus 600 USDC at $1 = $5,100
  globalThis.fetch = async (url, init) => {
    const { method, params } = JSON.parse(init.body);
    let result = "0x0";
    if (method === "eth_getBalance") result = "0x" + (15n * 10n ** 17n).toString(16);
    if (method === "eth_call" && params[0].data.startsWith("0x70a08231")) result = "0x" + (600n * 10n ** 6n).toString(16);
    if (method === "eth_call" && params[0].data === "0xfeaf968c") result = roundData(params[0].to === FEEDS.ETH[0] ? 3000n * 10n ** 8n : 10n ** 8n);
    return { json: async () => ({ result }) };
  };
  const ok = await verifyUsd({ ...r, proof });
  assert.equal(ok.signed, true);
  assert.equal(ok.onchain, "pass");
  assert.equal(ok.value, 5100n * 10n ** 8n);
  const more = await obx.cloak({ chain: "base", symbol: "USD", amount: "6000" });
  const p2 = { ...proof, signature: await w.signMessage(usdMessage({ commitment: more.commitment, ...proof, amount: "6000" })) };
  assert.equal((await verifyUsd({ ...more, proof: p2 })).onchain, "fail");
  assert.equal(usdValue(10n ** 18n, 18, 3000n * 10n ** 8n), 3000n * 10n ** 8n);
});

test("a dollar proof that counts an asset with no price, or names another chain, fails", async () => {
  const w = Wallet.createRandom();
  for (const [asset, parts] of [[{ chain: "base", symbol: "USD", amount: "1" }, ["SHIB"]], [{ chain: "ethereum", symbol: "USD", amount: "1" }, ["ETH"]]]) {
    const r = await obx.cloak(asset);
    const proof = { type: "usd-v1", address: w.address.toLowerCase(), chainId: 8453, block: 1, priceBlock: 1, parts };
    proof.signature = await w.signMessage(usdMessage({ commitment: r.commitment, ...proof, amount: "1" }));
    const out = await verifyUsd({ ...r, proof });
    assert.equal(out.signed, true);
    assert.equal(out.onchain, "fail");
  }
});

test("an NFT proof checks the owner of the token and the collection's symbol", async () => {
  const w = Wallet.createRandom();
  const contract = "0x" + "bc".repeat(20);
  const r = await obx.cloak({ chain: "ethereum", symbol: "BAYC", amount: "1" });
  const proof = { type: "nft-v1", address: w.address.toLowerCase(), chainId: 1, block: 50, contract, tokenId: "8817" };
  proof.signature = await w.signMessage(nftMessage({ commitment: r.commitment, ...proof, amount: "1" }));
  let owner = w.address.toLowerCase();
  globalThis.fetch = async (url, init) => {
    const { params } = JSON.parse(init.body);
    const d = params[0].data;
    const result = d === "0x95d89b41" ? strData("BAYC") : d.startsWith("0x6352211e") ? "0x" + owner.slice(2).padStart(64, "0") : "0x0";
    return { json: async () => ({ result }) };
  };
  assert.equal((await verifyNft({ ...r, proof })).onchain, "pass");
  owner = "0x" + "11".repeat(20);
  assert.equal((await verifyNft({ ...r, proof })).onchain, "fail");
  // a bond naming another collection is rejected before any balance is read
  const fake = await obx.cloak({ chain: "ethereum", symbol: "PUNK", amount: "1" });
  const p2 = { ...proof, signature: await w.signMessage(nftMessage({ commitment: fake.commitment, ...proof, amount: "1" })) };
  owner = w.address.toLowerCase();
  const out = await verifyNft({ ...fake, proof: p2 });
  assert.equal(out.onchain, "fail");
  assert.match(out.detail, /BAYC/);
});

test("base58 round-trips, including leading zero bytes", () => {
  const bytes = Uint8Array.from([0, 0, 1, 2, 250, 255]);
  assert.deepEqual(b58decode(b58encode(bytes)), bytes);
  assert.equal(b58encode(b58decode("11111111111111111111111111111111")).length, 32);
});

test("a Solana proof verifies an ed25519 signature and the SOL balance", async () => {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const address = b58encode(pub);
  const provider = { signMessage: async (bytes) => ({ signature: new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, bytes)) }) };
  const r = await obx.cloak({ chain: "solana", symbol: "SOL", amount: "12.5" });
  const proof = await signSol(provider, { receipt: r, address, slot: 4242 });
  assert.equal(proof.type, "sol-v1");
  let lamports = 13n * 10n ** 9n;
  globalThis.fetch = async () => ({ json: async () => ({ result: { context: { slot: 5000 }, value: Number(lamports) } }) });
  const ok = await verifySol({ ...r, proof });
  assert.equal(ok.signed, true);
  assert.equal(ok.onchain, "pass");
  assert.equal(ok.heldAt, "latest");
  lamports = 10n ** 9n;
  assert.equal((await verifySol({ ...r, proof })).onchain, "fail");
  // an edited amount breaks the signature
  const edited = { ...r, asset: { ...r.asset, amount: "99" }, proof };
  assert.equal((await verifySol(edited)).signed, false);
  assert.match(solMessage({ commitment: r.commitment, address, amount: "12.5", symbol: "SOL", slot: 4242 }), /on Solana/);
});
