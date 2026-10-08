/**
 * Browser-safe chain constants (no Node imports). Imported by the web app via `@launch/config/chains`.
 */
/** Chain network descriptors shared by API + web (explorer URL builders). */
export const SOLANA_NETWORKS = {
  devnet: { cluster: 'devnet', explorerSuffix: '?cluster=devnet', defaultRpc: 'https://api.devnet.solana.com' },
  testnet: { cluster: 'testnet', explorerSuffix: '?cluster=testnet', defaultRpc: 'https://api.testnet.solana.com' },
  'mainnet-beta': { cluster: 'mainnet-beta', explorerSuffix: '', defaultRpc: 'https://api.mainnet-beta.solana.com' },
} as const;

export const ROBINHOOD_CHAIN_NETWORKS = {
  testnet: {
    chainId: 46630,
    name: 'Robinhood Chain Testnet',
    rpc: 'https://rpc.testnet.chain.robinhood.com',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
    currency: 'ETH',
    dexscreenerChainId: 'robinhood',
  },
  mainnet: {
    chainId: 4663,
    name: 'Robinhood Chain',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    currency: 'ETH',
    dexscreenerChainId: 'robinhood',
  },
} as const;

export function solanaExplorerAddressUrl(address: string, network: keyof typeof SOLANA_NETWORKS): string {
  return `https://explorer.solana.com/address/${address}${SOLANA_NETWORKS[network].explorerSuffix}`;
}
export function solanaExplorerTxUrl(signature: string, network: keyof typeof SOLANA_NETWORKS): string {
  return `https://explorer.solana.com/tx/${signature}${SOLANA_NETWORKS[network].explorerSuffix}`;
}
export function robinhoodExplorerAddressUrl(address: string, network: keyof typeof ROBINHOOD_CHAIN_NETWORKS): string {
  return `${ROBINHOOD_CHAIN_NETWORKS[network].explorer}/address/${address}`;
}
export function robinhoodExplorerTxUrl(hash: string, network: keyof typeof ROBINHOOD_CHAIN_NETWORKS): string {
  return `${ROBINHOOD_CHAIN_NETWORKS[network].explorer}/tx/${hash}`;
}
