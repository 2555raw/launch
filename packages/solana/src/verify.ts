import { TOKEN_2022_PROGRAM_ID, getMint, getTokenMetadata } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

export interface VerifiedToken {
  mint: string;
  decimals: number;
  /** raw supply (smallest units) */
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  updateAuthority: string | null;
  tokenProgram: string;
  signature: string;
  slot: number;
  feePayer: string;
  blockTime: number | null;
}

export class VerificationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Confirms a token-creation transaction on chain and reads the resulting mint + metadata.
 * Everything returned comes from RPC — nothing here is inferred from client input.
 */
export async function verifyTokenCreation(connection: Connection, signature: string, mintAddress: string): Promise<VerifiedToken> {
  let mint: PublicKey;
  try {
    mint = new PublicKey(mintAddress);
  } catch {
    throw new VerificationError('INVALID_MINT', 'Mint address is not a valid public key');
  }
  const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx) throw new VerificationError('TX_NOT_FOUND', 'Transaction not found or not yet confirmed');
  if (tx.meta?.err) throw new VerificationError('TX_FAILED', `Transaction failed on chain: ${JSON.stringify(tx.meta.err)}`);
  const keys = tx.transaction.message.accountKeys;
  const touchesMint = keys.some((k) => k.pubkey.equals(mint));
  if (!touchesMint) throw new VerificationError('MINT_NOT_IN_TX', 'Transaction does not reference the mint account');
  const feePayer = keys[0]?.pubkey.toBase58() ?? '';

  const info = await connection.getAccountInfo(mint, 'confirmed');
  if (!info) throw new VerificationError('MINT_NOT_FOUND', 'Mint account does not exist');
  if (!info.owner.equals(TOKEN_2022_PROGRAM_ID)) throw new VerificationError('WRONG_PROGRAM', 'Mint is not owned by the Token-2022 program');

  const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const metadata = await getTokenMetadata(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID).catch(() => null);
  return {
    mint: mint.toBase58(),
    decimals: mintInfo.decimals,
    supply: mintInfo.supply,
    mintAuthority: mintInfo.mintAuthority?.toBase58() ?? null,
    freezeAuthority: mintInfo.freezeAuthority?.toBase58() ?? null,
    name: metadata?.name ?? null,
    symbol: metadata?.symbol ?? null,
    uri: metadata?.uri ?? null,
    updateAuthority: metadata?.updateAuthority?.toBase58() ?? null,
    tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    signature,
    slot: tx.slot,
    feePayer,
    blockTime: tx.blockTime ?? null,
  };
}

/** Fetches a transaction's confirmation status without parsing it. */
export async function getSignatureStatus(connection: Connection, signature: string): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'FAILED'; slot: number | null; err: unknown }> {
  const res = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const s = res.value[0];
  if (!s) return { status: 'PENDING', slot: null, err: null };
  if (s.err) return { status: 'FAILED', slot: s.slot, err: s.err };
  if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return { status: 'CONFIRMED', slot: s.slot, err: null };
  return { status: 'PENDING', slot: s.slot, err: null };
}

/**
 * Number of token accounts holding a non-zero balance. Needs `getProgramAccounts`, which the
 * public mainnet RPC rejects; returns null in that case so the UI shows "Data unavailable".
 */
export async function getHolderCount(connection: Connection, mintAddress: string): Promise<number | null> {
  try {
    const mint = new PublicKey(mintAddress);
    const info = await connection.getAccountInfo(mint);
    if (!info) return null;
    const accounts = await connection.getProgramAccounts(info.owner, {
      dataSlice: { offset: 64, length: 8 },
      filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
    });
    let holders = 0;
    for (const a of accounts) {
      const amount = a.account.data.readBigUInt64LE(0);
      if (amount > 0n) holders++;
    }
    return holders;
  } catch {
    return null;
  }
}
