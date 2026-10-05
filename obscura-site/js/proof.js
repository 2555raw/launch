// Proof of funds: tie a bond to a real wallet balance.
//
// The holder's wallet signs a plain-text message that names the bond's
// commitment, the address, the chain, the block and the amount being proven.
// A verifier recovers the signer from the signature and asks a public node
// whether that address held at least that amount at that block.
//
// What the verifier learns: one address and that it held at least the amount.
// Nothing about the holder's other addresses or bonds.

export const CHAINS = {
  1: { key: "ethereum", name: "Ethereum", symbol: "ETH", decimals: 18, rpc: "https://ethereum-rpc.publicnode.com" },
  8453: { key: "base", name: "Base", symbol: "ETH", decimals: 18, rpc: "https://base-rpc.publicnode.com" },
  42161: { key: "arbitrum", name: "Arbitrum", symbol: "ETH", decimals: 18, rpc: "https://arbitrum-one-rpc.publicnode.com" },
  10: { key: "optimism", name: "Optimism", symbol: "ETH", decimals: 18, rpc: "https://optimism-rpc.publicnode.com" },
  137: { key: "polygon", name: "Polygon", symbol: "POL", decimals: 18, rpc: "https://polygon-bor-rpc.publicnode.com" },
  56: { key: "bnb", name: "BNB Chain", symbol: "BNB", decimals: 18, rpc: "https://bsc-rpc.publicnode.com" },
  11155111: { key: "sepolia", name: "Sepolia testnet", symbol: "ETH", decimals: 18, rpc: "https://ethereum-sepolia-rpc.publicnode.com" },
};

// ---------- amounts as exact integers ----------
export function formatUnits(wei, decimals = 18, maxFraction = 6) {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  return (neg ? "-" : "") + whole.toString() + (frac ? "." + frac : "");
}

export function parseUnits(text, decimals = 18) {
  const t = String(text).trim();
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error("Amount must be a positive number");
  const [w, f = ""] = t.split(".");
  if (f.length > decimals) throw new Error(`At most ${decimals} decimals`);
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals));
}

// Round a balance down so the proven amount never exceeds what is held.
export function floorAmount(wei, decimals = 18, places = 4) {
  return formatUnits(wei - (wei % 10n ** BigInt(decimals - places)), decimals, places);
}

// ---------- the signed statement ----------
export function fundsMessage({ commitment, address, chainId, amount, symbol, block, expires }) {
  const chain = CHAINS[chainId]?.name || `chain ${chainId}`;
  const lines = [
    "Obscura proof of funds",
    "",
    `I control ${address.toLowerCase()}`,
    `and it held at least ${amount} ${symbol} on ${chain}`,
    `at block ${block}.`,
    "",
    `Bond: 0x${commitment}`,
    `Chain id: ${chainId}`,
  ];
  if (expires) lines.push(`Valid until: ${new Date(expires * 1000).toISOString()}`);
  return lines.join("\n");
}

const toHexUtf8 = (s) => "0x" + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("");

// ---------- holder side, through the connected wallet ----------
export async function readBalance(provider, address) {
  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  const block = Number(await provider.request({ method: "eth_blockNumber" }));
  const wei = BigInt(await provider.request({ method: "eth_getBalance", params: [address, "0x" + block.toString(16)] }));
  const chain = CHAINS[chainId] || { key: `chain-${chainId}`, name: `Chain ${chainId}`, symbol: "ETH", decimals: 18 };
  return { chainId, block, wei, chain };
}

export async function signFunds(provider, { receipt, address, chainId, block }) {
  const message = fundsMessage({ commitment: receipt.commitment, address, chainId, amount: receipt.asset.amount, symbol: receipt.asset.symbol, block, expires: receipt.asset.expires });
  const signature = await provider.request({ method: "personal_sign", params: [toHexUtf8(message), address] });
  return { type: "funds-v1", address: address.toLowerCase(), chainId, block, signature };
}

// ---------- verifier side ----------
async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || "RPC error");
  return body.result;
}

// Returns each check separately so the page can say exactly what passed.
export async function verifyFunds(receipt) {
  const p = receipt.proof;
  const out = { signed: false, signer: null, onchain: "unchecked", heldAt: null, detail: "" };
  if (!p || p.type !== "funds-v1") return out;

  const message = fundsMessage({ commitment: receipt.commitment, address: p.address, chainId: p.chainId, amount: receipt.asset.amount, symbol: receipt.asset.symbol, block: p.block, expires: receipt.asset.expires });
  try {
    const { verifyMessage } = await import("../assets/vendor/ethers.min.js");
    out.signer = verifyMessage(message, p.signature).toLowerCase();
    out.signed = out.signer === p.address.toLowerCase();
  } catch {
    out.signed = false;
  }
  if (!out.signed) return out;

  const chain = CHAINS[p.chainId];
  if (!chain) { out.detail = "This chain is not supported for balance checks."; return out; }
  let need;
  try { need = parseUnits(receipt.asset.amount, chain.decimals); } catch { out.onchain = "fail"; return out; }

  try {
    const wei = BigInt(await rpc(chain.rpc, "eth_getBalance", [p.address, "0x" + Number(p.block).toString(16)]));
    out.onchain = wei >= need ? "pass" : "fail";
    out.heldAt = "block";
  } catch {
    // Public nodes may not keep old blocks; fall back to the balance now.
    try {
      const wei = BigInt(await rpc(chain.rpc, "eth_getBalance", [p.address, "latest"]));
      out.onchain = wei >= need ? "pass" : "fail";
      out.heldAt = "latest";
    } catch {
      out.onchain = "unreachable";
      out.detail = "The blockchain could not be reached from this page.";
    }
  }
  return out;
}
