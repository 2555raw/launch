import { defineChain, type Chain } from 'viem';
import publicDeployments from '../generated/deployments.json';

export interface Deployment {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  desk: `0x${string}`;
  launchpad: `0x${string}`;
  router: `0x${string}`;
  coinImplementation: `0x${string}`;
  deployBlock: number;
  deployedAt: string;
  testCurrencies: boolean;
}

interface ChainMeta {
  id: number;
  name: string;
  rpc: string;
  explorer: string;
  faucet?: string;
  testnet: boolean;
}

/** Chains the site knows how to talk to. A chain becomes "live" once
 *  scripts/deploy.mjs has written a deployment for it. */
export const KNOWN_CHAINS: ChainMeta[] = [
  { id: 4663, name: 'Robinhood Chain', rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://explorer.chain.robinhood.com', testnet: false },
  { id: 46630, name: 'Robinhood Chain Testnet', rpc: 'https://rpc.testnet.chain.robinhood.com', explorer: 'https://explorer.testnet.chain.robinhood.com', faucet: 'https://faucet.testnet.chain.robinhood.com', testnet: true },
  { id: 8453, name: 'Base', rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org', testnet: false },
  { id: 84532, name: 'Base Sepolia', rpc: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org', faucet: 'https://www.alchemy.com/faucets/base-sepolia', testnet: true },
  { id: 11155111, name: 'Sepolia', rpc: 'https://ethereum-sepolia-rpc.publicnode.com', explorer: 'https://sepolia.etherscan.io', faucet: 'https://www.alchemy.com/faucets/ethereum-sepolia', testnet: true },
  { id: 31337, name: 'Local storm', rpc: 'http://127.0.0.1:8545', explorer: '', testnet: true },
];

// Local deployments live in a git-ignored file; only a dev server or a build
// made with VITE_ALLOW_LOCAL=1 picks them up.
const localFiles = import.meta.glob<Record<string, Deployment>>('../generated/deployments.local.json', {
  eager: true,
  import: 'default',
});
const allowLocal = import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL === '1';

export const DEPLOYMENTS: Record<number, Deployment> = {
  ...(publicDeployments as Record<string, Deployment>),
  ...(allowLocal ? Object.values(localFiles)[0] ?? {} : {}),
};

export const LIVE_CHAIN_IDS = Object.keys(DEPLOYMENTS).map(Number);

export const DEFAULT_CHAIN_ID: number | undefined =
  Number(import.meta.env.VITE_DEFAULT_CHAIN) || LIVE_CHAIN_IDS.find((id) => id !== 31337) || LIVE_CHAIN_IDS[0];

export function chainMeta(id: number): ChainMeta {
  const known = KNOWN_CHAINS.find((c) => c.id === id);
  const dep = DEPLOYMENTS[id];
  return {
    id,
    name: dep?.name || known?.name || `Chain ${id}`,
    rpc: dep?.rpcUrl || known?.rpc || '',
    explorer: dep?.explorer || known?.explorer || '',
    faucet: known?.faucet,
    testnet: known?.testnet ?? true,
  };
}

export function viemChain(id: number): Chain {
  const m = chainMeta(id);
  return defineChain({
    id,
    name: m.name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [m.rpc] } },
    blockExplorers: m.explorer ? { default: { name: 'Explorer', url: m.explorer } } : undefined,
    testnet: m.testnet,
  });
}

export function explorerTx(chainId: number, hash: string) {
  const e = chainMeta(chainId).explorer;
  return e ? `${e}/tx/${hash}` : '';
}

export function explorerAddress(chainId: number, address: string) {
  const e = chainMeta(chainId).explorer;
  return e ? `${e}/address/${address}` : '';
}
