import type { Env } from '@launch/config';
import { ROBINHOOD_CHAIN_NETWORKS, robinhoodExplorerAddressUrl, robinhoodExplorerTxUrl, solanaExplorerAddressUrl, solanaExplorerTxUrl } from '@launch/config';
import { createRobinhoodPublicClient } from '@launch/evm';
import { createConnection } from '@launch/solana';
import type { Chain } from '@launch/types';
import type { PublicClient } from 'viem';

export function solanaConnection(env: Env) {
  return createConnection(env.SOLANA_RPC_URL);
}

export function evmClient(env: Env): PublicClient {
  return createRobinhoodPublicClient(env.ROBINHOOD_CHAIN_NETWORK, env.ROBINHOOD_CHAIN_RPC_URL);
}

export function networkFor(env: Env, chain: Chain): string {
  return chain === 'SOLANA' ? env.SOLANA_NETWORK : env.ROBINHOOD_CHAIN_NETWORK;
}

export function explorerAddress(chain: Chain, network: string, address: string): string {
  if (chain === 'SOLANA') return solanaExplorerAddressUrl(address, network as 'devnet' | 'testnet' | 'mainnet-beta');
  return robinhoodExplorerAddressUrl(address, network as keyof typeof ROBINHOOD_CHAIN_NETWORKS);
}

export function explorerTx(chain: Chain, network: string, sig: string): string {
  if (chain === 'SOLANA') return solanaExplorerTxUrl(sig, network as 'devnet' | 'testnet' | 'mainnet-beta');
  return robinhoodExplorerTxUrl(sig, network as keyof typeof ROBINHOOD_CHAIN_NETWORKS);
}

export function evmExplorerBase(env: Env): string {
  return ROBINHOOD_CHAIN_NETWORKS[env.ROBINHOOD_CHAIN_NETWORK].explorer;
}
