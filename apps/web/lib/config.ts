export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4100';
export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'testnet' | 'mainnet-beta';
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
export const ROBINHOOD_CHAIN_NETWORK = (process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet';
export const ROBINHOOD_CHAIN_RPC_URL = process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com';
