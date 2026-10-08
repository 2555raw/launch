/**
 * Everything that touches the Solana network.
 *
 * Only launch-level events go on-chain: creating the mint, minting the initial
 * supply, burning the community-determined amount, revoking the mint authority
 * and paying out claims. Gameplay never does. The signing key here is the
 * server's launch authority; player keys are never seen by this code.
 */
import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  AuthorityType, ExtensionType, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TYPE_SIZE,
  createAssociatedTokenAccountIdempotentInstruction, createBurnInstruction, createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction, createMintToInstruction, createSetAuthorityInstruction, createTransferInstruction,
  getAssociatedTokenAddressSync, getMint, getMintLen, getTokenMetadata,
} from "@solana/spl-token";
import { createInitializeInstruction, createUpdateFieldInstruction, pack, type TokenMetadata } from "@solana/spl-token-metadata";
import { env } from "./env";

const U64_MAX = (1n << 64n) - 1n;

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(env.solanaRpcUrl, { commitment: "confirmed" });
  return connection;
}

export function cluster(): string {
  return env.solanaCluster;
}

export function explorerUrl(kind: "address" | "tx", value: string): string {
  const c = cluster();
  const q = c === "mainnet-beta" ? "" : `?cluster=${c}`;
  return `https://explorer.solana.com/${kind}/${value}${q}`;
}

let authority: Keypair | null = null;
/** The server's launch authority. From env, or generated once into .secrets/ for development. */
export function getAuthority(): Keypair {
  if (authority) return authority;
  const secret = env.solanaAuthoritySecret.trim();
  if (secret) {
    authority = secret.startsWith("[") ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret))) : Keypair.fromSecretKey(bs58.decode(secret));
    return authority;
  }
  const file = path.join(process.cwd(), ".secrets", "authority.json");
  if (fs.existsSync(file)) {
    authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
    return authority;
  }
  if (env.isProd && env.solanaCluster === "mainnet-beta") throw new Error("SOLANA_AUTHORITY_SECRET must be set on mainnet");
  authority = Keypair.generate();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(Array.from(authority.secretKey)), { mode: 0o600 });
  console.log(`[solana] generated launch authority ${authority.publicKey.toBase58()} -> ${file}`);
  return authority;
}

export async function getAuthorityBalance(): Promise<number> {
  const lamports = await getConnection().getBalance(getAuthority().publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

/** Ask the devnet faucet for SOL when the authority is low. Fails loudly otherwise. */
export async function ensureFunded(minSol = 0.05): Promise<{ balance: number; airdropTx?: string }> {
  const conn = getConnection();
  const auth = getAuthority();
  let balance = await getAuthorityBalance();
  if (balance >= minSol) return { balance };
  if (cluster() === "mainnet-beta") throw new Error(`Launch authority ${auth.publicKey.toBase58()} holds ${balance} SOL; fund it with at least ${minSol} SOL`);
  try {
    const sig = await conn.requestAirdrop(auth.publicKey, LAMPORTS_PER_SOL);
    const latest = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, ...latest }, "confirmed");
    balance = await getAuthorityBalance();
    return { balance, airdropTx: sig };
  } catch (e) {
    throw new Error(`Airdrop failed (${(e as Error).message}). Fund ${auth.publicKey.toBase58()} at https://faucet.solana.com and retry.`);
  }
}

export function toBaseUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid token amount");
  const whole = BigInt(Math.floor(amount));
  const frac = BigInt(Math.round((amount - Math.floor(amount)) * 10 ** decimals));
  const units = whole * 10n ** BigInt(decimals) + frac;
  if (units > U64_MAX) throw new Error(`Supply ${amount} with ${decimals} decimals exceeds the u64 limit of an SPL token`);
  return units;
}

export function fromBaseUnits(units: bigint, decimals: number): number {
  return Number(units) / 10 ** decimals;
}

export interface CreateMintResult {
  mint: string;
  treasuryAta: string;
  signature: string;
}

/**
 * One transaction: create a Token-2022 mint with on-chain metadata, create the
 * treasury token account and mint the full initial supply into it.
 */
export async function createTokenWithSupply(params: { name: string; symbol: string; uri: string; decimals: number; initialSupply: number; additional?: [string, string][] }): Promise<CreateMintResult> {
  const conn = getConnection();
  const auth = getAuthority();
  const mintKp = Keypair.generate();
  const mint = mintKp.publicKey;
  const metadata: TokenMetadata = {
    mint,
    name: params.name.slice(0, 32),
    symbol: params.symbol.slice(0, 10),
    uri: params.uri.slice(0, 200),
    additionalMetadata: params.additional ?? [],
  };
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen + metadataLen);
  const ata = getAssociatedTokenAddressSync(mint, auth.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const amount = toBaseUnits(params.initialSupply, params.decimals);

  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: auth.publicKey, newAccountPubkey: mint, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeMetadataPointerInstruction(mint, auth.publicKey, mint, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint, params.decimals, auth.publicKey, null, TOKEN_2022_PROGRAM_ID),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID, mint, metadata: mint, name: metadata.name, symbol: metadata.symbol, uri: metadata.uri,
      mintAuthority: auth.publicKey, updateAuthority: auth.publicKey,
    }),
    ...metadata.additionalMetadata.map(([field, value]) =>
      createUpdateFieldInstruction({ programId: TOKEN_2022_PROGRAM_ID, metadata: mint, updateAuthority: auth.publicKey, field, value }),
    ),
    createAssociatedTokenAccountIdempotentInstruction(auth.publicKey, ata, auth.publicKey, mint, TOKEN_2022_PROGRAM_ID),
    createMintToInstruction(mint, ata, auth.publicKey, amount, [], TOKEN_2022_PROGRAM_ID),
  );
  const signature = await sendAndConfirmTransaction(conn, tx, [auth, mintKp], { commitment: "confirmed" });
  return { mint: mint.toBase58(), treasuryAta: ata.toBase58(), signature };
}

export async function burnFromTreasury(mintAddress: string, amount: number, decimals: number): Promise<string> {
  const conn = getConnection();
  const auth = getAuthority();
  const mint = new PublicKey(mintAddress);
  const ata = getAssociatedTokenAddressSync(mint, auth.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const units = toBaseUnits(amount, decimals);
  if (units === 0n) throw new Error("Nothing to burn");
  const tx = new Transaction().add(createBurnInstruction(ata, mint, auth.publicKey, units, [], TOKEN_2022_PROGRAM_ID));
  return sendAndConfirmTransaction(conn, tx, [auth], { commitment: "confirmed" });
}

export async function revokeMintAuthority(mintAddress: string): Promise<string> {
  const conn = getConnection();
  const auth = getAuthority();
  const mint = new PublicKey(mintAddress);
  const tx = new Transaction().add(createSetAuthorityInstruction(mint, auth.publicKey, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID));
  return sendAndConfirmTransaction(conn, tx, [auth], { commitment: "confirmed" });
}

export async function transferFromTreasury(mintAddress: string, toOwner: string, amount: number, decimals: number): Promise<string> {
  const conn = getConnection();
  const auth = getAuthority();
  const mint = new PublicKey(mintAddress);
  const owner = new PublicKey(toOwner);
  const from = getAssociatedTokenAddressSync(mint, auth.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const to = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
  const units = toBaseUnits(amount, decimals);
  if (units === 0n) throw new Error("Nothing to transfer");
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(auth.publicKey, to, owner, mint, TOKEN_2022_PROGRAM_ID),
    createTransferInstruction(from, to, auth.publicKey, units, [], TOKEN_2022_PROGRAM_ID),
  );
  return sendAndConfirmTransaction(conn, tx, [auth], { commitment: "confirmed" });
}

// ---------------------------------------------------------------------------
// Reads (used by the project page; cached by the caller)
// ---------------------------------------------------------------------------

export interface OnChainToken {
  mint: string;
  supply: number;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  holders: number | null;
  largest: { address: string; amount: number }[];
  metadata: { name: string; symbol: string; uri: string; additional: [string, string][] } | null;
  fetchedAt: number;
}

export async function readToken(mintAddress: string): Promise<OnChainToken> {
  const conn = getConnection();
  const mint = new PublicKey(mintAddress);
  const info = await getMint(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  let holders: number | null = null;
  try {
    const accounts = await conn.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
      filters: [{ memcmp: { offset: 0, bytes: mintAddress } }],
      dataSlice: { offset: 64, length: 8 },
    });
    holders = accounts.filter((a) => a.account.data.readBigUInt64LE(0) > 0n).length;
  } catch {
    holders = null;
  }
  let largest: OnChainToken["largest"] = [];
  try {
    const l = await conn.getTokenLargestAccounts(mint);
    largest = l.value.slice(0, 10).map((v) => ({ address: v.address.toBase58(), amount: Number(v.uiAmount ?? 0) }));
  } catch {
    largest = [];
  }
  let metadata: OnChainToken["metadata"] = null;
  try {
    const m = await getTokenMetadata(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    if (m) metadata = { name: m.name, symbol: m.symbol, uri: m.uri, additional: m.additionalMetadata as [string, string][] };
  } catch {
    metadata = null;
  }
  return {
    mint: mintAddress,
    supply: fromBaseUnits(info.supply, info.decimals),
    decimals: info.decimals,
    mintAuthority: info.mintAuthority?.toBase58() ?? null,
    freezeAuthority: info.freezeAuthority?.toBase58() ?? null,
    holders,
    largest,
    metadata,
    fetchedAt: Date.now(),
  };
}

export interface MarketData {
  source: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  pairUrl: string | null;
}

/** Real market data exists only where a market exists. On devnet there is none, and we say so. */
export async function readMarket(mintAddress: string): Promise<MarketData | null> {
  if (cluster() !== "mainnet-beta") return null;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`, { next: { revalidate: 60 } } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number }; volume?: { h24?: number }; fdv?: number; url?: string }> };
    const p = json.pairs?.[0];
    if (!p) return null;
    return { source: "dexscreener", priceUsd: p.priceUsd ? Number(p.priceUsd) : null, liquidityUsd: p.liquidity?.usd ?? null, volume24hUsd: p.volume?.h24 ?? null, marketCapUsd: p.fdv ?? null, pairUrl: p.url ?? null };
  } catch {
    return null;
  }
}
