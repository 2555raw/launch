import "server-only";
import { ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { Launch } from "@/lib/types";
import { isPublicKey, messageHash } from "../pump";
import { LaunchError, type OnchainAdapter, type VerifyResult } from "./types";

/**
 * StonkFun on Solana: a Raydium LaunchLab pool paired with an xStock, built
 * here by hand as StonkFun's /developers "Building it yourself" section
 * describes. The pool carries StonkFun's standard platform id and curve-rule
 * account, so StonkFun adopts it. The creator's wallet pays and signs, then
 * the browser's fresh mint keypair signs. There is no StonkFun launch fee on
 * this path and no opening buy.
 */

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const PRICING_URL = "https://www.stonkfun.xyz/api/public/v1/launchlab/pricing";

export const LAUNCHLAB_PROGRAM = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj");
/** StonkFun's standard (untaxed) platform config: what the pool is attributed to. */
export const STONK_PLATFORM = new PublicKey("4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const SPL_TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/** Anchor discriminator of `initialize_with_token_2022`. */
const INIT_TOKEN_2022 = Buffer.from("25be7ede2c9aab11", "hex");
const GLOBAL_CONFIG_DISC = Buffer.from([149, 8, 156, 202, 160, 252, 176, 217]);

/** The launch shape StonkFun adopts (from its pricing response; fixed for every pair). */
const BASE_DECIMALS = 6;
const SUPPLY = 1_000_000_000_000_000n;
const TOTAL_BASE_SELL = 793_100_000_000_000n;
const MIGRATE_TO_CPMM = 1;
const COMPUTE_UNITS = 600_000;
const PRIORITY_MICROLAMPORTS = 50_000;

/** xStock quote mints (Token-2022, 8 decimals), checked against StonkFun's launchLabReady pairs. */
export const STONK_QUOTES: Record<string, string> = {
  TSLA: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
  NVDA: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  AAPL: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  META: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
  MSFT: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX",
  AMZN: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
  COIN: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu",
  GOOGL: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
  SPY: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  QQQ: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
};

const pda = (...seeds: (Buffer | PublicKey)[]) =>
  PublicKey.findProgramAddressSync(
    seeds.map((s) => (s instanceof PublicKey ? s.toBuffer() : s)),
    LAUNCHLAB_PROGRAM,
  )[0];

export const poolAddress = (baseMint: PublicKey, quoteMint: PublicKey) => pda(Buffer.from("pool"), baseMint, quoteMint);

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) throw new LaunchError("Solana did not respond. Try again.", 502);
  const data = (await res.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!data) throw new LaunchError("Solana returned an unreadable response.", 502);
  if (data.error) throw new LaunchError(`Solana rejected the request: ${(data.error.message ?? "").slice(0, 160)}`, 502);
  return data.result as T;
}

interface Pricing {
  quote: { mint: string; decimals: number; tokenProgram: string };
  raise: { raw: string };
  curve: {
    programId: string;
    configId: string;
    curveType: string;
    migrateType: string;
    baseDecimals: number;
    supply: string;
    totalSellA: string;
    vesting: { totalLockedAmount: string; cliffPeriod: string; unlockPeriod: string };
    cpmmCreatorFeeOn: number;
  };
  platform: { standard: string };
  curveRule: { standard: string };
}

/** StonkFun's numbers for this quote. The raise is priced at request time, so fetch it per prepare. */
async function fetchPricing(quoteMint: string): Promise<Pricing> {
  const res = await fetch(`${PRICING_URL}?quoteMint=${quoteMint}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" }).catch(() => null);
  const body = res?.ok ? ((await res.json().catch(() => null)) as { data?: Pricing } | null) : null;
  const p = body?.data;
  if (!p?.curve || !p.raise || !p.platform || !p.curveRule || !p.quote) throw new LaunchError("StonkFun did not return pricing for this pair. Try again in a moment.", 502);

  const shapeOk =
    p.quote.mint === quoteMint &&
    p.curve.programId === LAUNCHLAB_PROGRAM.toBase58() &&
    p.platform.standard === STONK_PLATFORM.toBase58() &&
    p.curve.curveType === "ConstantCurve" &&
    p.curve.migrateType === "cpmm" &&
    p.curve.baseDecimals === BASE_DECIMALS &&
    p.curve.supply === SUPPLY.toString() &&
    p.curve.totalSellA === TOTAL_BASE_SELL.toString() &&
    p.curve.cpmmCreatorFeeOn === 0 &&
    [p.curve.vesting?.totalLockedAmount, p.curve.vesting?.cliffPeriod, p.curve.vesting?.unlockPeriod].every((v) => v === "0") &&
    /^[1-9]\d{0,19}$/.test(p.raise.raw) &&
    BigInt(p.raise.raw) < 2n ** 64n &&
    isPublicKey(p.curve.configId) &&
    isPublicKey(p.curveRule.standard);
  if (!shapeOk) throw new LaunchError("StonkFun's launch settings changed. This pair cannot launch until the adapter is updated.", 502);
  return p;
}

/** Borsh: u32 little-endian length + UTF-8 bytes. */
function borshString(s: string) {
  const bytes = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length);
  return Buffer.concat([len, bytes]);
}

function u64(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

/**
 * Instruction data for initialize_with_token_2022, byte for byte what the
 * Raydium SDK writes: the Option<TransferFeeExtensionParams> is None, but the
 * SDK's fixed layout still carries its u16 + u64 as ten zero bytes. The
 * program reads the None tag and ignores the rest.
 */
export function initializeData(opts: { name: string; symbol: string; uri: string; totalQuoteFundRaising: bigint }) {
  return Buffer.concat([
    INIT_TOKEN_2022,
    Buffer.from([BASE_DECIMALS]),
    borshString(opts.name),
    borshString(opts.symbol),
    borshString(opts.uri),
    Buffer.from([0]), // CurveParams::Constant
    u64(SUPPLY),
    u64(TOTAL_BASE_SELL),
    u64(opts.totalQuoteFundRaising),
    Buffer.from([MIGRATE_TO_CPMM]),
    u64(0n), // vesting: total_locked_amount
    u64(0n), // cliff_period
    u64(0n), // unlock_period
    Buffer.from([0]), // AmmCreatorFeeOn::QuoteToken
    Buffer.from([0]), // transfer fee: None (standard launch)
    Buffer.alloc(10), // SDK padding for the absent transfer-fee params
  ]);
}

export async function buildStonkCreateTx(opts: {
  creator: string;
  mint: string;
  pair: string;
  name: string;
  symbol: string;
  uri: string;
}): Promise<VersionedTransaction> {
  const quote = STONK_QUOTES[opts.pair];
  if (!quote) throw new LaunchError(`StonkFun does not launch against ${opts.pair} on-chain.`, 422);

  const pricing = await fetchPricing(quote);
  const creator = new PublicKey(opts.creator);
  const baseMint = new PublicKey(opts.mint);
  const quoteMint = new PublicKey(quote);
  const globalConfig = new PublicKey(pricing.curve.configId);

  // The curve-rule account must be the platform's PDA for this global config.
  const curveRule = pda(Buffer.from("platform_curve_rule"), STONK_PLATFORM, globalConfig);
  if (!curveRule.equals(new PublicKey(pricing.curveRule.standard))) {
    throw new LaunchError("StonkFun's curve rule did not match its config. Try again later.", 502);
  }

  // Read the global config and the quote mint on-chain rather than trusting the API alone.
  const accounts = await rpc<{ value: ({ owner: string; data: [string, string] } | null)[] }>("getMultipleAccounts", [
    [globalConfig.toBase58(), quote],
    { encoding: "base64", dataSlice: { offset: 0, length: 115 }, commitment: "confirmed" },
  ]);
  const [config, quoteInfo] = accounts.value;
  const configData = config ? Buffer.from(config.data[0], "base64") : null;
  const configOk =
    config?.owner === LAUNCHLAB_PROGRAM.toBase58() &&
    configData?.length === 115 &&
    configData.subarray(0, 8).equals(GLOBAL_CONFIG_DISC) &&
    configData[16] === 0 && // curve_type: constant product
    new PublicKey(configData.subarray(83, 115)).equals(quoteMint);
  if (!configOk) throw new LaunchError("StonkFun's LaunchLab config for this pair did not check out on Solana.", 502);
  if (!quoteInfo) throw new LaunchError("The pair's token was not found on Solana.", 502);
  const quoteProgram = new PublicKey(quoteInfo.owner);
  if (!quoteProgram.equals(TOKEN_2022) && !quoteProgram.equals(SPL_TOKEN)) throw new LaunchError("The pair's token program is not supported.", 502);

  const pool = poolAddress(baseMint, quoteMint);
  const keys = [
    { pubkey: creator, isSigner: true, isWritable: true }, // payer
    { pubkey: creator, isSigner: false, isWritable: false }, // creator: receives the creator fee share
    { pubkey: globalConfig, isSigner: false, isWritable: false },
    { pubkey: STONK_PLATFORM, isSigner: false, isWritable: false },
    { pubkey: pda(Buffer.from("vault_auth_seed")), isSigner: false, isWritable: false },
    { pubkey: pool, isSigner: false, isWritable: true },
    { pubkey: baseMint, isSigner: true, isWritable: true },
    { pubkey: quoteMint, isSigner: false, isWritable: false },
    { pubkey: pda(Buffer.from("pool_vault"), pool, baseMint), isSigner: false, isWritable: true },
    { pubkey: pda(Buffer.from("pool_vault"), pool, quoteMint), isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022, isSigner: false, isWritable: false }, // base token program
    { pubkey: quoteProgram, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: pda(Buffer.from("__event_authority")), isSigner: false, isWritable: false },
    { pubkey: LAUNCHLAB_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: curveRule, isSigner: false, isWritable: false }, // StonkFun's curve rule, last and read-only
  ];
  const init = new TransactionInstruction({
    programId: LAUNCHLAB_PROGRAM,
    keys,
    data: initializeData({ name: opts.name, symbol: opts.symbol, uri: opts.uri, totalQuoteFundRaising: BigInt(pricing.raise.raw) }),
  });

  const { value } = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: value.blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }),
      init,
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);

  const signers = message.staticAccountKeys.slice(0, message.header.numRequiredSignatures).map((k) => k.toBase58());
  if (signers.length !== 2 || signers[0] !== opts.creator || signers[1] !== opts.mint) {
    throw new LaunchError("The launch transaction did not match this draft.", 500);
  }
  if (tx.serialize().length > 1232) throw new LaunchError("The token name, ticker or metadata link is too long for one Solana transaction.", 422);
  return tx;
}

export const stonk: OnchainAdapter = {
  wallet: "solana",

  async prepare(launch, ctx) {
    if (!isPublicKey(ctx.creator)) throw new LaunchError("creator must be a Solana public key.", 422);
    if (!ctx.mint || !isPublicKey(ctx.mint) || ctx.mint === ctx.creator) throw new LaunchError("mint must be a fresh Solana public key.", 422);
    if (!/^https:\/\//.test(ctx.metadataUrl)) throw new LaunchError("The token metadata needs a public https URL.", 422);
    if (launch.openingBuy && Number(launch.openingBuy) > 0) throw new LaunchError("StonkFun launches here have no opening buy. Clear it and launch again.", 422);
    if (!STONK_QUOTES[launch.pair]) throw new LaunchError(`StonkFun does not launch against ${launch.pair} on-chain.`, 422);

    const tx = await buildStonkCreateTx({
      creator: ctx.creator,
      mint: ctx.mint,
      pair: launch.pair,
      name: launch.name,
      symbol: launch.ticker,
      uri: ctx.metadataUrl,
    });
    return {
      prepared: { kind: "solana", transaction: Buffer.from(tx.serialize()).toString("base64"), mint: ctx.mint, messageHash: messageHash(tx) },
      metadataUri: ctx.metadataUrl,
    };
  },

  async verify(launch, signature) {
    return checkStonkCreate(signature, launch);
  },
};

/** Check a signature landed, succeeded, and created this launch's LaunchLab pool under StonkFun's platform. */
export async function checkStonkCreate(signature: string, launch: Pick<Launch, "creator" | "mint" | "pair">): Promise<VerifyResult> {
  const quote = STONK_QUOTES[launch.pair];
  if (!launch.creator || !launch.mint || !quote) return { state: "failed", reason: "This launch is missing its wallet, mint or pair." };

  const status = await rpc<{ value: ({ err: unknown; confirmationStatus?: string } | null)[] }>("getSignatureStatuses", [
    [signature],
    { searchTransactionHistory: true },
  ]);
  const s = status.value[0];
  if (!s || s.confirmationStatus === "processed") return { state: "pending" };
  if (s.err) return { state: "failed", reason: "The transaction failed on Solana." };

  const tx = await rpc<{
    meta: { err: unknown } | null;
    transaction: { message: { accountKeys: { pubkey: string; signer: boolean }[]; instructions: { programId: string }[] } };
  } | null>("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
  if (!tx) return { state: "pending" };

  const keys = tx.transaction.message.accountKeys;
  const has = (k: string) => keys.some((a) => a.pubkey === k);
  const ok =
    !tx.meta?.err &&
    keys[0]?.pubkey === launch.creator &&
    keys.some((k) => k.pubkey === launch.mint && k.signer) &&
    tx.transaction.message.instructions.some((i) => i.programId === LAUNCHLAB_PROGRAM.toBase58()) &&
    has(STONK_PLATFORM.toBase58()) &&
    has(poolAddress(new PublicKey(launch.mint), new PublicKey(quote)).toBase58());
  return ok ? { state: "live", token: launch.mint } : { state: "failed", reason: "That transaction did not create this token." };
}
