// One entry point for the verify page: picks the checker for the proof's type
// and describes the result in words, whatever kind of proof it is.
import { CHAINS, verifyFunds, explorerAddress, rpc } from "./proof.js";
import { verifyUsd, verifyNft, formatUsd } from "./kinds.js";
import { verifySol, EXPLORER as SOLSCAN } from "./solana.js";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export async function checkProof(r) {
  const p = r.proof;
  const amount = `${r.asset.amount} ${r.asset.symbol}`;
  if (p?.type === "sol-v1") {
    const f = await verifySol(r);
    return { ...f, kind: "sol", chainName: "Solana", holds: `at least ${amount}`,
      signerLabel: short(p.address || "????????????"), signerLink: p.address ? `${SOLSCAN}/account/${p.address}` : null };
  }
  const chainName = CHAINS[p?.chainId]?.name || `chain ${p?.chainId}`;
  const base = { chainName, signerLabel: typeof p?.address === "string" ? short(p.address) : "?", signerLink: typeof p?.address === "string" ? explorerAddress(p.chainId, p.address) : null };
  if (p?.type === "usd-v1") {
    const f = await verifyUsd(r);
    const counted = Array.isArray(p.parts) ? p.parts.join(", ") : "";
    return { ...base, ...f, kind: "usd", holds: `assets worth at least $${Number(r.asset.amount).toLocaleString("en-US")}`,
      note: `Counting ${counted} at Chainlink prices on Ethereum block ${Number(p.priceBlock).toLocaleString("en-US")}.${f.value ? ` Worth ${formatUsd(f.value)} when checked.` : ""}` };
  }
  if (p?.type === "nft-v1") {
    const f = await verifyNft(r);
    const what = p.tokenId ? `token #${p.tokenId} of ${r.asset.symbol}` : `at least ${r.asset.amount} ${r.asset.symbol} NFT${r.asset.amount === "1" ? "" : "s"}`;
    return { ...base, ...f, kind: "nft", holds: what, contractLink: typeof p.contract === "string" ? explorerAddress(p.chainId, p.contract) : null };
  }
  const f = await verifyFunds(r);
  return { ...base, ...f, kind: "funds", holds: `at least ${amount}` };
}

// Reverse ENS: the name an address chose for itself, checked forward too.
// EVM addresses are the same on every chain, so mainnet ENS names them all.
export async function ensName(address) {
  try {
    const { JsonRpcProvider } = await import("../assets/vendor/ethers.min.js");
    for (const url of CHAINS[1].rpcs) {
      try {
        const provider = new JsonRpcProvider(url, 1, { staticNetwork: true });
        return await provider.lookupAddress(address);
      } catch { /* next node */ }
    }
  } catch { /* ethers did not load */ }
  return null;
}

export { rpc };
