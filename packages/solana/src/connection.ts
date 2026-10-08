import { Connection, type Commitment } from '@solana/web3.js';
import { SOLANA_NETWORKS } from '@launch/config/chains';

export type SolanaNetwork = keyof typeof SOLANA_NETWORKS;

export function createConnection(rpcUrl: string, commitment: Commitment = 'confirmed'): Connection {
  return new Connection(rpcUrl, { commitment });
}

export function isSolanaNetwork(value: string): value is SolanaNetwork {
  return value in SOLANA_NETWORKS;
}
