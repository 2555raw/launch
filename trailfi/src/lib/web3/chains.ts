import { arbitrum, base, baseSepolia, mainnet, optimism, polygon, sepolia, type Chain } from "viem/chains";

export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [optimism.id]: optimism,
  [polygon.id]: polygon,
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia,
};

/** The single network Stepit pays rewards on. Base Sepolia (testnet) unless configured otherwise. */
export const PAYOUT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || baseSepolia.id);

export function getPayoutChain(): Chain {
  const chain = SUPPORTED_CHAINS[PAYOUT_CHAIN_ID];
  if (!chain) throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID ${PAYOUT_CHAIN_ID}`);
  return chain;
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const url = SUPPORTED_CHAINS[chainId]?.blockExplorers?.default.url;
  return url ? `${url}/tx/${hash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const url = SUPPORTED_CHAINS[chainId]?.blockExplorers?.default.url;
  return url ? `${url}/address/${address}` : null;
}
