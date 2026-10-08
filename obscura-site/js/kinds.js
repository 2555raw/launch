// Two more things a wallet can prove, on the same EVM chains as proof.js:
//
//   usd-v1  "this address held assets worth at least $X", priced by Chainlink
//   nft-v1  "this address held N NFTs of a collection", or "owned token #id"
//
// Both work like a balance proof: the wallet signs a plain-text statement that
// names the bond, the address, the chain and the block, and the verifier reads
// the chain at that block to check it.
import { CHAINS, TOKENS, rpc, parseUnits, signText, recoverAny, balanceOfData, BRAND } from "./proof.js";

// ---------- prices ----------
// Chainlink USD feeds on Ethereum mainnet, 8 decimals. Addresses were read
// from each feed's description() and from the feeds' ENS names (*.data.eth).
// One price list serves every chain: a dollar is a dollar wherever ETH sits.
const ETH_USD = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";
const BTC_USD = "0xf4030086522a5beea4988f8ca5b36dbc97bee88c";
const WBTC_BTC = "0xfdfd9c85ad200c506cf9e21f1fd8dd01932fbb23";
export const FEEDS = {
  ETH: [ETH_USD], WETH: [ETH_USD],
  WBTC: [BTC_USD, WBTC_BTC], // WBTC is priced as BTC times the WBTC/BTC rate
  USDC: ["0x8fffffd4afb6115b954bd326cbe7b4ba576818f6"],
  USDT: ["0x3e7d1eab13ad0104d2750b8863b489d65364e32d"],
  DAI: ["0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9"],
  POL: ["0x7bac85a8a13a4bcd8abb3eb7d6b4d632c5a57676"], // the MATIC / USD feed
  BNB: ["0x14e613ac84a31f709eadbdf89c6cc390fdc9540a"],
};
const E8 = 10n ** 8n;

// latestRoundData() at a block: the answer is the second word.
async function feedAnswer(feed, tag) {
  const raw = await rpc(1, "eth_call", [{ to: feed, data: "0xfeaf968c" }, tag]);
  if (!raw || raw.length < 130) throw new Error("No price from the feed");
  const answer = BigInt("0x" + raw.slice(66, 130));
  if (answer <= 0n || answer >= 2n ** 255n) throw new Error("The feed returned no usable price");
  return answer;
}

// USD price with 8 decimals, read at an Ethereum block.
export async function usdPrice(symbol, priceBlock) {
  const feeds = FEEDS[symbol];
  if (!feeds) throw new Error(`No price feed for ${symbol}`);
  const tag = "0x" + Number(priceBlock).toString(16);
  let price = E8;
  for (const f of feeds) price = (price * (await feedAnswer(f, tag))) / E8;
  return price;
}

// Dollar value with 8 decimals of a raw balance.
export const usdValue = (wei, decimals, price8) => (wei * price8) / 10n ** BigInt(decimals);

// Whole dollars, rounded down, for the amount field.
export const floorUsd = (value8) => (value8 / E8).toString();
export const formatUsd = (value8) => "$" + Number(value8 / E8).toLocaleString("en-US");

// What a chain can count toward a dollar total: its coin and listed tokens with a feed.
export function countable(chainId) {
  const chain = CHAINS[chainId];
  if (!chain || chain.testnet) return [];
  const list = [{ symbol: chain.symbol, decimals: chain.decimals, token: null }];
  for (const t of TOKENS[chainId] || []) list.push({ symbol: t.symbol, decimals: t.decimals, token: t.address });
  return list.filter((a) => FEEDS[a.symbol]);
}

// A block a few behind the head, so every public node already has it.
export async function recentPriceBlock() {
  return Number(await rpc(1, "eth_blockNumber", [])) - 3;
}

// Holder side: value the assets just read from the wallet.
export async function valueAssets(chainId, assets, priceBlock) {
  const allowed = new Set(countable(chainId).map((a) => a.symbol));
  let total = 0n;
  const parts = [];
  for (const a of assets) {
    if (!allowed.has(a.symbol) || a.wei <= 0n) continue;
    total += usdValue(a.wei, a.decimals, await usdPrice(a.symbol, priceBlock));
    parts.push(a.symbol);
  }
  return { total, parts, priceBlock };
}

export function usdMessage({ commitment, address, chainId, amount, block, priceBlock, parts, expires, brand = BRAND }) {
  const chain = CHAINS[chainId]?.name || `chain ${chainId}`;
  const lines = [
    `${brand} proof of funds`,
    "",
    `I control ${address.toLowerCase()}`,
    `and it held assets worth at least $${amount} on ${chain}`,
    `at block ${block}, counting ${parts.join(", ")},`,
    `at Chainlink prices on Ethereum block ${priceBlock}.`,
    "",
    `Bond: 0x${commitment}`,
    `Chain id: ${chainId}`,
  ];
  if (expires) lines.push(`Valid until: ${new Date(expires * 1000).toISOString()}`);
  return lines.join("\n");
}

export async function signUsd(provider, { receipt, address, chainId, block, priceBlock, parts }) {
  const message = usdMessage({ commitment: receipt.commitment, address, chainId, amount: receipt.asset.amount, block, priceBlock, parts, expires: receipt.asset.expires });
  const signature = await signText(provider, address, message);
  return { type: "usd-v1", address: address.toLowerCase(), chainId, block, priceBlock, parts: [...parts], signature };
}

const isAddr = (a) => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
const isBlock = (b) => Number.isSafeInteger(b) && b >= 0;

export async function verifyUsd(receipt) {
  const p = receipt.proof;
  const out = { signed: false, signer: null, onchain: "unchecked", heldAt: null, detail: "", testnet: false };
  const ok = p && p.type === "usd-v1" && isAddr(p.address) && typeof p.signature === "string"
    && Number.isSafeInteger(p.chainId) && isBlock(p.block) && isBlock(p.priceBlock)
    && Array.isArray(p.parts) && p.parts.length > 0 && p.parts.length <= 12 && p.parts.every((x) => typeof x === "string");
  if (!ok) { out.detail = "The wallet proof in this link is damaged."; return out; }

  const message = (brand) => usdMessage({ commitment: receipt.commitment, address: p.address, chainId: p.chainId, amount: receipt.asset.amount, block: p.block, priceBlock: p.priceBlock, parts: p.parts, expires: receipt.asset.expires, brand });
  out.signer = await recoverAny(message, p.signature, p.address);
  out.signed = !!out.signer && out.signer === p.address.toLowerCase();
  if (!out.signed) return out;

  const chain = CHAINS[p.chainId];
  if (!chain || chain.testnet) { out.onchain = "unsupported"; out.detail = "Dollar totals can only be checked on the listed mainnets."; return out; }
  if (receipt.asset.chain !== chain.key || receipt.asset.symbol !== "USD") {
    out.onchain = "fail"; out.detail = `The wallet signed a dollar total on ${chain.name}, but the bond says ${receipt.asset.symbol} on ${receipt.asset.chain}.`; return out;
  }
  const byName = new Map(countable(p.chainId).map((a) => [a.symbol, a]));
  if (new Set(p.parts).size !== p.parts.length || !p.parts.every((x) => byName.has(x))) {
    out.onchain = "fail"; out.detail = "The proof counts an asset this page cannot price."; return out;
  }
  let need;
  try { need = parseUnits(receipt.asset.amount, 8); } catch { out.onchain = "fail"; return out; }

  const balanceAt = (a, tag) => a.token
    ? rpc(p.chainId, "eth_call", [{ to: a.token, data: balanceOfData(p.address) }, tag]).then(BigInt)
    : rpc(p.chainId, "eth_getBalance", [p.address, tag]).then(BigInt);
  const totalAt = async (tag) => {
    let total = 0n;
    for (const name of p.parts) {
      const a = byName.get(name);
      total += usdValue(await balanceAt(a, tag), a.decimals, await usdPrice(name, p.priceBlock));
    }
    return total;
  };
  try {
    out.value = await totalAt("0x" + p.block.toString(16));
    out.heldAt = "block";
  } catch {
    try { out.value = await totalAt("latest"); out.heldAt = "latest"; }
    catch { out.onchain = "unreachable"; out.detail = "The blockchain or the price feeds could not be reached from this page."; return out; }
  }
  out.onchain = out.value >= need ? "pass" : "fail";
  return out;
}

// ---------- NFTs ----------
const pad = (v) => BigInt(v).toString(16).padStart(64, "0");

function decodeString(hex) {
  const b = hex.replace(/^0x/, "");
  if (b.length < 128) {
    // some old contracts return bytes32 instead of a string
    const raw = b.replace(/(00)+$/, "");
    return new TextDecoder().decode(Uint8Array.from(raw.match(/../g) || [], (h) => parseInt(h, 16)));
  }
  const len = Number(BigInt("0x" + b.slice(64, 128)));
  const data = b.slice(128, 128 + len * 2);
  return new TextDecoder().decode(Uint8Array.from(data.match(/../g) || [], (h) => parseInt(h, 16)));
}

// What a wallet holds of one collection, read through the wallet itself.
export async function readNft(provider, address, contract, tokenId = "") {
  if (!isAddr(contract)) throw new Error("Paste the collection's contract address (0x…)");
  if (tokenId !== "" && !/^\d+$/.test(tokenId)) throw new Error("A token id is a whole number");
  const call = (data, tag) => provider.request({ method: "eth_call", params: [{ to: contract, data }, tag] });
  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  const block = Number(await provider.request({ method: "eth_blockNumber" }));
  const tag = "0x" + block.toString(16);
  // ERC-721 contracts answer supportsInterface(0x80ac58cd) with true.
  let is721 = false;
  try { is721 = BigInt(await call("0x01ffc9a780ac58cd" + "0".repeat(56), tag)) === 1n; } catch { /* not ERC-165 */ }
  if (!is721) throw new Error("That address is not an ERC-721 NFT collection on this network");
  let name = "", symbol = "";
  try { name = decodeString(await call("0x06fdde03", tag)); } catch { /* optional */ }
  try { symbol = decodeString(await call("0x95d89b41", tag)); } catch { /* optional */ }
  symbol = (symbol || "NFT").trim().toUpperCase().slice(0, 24);
  let count = 0n, owns = null;
  if (tokenId !== "") {
    try { owns = ("0x" + (await call("0x6352211e" + pad(tokenId), tag)).slice(-40)).toLowerCase() === address.toLowerCase(); } catch { owns = false; }
  } else {
    count = BigInt(await call("0x70a08231" + pad(address), tag));
  }
  return { chainId, block, contract: contract.toLowerCase(), name: name || symbol, symbol, tokenId, count, owns };
}

export function nftMessage({ commitment, address, chainId, block, contract, tokenId, amount, expires, brand = BRAND }) {
  const chain = CHAINS[chainId]?.name || `chain ${chainId}`;
  const lines = [
    `${brand} proof of NFT`,
    "",
    `I control ${address.toLowerCase()}`,
    tokenId ? `and it owned token #${tokenId} of NFT collection ${contract.toLowerCase()}` : `and it held at least ${amount} NFTs of collection ${contract.toLowerCase()}`,
    `on ${chain} at block ${block}.`,
    "",
    `Bond: 0x${commitment}`,
    `Chain id: ${chainId}`,
  ];
  if (expires) lines.push(`Valid until: ${new Date(expires * 1000).toISOString()}`);
  return lines.join("\n");
}

export async function signNft(provider, { receipt, address, chainId, block, contract, tokenId = "" }) {
  const message = nftMessage({ commitment: receipt.commitment, address, chainId, block, contract, tokenId, amount: receipt.asset.amount, expires: receipt.asset.expires });
  const signature = await signText(provider, address, message);
  const proof = { type: "nft-v1", address: address.toLowerCase(), chainId, block, contract: contract.toLowerCase(), signature };
  if (tokenId) proof.tokenId = tokenId;
  return proof;
}

export async function verifyNft(receipt) {
  const p = receipt.proof;
  const out = { signed: false, signer: null, onchain: "unchecked", heldAt: null, detail: "", testnet: false };
  const ok = p && p.type === "nft-v1" && isAddr(p.address) && isAddr(p.contract) && typeof p.signature === "string"
    && Number.isSafeInteger(p.chainId) && isBlock(p.block) && (p.tokenId === undefined || (typeof p.tokenId === "string" && /^\d{1,78}$/.test(p.tokenId)));
  if (!ok) { out.detail = "The wallet proof in this link is damaged."; return out; }

  const message = (brand) => nftMessage({ commitment: receipt.commitment, address: p.address, chainId: p.chainId, block: p.block, contract: p.contract, tokenId: p.tokenId, amount: receipt.asset.amount, expires: receipt.asset.expires, brand });
  out.signer = await recoverAny(message, p.signature, p.address);
  out.signed = !!out.signer && out.signer === p.address.toLowerCase();
  if (!out.signed) return out;

  const chain = CHAINS[p.chainId];
  if (chain?.testnet) out.testnet = true;
  if (!chain) { out.onchain = "unsupported"; out.detail = "NFTs on this chain cannot be checked from this page."; return out; }
  const count = /^\d+$/.test(receipt.asset.amount) ? BigInt(receipt.asset.amount) : null;
  if (receipt.asset.chain !== chain.key || !count || (p.tokenId && count !== 1n)) {
    out.onchain = "fail"; out.detail = "The bond does not match the NFTs the wallet signed for."; return out;
  }
  const call = (data, tag) => rpc(p.chainId, "eth_call", [{ to: p.contract, data }, tag]);
  try {
    const sym = (decodeString(await call("0x95d89b41", "latest")) || "NFT").trim().toUpperCase().slice(0, 24);
    if (sym !== receipt.asset.symbol) { out.onchain = "fail"; out.detail = `The collection is ${sym}, but the bond says ${receipt.asset.symbol}.`; return out; }
    out.collection = sym;
  } catch { /* contracts without symbol(): the bond must say NFT */
    if (receipt.asset.symbol !== "NFT") { out.onchain = "fail"; out.detail = "The bond does not name this collection."; return out; }
  }
  const owner = (tag) => call("0x6352211e" + pad(p.tokenId), tag).then(
    (r) => ("0x" + r.slice(-40)).toLowerCase(),
    (err) => { if (/revert/i.test(err?.message || "")) return ""; throw err; }); // no such token: nobody owns it
  const check = async (tag) => p.tokenId
    ? (await owner(tag)) === p.address.toLowerCase()
    : BigInt(await call("0x70a08231" + pad(p.address), tag)) >= count;
  try {
    out.onchain = (await check("0x" + p.block.toString(16))) ? "pass" : "fail";
    out.heldAt = "block";
  } catch {
    try { out.onchain = (await check("latest")) ? "pass" : "fail"; out.heldAt = "latest"; }
    catch { out.onchain = "unreachable"; out.detail = "The blockchain could not be reached from this page."; }
  }
  return out;
}
