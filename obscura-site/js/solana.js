// Proof of funds on Solana: Phantom, Solflare or Backpack signs a plain-text
// statement with the wallet's ed25519 key, and the verifier checks the
// signature and reads the balance from a public Solana node.
//
// Solana nodes do not answer "what was the balance at slot N", so a Solana
// proof is always checked against the balance at the time it is opened, and
// the verify page says so.

export const SOL_RPC = ["https://solana-rpc.publicnode.com"];
export const SOL_TOKENS = [
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCt8BnEUw4h", decimals: 6 },
];
export const EXPLORER = "https://solscan.io";
// Kept in step with BRAND and BRANDS in proof.js; this file loads on its own.
const BRAND = "HeldAt";
const BRANDS = [BRAND, "Obscura"];

// ---------- base58 ----------
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}
export function b58decode(text) {
  let n = 0n;
  for (const c of String(text)) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Not base58");
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of String(text)) { if (c !== "1") break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}
export const isSolAddress = (a) => { try { return typeof a === "string" && b58decode(a).length === 32; } catch { return false; } };

// ---------- amounts ----------
const units = (text, decimals) => {
  const t = String(text).trim();
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error("Amount must be a positive number");
  const [w, f = ""] = t.split(".");
  if (f.length > decimals) throw new Error(`At most ${decimals} decimals`);
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals));
};

// ---------- node ----------
async function solRpc(method, params) {
  let last = new Error("No Solana node answered");
  for (const url of SOL_RPC) {
    try {
      const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout?.(8000), headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      if (res.ok === false) throw new Error(`Node answered ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(body.error.message || "RPC error");
      return body.result;
    } catch (err) { last = err; }
  }
  throw last;
}

// The wallet's standard ("associated") token account for a mint: a program
// address derived from the owner and the mint, found without any index.
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export async function associatedTokenAddress(owner, mint) {
  const ed = await import("../assets/vendor/noble-ed25519.mjs");
  const seeds = [b58decode(owner), b58decode(TOKEN_PROGRAM), b58decode(mint)];
  const tail = [...b58decode(ATA_PROGRAM), ...new TextEncoder().encode("ProgramDerivedAddress")];
  for (let bump = 255; bump >= 0; bump--) {
    const data = Uint8Array.from([...seeds.flatMap((x) => [...x]), bump, ...tail]);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    let onCurve = true;
    try { ed.ExtendedPoint.fromHex(hash); } catch { onCurve = false; }
    if (!onCurve) return b58encode(hash);
  }
  throw new Error("No token account address");
}

async function tokenBalance(owner, mint) {
  const ata = await associatedTokenAddress(owner, mint);
  const r = await solRpc("getAccountInfo", [ata, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const info = r?.value?.data?.parsed?.info;
  // No account yet means nothing held; an account must belong to this owner and mint.
  if (!info || info.mint !== mint || info.owner !== owner) return { slot: r?.context?.slot || 0, raw: 0n };
  return { slot: r.context.slot, raw: BigInt(info.tokenAmount?.amount || "0") };
}

export async function readSolBalances(address) {
  const bal = await solRpc("getBalance", [address, { commitment: "confirmed" }]);
  const assets = [{ symbol: "SOL", decimals: 9, token: null, wei: BigInt(bal.value) }];
  for (const t of SOL_TOKENS) {
    try { assets.push({ symbol: t.symbol, decimals: t.decimals, token: t.mint, wei: (await tokenBalance(address, t.mint)).raw }); } catch { /* not offered */ }
  }
  return { slot: bal.context.slot, assets };
}

// ---------- wallet ----------
export function solProvider() {
  const p = globalThis.phantom?.solana || globalThis.solflare || globalThis.backpack || globalThis.solana;
  return p && typeof p.signMessage === "function" ? p : null;
}

export async function connectSol() {
  const provider = solProvider();
  if (!provider) return null;
  const res = await provider.connect();
  const key = res?.publicKey || provider.publicKey;
  if (!key) throw new Error("The Solana wallet did not share an address");
  return { provider, address: key.toBase58 ? key.toBase58() : String(key) };
}

export function solMessage({ commitment, address, amount, symbol, slot, mint, expires, brand = BRAND }) {
  const lines = [
    `${brand} proof of funds`,
    "",
    `I control ${address}`,
    `and it held at least ${amount} ${symbol} on Solana`,
    `at slot ${slot}.`,
    "",
    `Bond: 0x${commitment}`,
    "Chain: solana",
  ];
  if (mint) lines.push(`Token mint: ${mint}`);
  if (expires) lines.push(`Valid until: ${new Date(expires * 1000).toISOString()}`);
  return lines.join("\n");
}

// ---------- ed25519 ----------
// The browser's own Ed25519 where it has one, a small audited library otherwise.
export async function ed25519Verify(publicKey, signature, message) {
  try {
    const key = await crypto.subtle.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, signature, message);
  } catch {
    try {
      const ed = await import("../assets/vendor/noble-ed25519.mjs");
      return await ed.verifyAsync(signature, message, publicKey);
    } catch { return false; }
  }
}

export async function signSol(provider, { receipt, address, slot, mint = null }) {
  const message = solMessage({ commitment: receipt.commitment, address, amount: receipt.asset.amount, symbol: receipt.asset.symbol, slot, mint, expires: receipt.asset.expires });
  const bytes = new TextEncoder().encode(message);
  const res = await provider.signMessage(bytes, "utf8");
  const sig = res?.signature || res;
  if (!(sig instanceof Uint8Array) || sig.length !== 64) throw new Error("The Solana wallet did not return a signature");
  if (!(await ed25519Verify(b58decode(address), sig, bytes))) throw new Error("The wallet signed with a different account. Switch back to it, read again and retry.");
  const proof = { type: "sol-v1", address, slot, signature: b58encode(sig) };
  if (mint) proof.mint = mint;
  return proof;
}

export async function verifySol(receipt) {
  const p = receipt.proof;
  const out = { signed: false, signer: null, onchain: "unchecked", heldAt: null, detail: "", testnet: false };
  const ok = p && p.type === "sol-v1" && isSolAddress(p.address) && typeof p.signature === "string"
    && Number.isSafeInteger(p.slot) && p.slot >= 0 && (p.mint === undefined || isSolAddress(p.mint));
  if (!ok) { out.detail = "The wallet proof in this link is damaged."; return out; }
  let sig;
  try { sig = b58decode(p.signature); } catch { return out; }
  for (const brand of BRANDS) {
    const message = solMessage({ commitment: receipt.commitment, address: p.address, amount: receipt.asset.amount, symbol: receipt.asset.symbol, slot: p.slot, mint: p.mint, expires: receipt.asset.expires, brand });
    out.signed = sig.length === 64 && await ed25519Verify(b58decode(p.address), sig, new TextEncoder().encode(message));
    if (out.signed) break;
  }
  if (!out.signed) return out;
  out.signer = p.address;

  const token = p.mint ? SOL_TOKENS.find((t) => t.mint === p.mint) : null;
  if (p.mint && !token) { out.onchain = "fail"; out.detail = "The token in this proof is not one this page can check."; return out; }
  const symbol = token ? token.symbol : "SOL";
  if (receipt.asset.chain !== "solana" || receipt.asset.symbol !== symbol) {
    out.onchain = "fail"; out.detail = `The wallet signed for ${symbol} on Solana, but the bond says ${receipt.asset.symbol} on ${receipt.asset.chain}.`; return out;
  }
  let need;
  try { need = units(receipt.asset.amount, token ? token.decimals : 9); } catch { out.onchain = "fail"; return out; }
  try {
    const held = token ? (await tokenBalance(p.address, token.mint)).raw : BigInt((await solRpc("getBalance", [p.address, { commitment: "confirmed" }])).value);
    out.onchain = held >= need ? "pass" : "fail";
    out.heldAt = "latest";
  } catch {
    out.onchain = "unreachable"; out.detail = "The Solana network could not be reached from this page.";
  }
  return out;
}
