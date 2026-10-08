// Anchoring: put a bond's seal code on a real chain, and check it later.
//
// The wallet sends a 0-value transaction to itself whose data is exactly the
// 32-byte seal code. That costs only the network fee, needs no contract, and
// leaves a public, timestamped record that the seal existed from that block
// on. The record names nothing: the seal code alone does not say what it seals.
import { CHAINS, rpc } from "./proof.js";

const HASH = /^0x[0-9a-fA-F]{64}$/;

// Older vault entries stored only the transaction hash.
export function normalizeAnchor(a) {
  if (!a) return null;
  if (typeof a === "string") return HASH.test(a) ? { tx: a.toLowerCase(), chainId: null } : null;
  if (typeof a === "object" && typeof a.tx === "string" && HASH.test(a.tx)) {
    return { tx: a.tx.toLowerCase(), chainId: Number.isSafeInteger(a.chainId) ? a.chainId : null, ...(Number.isSafeInteger(a.block) ? { block: a.block } : {}) };
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Send the anchor from the connected wallet and wait for it to be mined.
// onSent fires as soon as the wallet hands back the transaction hash.
export async function sendAnchor(provider, address, commitment, { onSent, timeoutMs = 180000 } = {}) {
  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  if (!CHAINS[chainId]) throw new Error("Switch the wallet to Ethereum, Base, Arbitrum, Optimism, Polygon or BNB Chain to anchor");
  const tx = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: address, to: address, value: "0x0", data: "0x" + commitment }],
  });
  const anchor = { tx: String(tx).toLowerCase(), chainId };
  onSent?.(anchor);
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    let receipt = null;
    try { receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [tx] }); } catch { /* ask a public node */ }
    if (!receipt) { try { receipt = await rpc(chainId, "eth_getTransactionReceipt", [tx]); } catch { /* not yet */ } }
    if (receipt?.blockNumber) {
      if (receipt.status && Number(receipt.status) !== 1) throw new Error("The anchor transaction failed on the chain");
      return { ...anchor, block: Number(receipt.blockNumber) };
    }
    await sleep(3000);
  }
  return anchor; // sent but not mined yet: the hash is kept and checked later
}

// For the verify page. Every field of the anchor came from the link, so
// nothing is trusted until the chain confirms it.
export async function checkAnchor(receipt) {
  const a = normalizeAnchor(receipt.anchor);
  const out = { state: "none", chainId: a?.chainId ?? null, tx: a?.tx ?? null, from: null, block: null, time: null, detail: "" };
  if (!receipt.anchor) return out;
  if (!a || !a.chainId || !CHAINS[a.chainId]) { out.state = "fail"; out.detail = "The anchor in this link is damaged or on a chain this page cannot read."; return out; }
  try {
    const tx = await rpc(a.chainId, "eth_getTransactionByHash", [a.tx]);
    if (!tx) { out.state = "fail"; out.detail = `No such transaction on ${CHAINS[a.chainId].name}.`; return out; }
    out.from = String(tx.from).toLowerCase();
    if (String(tx.input || tx.data || "").toLowerCase() !== "0x" + receipt.commitment.toLowerCase()) {
      out.state = "fail"; out.detail = "That transaction carries a different seal code."; return out;
    }
    if (!tx.blockNumber) { out.state = "pending"; out.detail = "The transaction is not in a block yet."; return out; }
    const rc = await rpc(a.chainId, "eth_getTransactionReceipt", [a.tx]);
    if (rc && rc.status && Number(rc.status) !== 1) { out.state = "fail"; out.detail = "That transaction failed on the chain."; return out; }
    out.block = Number(tx.blockNumber);
    const blk = await rpc(a.chainId, "eth_getBlockByNumber", [tx.blockNumber, false]);
    out.time = blk?.timestamp ? Number(blk.timestamp) : null;
    out.state = "pass";
  } catch {
    out.state = "unreachable";
    out.detail = "The blockchain could not be reached from this page.";
  }
  return out;
}
