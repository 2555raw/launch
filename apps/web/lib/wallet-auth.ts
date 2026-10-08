'use client';
import bs58 from 'bs58';
import { api } from './api';
import type { AuthUser, WalletDTO } from '@launch/types';

export type ChainKey = 'SOLANA' | 'ROBINHOOD';

export interface SignedChallenge {
  chain: ChainKey;
  address: string;
  nonce: string;
  signature: string;
}

/**
 * Asks the API for a one-time nonce + human readable message, lets the wallet sign it, and
 * returns the payload the API verifies. `signMessage` comes from the Solana wallet adapter
 * (`wallet.signMessage(bytes)`) or wagmi (`signMessageAsync({ message })`).
 */
export async function signChallenge(chain: ChainKey, address: string, signMessage: (message: string) => Promise<Uint8Array | string>): Promise<SignedChallenge> {
  const { nonce, message } = await api<{ nonce: string; message: string }>('/auth/wallet/nonce', { method: 'POST', json: { chain, address } });
  const sig = await signMessage(message);
  const signature = typeof sig === 'string' ? sig : bs58.encode(sig);
  return { chain, address, nonce, signature };
}

export async function walletSignIn(challenge: SignedChallenge): Promise<{ user: AuthUser; accessToken: string; refreshToken?: string }> {
  return api('/auth/wallet/verify', { method: 'POST', json: challenge });
}

export async function walletLink(challenge: SignedChallenge, label?: string): Promise<{ wallet: WalletDTO }> {
  return api('/wallets/link', { method: 'POST', json: { ...challenge, label } });
}
