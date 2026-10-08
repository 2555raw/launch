import {
  AuthorityType,
  ExtensionType,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from '@solana/spl-token';
import { createInitializeInstruction, pack, type TokenMetadata } from '@solana/spl-token-metadata';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

export const U64_MAX = (1n << 64n) - 1n;

export interface CreateTokenParams {
  connection: Connection;
  /** wallet that pays rent + fees and becomes the mint/freeze/update authority */
  payer: PublicKey;
  /** fresh keypair for the mint account; must co-sign the transaction */
  mintKeypair: Keypair;
  name: string;
  symbol: string;
  /** off-chain JSON metadata URI (logo, description, links) */
  uri: string;
  decimals: number;
  /** whole-token supply (before decimals) */
  totalSupply: bigint;
  /** permanently disable further minting (fixed supply) */
  revokeMintAuthority: boolean;
  /** permanently disable freezing token accounts */
  revokeFreezeAuthority: boolean;
}

export function rawSupply(totalSupply: bigint, decimals: number): bigint {
  const raw = totalSupply * 10n ** BigInt(decimals);
  if (raw > U64_MAX) throw new Error('Total supply * 10^decimals exceeds the u64 limit of SPL tokens');
  return raw;
}

export function validateTokenInput(input: { name: string; symbol: string; decimals: number; totalSupply: bigint }): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.length > 32) errors.push('Name must be 1-32 characters');
  if (!input.symbol || input.symbol.length > 10) errors.push('Symbol must be 1-10 characters');
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 9) errors.push('Decimals must be an integer between 0 and 9');
  if (input.totalSupply <= 0n) errors.push('Total supply must be positive');
  try {
    rawSupply(input.totalSupply, input.decimals);
  } catch (e) {
    errors.push((e as Error).message);
  }
  return errors;
}

/**
 * Builds the single transaction that creates a Token-2022 mint with on-chain metadata
 * (metadata-pointer extension pointing at the mint itself), creates the creator's associated
 * token account, mints the full supply to it and optionally revokes the authorities.
 *
 * The caller signs it with the wallet (fee payer) and the mint keypair, then broadcasts.
 */
export async function buildCreateTokenTransaction(params: CreateTokenParams): Promise<{ transaction: Transaction; mint: PublicKey; ata: PublicKey; rentLamports: number; lastValidBlockHeight: number }> {
  const { connection, payer, mintKeypair, name, symbol, uri, decimals, totalSupply } = params;
  const mint = mintKeypair.publicKey;
  const metadata: TokenMetadata = { mint, name, symbol, uri, additionalMetadata: [] };
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const rentLamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
  const ata = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_2022_PROGRAM_ID);
  const amount = rawSupply(totalSupply, decimals);

  const tx = new Transaction();
  tx.add(
    SystemProgram.createAccount({ fromPubkey: payer, newAccountPubkey: mint, space: mintLen, lamports: rentLamports, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeMetadataPointerInstruction(mint, payer, mint, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint, decimals, payer, params.revokeFreezeAuthority ? null : payer, TOKEN_2022_PROGRAM_ID),
    createInitializeInstruction({ programId: TOKEN_2022_PROGRAM_ID, mint, metadata: mint, name, symbol, uri, mintAuthority: payer, updateAuthority: payer }),
    createAssociatedTokenAccountInstruction(payer, ata, payer, mint, TOKEN_2022_PROGRAM_ID),
    createMintToInstruction(mint, ata, payer, amount, [], TOKEN_2022_PROGRAM_ID),
  );
  if (params.revokeMintAuthority) {
    tx.add(createSetAuthorityInstruction(mint, payer, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID));
  }
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  tx.partialSign(mintKeypair);
  return { transaction: tx, mint, ata, rentLamports, lastValidBlockHeight };
}
