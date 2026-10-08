// Proof of funds: tie a bond to a real wallet balance.
//
// The holder's wallet signs a plain-text message that names the bond's
// commitment, the address, the chain, the block and the amount being proven.
// A verifier recovers the signer from the signature and asks a public node
// whether that address held at least that amount at that block.
//
// What the verifier learns: one address and that it held at least the amount.
// Nothing about the holder's other addresses or bonds.

// Every chain lists several public nodes. The first ones keep full history,
// so a balance can be read at the exact block of the proof; the rest answer
// for the current block when those are busy. All were checked to allow
// requests from a browser page (CORS) without an API key.
export const CHAINS = {
  1: { key: "ethereum", name: "Ethereum", symbol: "ETH", decimals: 18, explorer: "https://etherscan.io",
    rpcs: ["https://eth.drpc.org", "https://eth.meowrpc.com", "https://rpc.mevblocker.io", "https://ethereum-rpc.publicnode.com"] },
  8453: { key: "base", name: "Base", symbol: "ETH", decimals: 18, explorer: "https://basescan.org",
    rpcs: ["https://mainnet.base.org", "https://base.meowrpc.com", "https://base.drpc.org", "https://base-rpc.publicnode.com"] },
  42161: { key: "arbitrum", name: "Arbitrum", symbol: "ETH", decimals: 18, explorer: "https://arbiscan.io",
    rpcs: ["https://arbitrum.meowrpc.com", "https://arbitrum-one.public.blastapi.io", "https://arbitrum-one-rpc.publicnode.com"] },
  10: { key: "optimism", name: "Optimism", symbol: "ETH", decimals: 18, explorer: "https://optimistic.etherscan.io",
    rpcs: ["https://mainnet.optimism.io", "https://optimism.drpc.org", "https://optimism-rpc.publicnode.com"] },
  137: { key: "polygon", name: "Polygon", symbol: "POL", decimals: 18, explorer: "https://polygonscan.com",
    rpcs: ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com"] },
  56: { key: "bnb", name: "BNB Chain", symbol: "BNB", decimals: 18, explorer: "https://bscscan.com",
    rpcs: ["https://bsc.meowrpc.com", "https://bsc-mainnet.public.blastapi.io", "https://bsc-rpc.publicnode.com"] },
  11155111: { key: "sepolia", name: "Sepolia testnet", symbol: "ETH", decimals: 18, explorer: "https://sepolia.etherscan.io", testnet: true,
    rpcs: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org"] },
};

// Wallet parameters for wallet_addEthereumChain, when a wallet does not know a chain yet.
export function addChainParams(chainId) {
  const c = CHAINS[chainId];
  return { chainId: "0x" + chainId.toString(16), chainName: c.name,
    nativeCurrency: { name: c.symbol, symbol: c.symbol, decimals: c.decimals },
    rpcUrls: c.rpcs.slice(0, 2), blockExplorerUrls: [c.explorer] };
}

// Ask the wallet to move to a chain, adding it first if the wallet does not know it.
export async function switchChain(provider, chainId) {
  const hex = "0x" + chainId.toString(16);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    if (err?.code !== 4902 && err?.data?.originalError?.code !== 4902) throw err;
    await provider.request({ method: "wallet_addEthereumChain", params: [addChainParams(chainId)] });
  }
}

export const explorerTx = (chainId, hash) => CHAINS[chainId] ? `${CHAINS[chainId].explorer}/tx/${hash}` : null;
export const explorerAddress = (chainId, address) => CHAINS[chainId] ? `${CHAINS[chainId].explorer}/address/${address}` : null;

// Tokens that can back a proof, per chain. Addresses and decimals were read
// from each contract (symbol(), decimals()) before being listed here.
export const TOKENS = {
  1: [
    { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
    { symbol: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
    { symbol: "DAI", address: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18 },
    { symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", decimals: 18 },
    { symbol: "WBTC", address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", decimals: 8 },
  ],
  8453: [
    { symbol: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    { symbol: "DAI", address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", decimals: 18 },
  ],
  42161: [
    { symbol: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6 },
    { symbol: "WETH", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", decimals: 18 },
    { symbol: "WBTC", address: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", decimals: 8 },
  ],
  10: [
    { symbol: "USDC", address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6 },
    { symbol: "USDT", address: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", decimals: 6 },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  ],
  137: [
    { symbol: "USDC", address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", decimals: 6 },
    { symbol: "USDT", address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6 },
    { symbol: "WETH", address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", decimals: 18 },
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
  ],
  11155111: [
    { symbol: "USDC", address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", decimals: 6 },
  ],
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
export function fundsMessage({ commitment, address, chainId, amount, symbol, block, expires, token }) {
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
  if (token) lines.push(`Token contract: ${token.toLowerCase()}`);
  if (expires) lines.push(`Valid until: ${new Date(expires * 1000).toISOString()}`);
  return lines.join("\n");
}

const toHexUtf8 = (s) => "0x" + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("");

// ---------- holder side, through the connected wallet ----------
const balanceOfData = (holder) => "0x70a08231" + holder.toLowerCase().replace(/^0x/, "").padStart(64, "0");

// Native coin plus every listed token, all read at the same block.
export async function readBalances(provider, address) {
  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  const block = Number(await provider.request({ method: "eth_blockNumber" }));
  const tag = "0x" + block.toString(16);
  const chain = CHAINS[chainId] || { key: `chain-${chainId}`, name: `Chain ${chainId}`, symbol: "ETH", decimals: 18 };
  const assets = [{ symbol: chain.symbol, decimals: chain.decimals, token: null,
    wei: BigInt(await provider.request({ method: "eth_getBalance", params: [address, tag] })) }];
  for (const t of TOKENS[chainId] || []) {
    try {
      const raw = await provider.request({ method: "eth_call", params: [{ to: t.address, data: balanceOfData(address) }, tag] });
      assets.push({ symbol: t.symbol, decimals: t.decimals, token: t.address, wei: BigInt(raw && raw !== "0x" ? raw : 0) });
    } catch { /* a token the node cannot answer for is simply not offered */ }
  }
  return { chainId, block, chain, assets };
}

// Kept for callers that only need the native balance.
export async function readBalance(provider, address) {
  const r = await readBalances(provider, address);
  return { chainId: r.chainId, block: r.block, wei: r.assets[0].wei, chain: r.chain };
}

// Ask the wallet to sign a statement, and check it signed with the account
// asked for: some wallets sign with whichever account is active.
export async function signText(provider, address, message) {
  const signature = await provider.request({ method: "personal_sign", params: [toHexUtf8(message), address] });
  if ((await recoverSigner(message, signature)) !== address.toLowerCase()) {
    throw new Error(`The wallet signed with a different account than ${address.slice(0, 6)}…${address.slice(-4)}. Switch back to it, read the balance again and retry.`);
  }
  return signature;
}

export async function recoverSigner(message, signature) {
  try {
    const { verifyMessage } = await import("../assets/vendor/ethers.min.js");
    return verifyMessage(message, signature).toLowerCase();
  } catch { return ""; }
}

export { balanceOfData, toHexUtf8 };

export async function signFunds(provider, { receipt, address, chainId, block, token = null }) {
  const message = fundsMessage({ commitment: receipt.commitment, address, chainId, amount: receipt.asset.amount, symbol: receipt.asset.symbol, block, expires: receipt.asset.expires, token });
  const signature = await signText(provider, address, message);
  const proof = { type: "funds-v1", address: address.toLowerCase(), chainId, block, signature };
  if (token) proof.token = token.toLowerCase();
  return proof;
}

// ---------- verifier side ----------
async function rpcOnce(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout?.(8000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (res.ok === false) throw new Error(`Node answered ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || "RPC error");
  return body.result;
}

// Try each public node of the chain in turn: one busy or pruned node is not
// a failed check. Takes a chain id or a single URL (kept for tests).
export async function rpc(chain, method, params) {
  const urls = typeof chain === "string" ? [chain] : (CHAINS[chain]?.rpcs || []);
  let last = new Error("No node for this chain");
  for (const url of urls) {
    try { return await rpcOnce(url, method, params); } catch (err) { last = err; }
  }
  throw last;
}

// Returns each check separately so the page can say exactly what passed.
export async function verifyFunds(receipt) {
  const p = receipt.proof;
  const out = { signed: false, signer: null, onchain: "unchecked", heldAt: null, detail: "", testnet: false };
  if (!p || p.type !== "funds-v1") return out;
  // The proof sits outside the seal, so anyone can edit it: check its shape first.
  const wellFormed = typeof p.address === "string" && /^0x[0-9a-fA-F]{40}$/.test(p.address)
    && typeof p.signature === "string" && Number.isSafeInteger(p.chainId) && Number.isSafeInteger(p.block) && p.block >= 0
    && (p.token === undefined || (typeof p.token === "string" && /^0x[0-9a-fA-F]{40}$/.test(p.token)));
  if (!wellFormed) { out.detail = "The wallet proof in this link is damaged."; return out; }

  const message = fundsMessage({ commitment: receipt.commitment, address: p.address, chainId: p.chainId, amount: receipt.asset.amount, symbol: receipt.asset.symbol, block: p.block, expires: receipt.asset.expires, token: p.token });
  out.signer = await recoverSigner(message, p.signature);
  out.signed = !!out.signer && out.signer === p.address.toLowerCase();
  if (!out.signed) return out;

  const chain = CHAINS[p.chainId];
  if (chain?.testnet) out.testnet = true;
  if (!chain) { out.onchain = "unsupported"; out.detail = "Balances on this chain cannot be checked from this page."; return out; }
  // The sealed asset must name what the balance is read for: the chain, and the
  // chain's own coin or the listed token at that contract. Otherwise 10 POL
  // could stand behind a bond that says 10 BTC.
  const listed = p.token ? (TOKENS[p.chainId] || []).find((t) => t.address === p.token.toLowerCase()) : null;
  const symbol = p.token ? listed?.symbol : chain.symbol;
  if (p.token && !listed) { out.onchain = "fail"; out.detail = "The token in this proof is not one this page can check."; return out; }
  if (receipt.asset.chain !== chain.key || receipt.asset.symbol !== symbol) {
    out.onchain = "fail";
    out.detail = `The wallet signed for ${symbol} on ${chain.name}, but the bond says ${receipt.asset.symbol} on ${receipt.asset.chain}.`;
    return out;
  }
  const decimals = p.token ? listed.decimals : chain.decimals;
  let need;
  try { need = parseUnits(receipt.asset.amount, decimals); } catch { out.onchain = "fail"; return out; }

  const balanceAt = async (tag) => p.token
    ? BigInt(await rpc(p.chainId, "eth_call", [{ to: p.token, data: balanceOfData(p.address) }, tag]))
    : BigInt(await rpc(p.chainId, "eth_getBalance", [p.address, tag]));
  try {
    const wei = await balanceAt("0x" + Number(p.block).toString(16));
    out.onchain = wei >= need ? "pass" : "fail";
    out.heldAt = "block";
  } catch {
    // Public nodes may not keep old blocks; fall back to the balance now.
    try {
      const wei = await balanceAt("latest");
      out.onchain = wei >= need ? "pass" : "fail";
      out.heldAt = "latest";
    } catch {
      out.onchain = "unreachable";
      out.detail = "The blockchain could not be reached from this page.";
    }
  }
  return out;
}
