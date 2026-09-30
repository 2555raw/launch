import "server-only";
import { createHash } from "node:crypto";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { PUMP_PROGRAM } from "@/lib/onchain";
import type { Launch } from "@/lib/types";
import { LaunchError } from "./pads/types";

const PumpError = LaunchError;

/**
 * Pump.fun on Solana. The token is created by the person's own wallet:
 * the server uploads the metadata, asks PumpPortal for the unsigned create
 * transaction, relays the signed bytes to Solana and checks the result.
 * It never holds a private key.
 */

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const PORTAL_URL = "https://pumpportal.fun/api/trade-local";
const IPFS_URL = "https://pump.fun/api/ipfs";

export { LaunchError as PumpError };

export function isPublicKey(v: unknown): v is string {
  if (typeof v !== "string" || v.length < 32 || v.length > 44) return false;
  try {
    return new PublicKey(v).toBase58() === v;
  } catch {
    return false;
  }
}

export function messageHash(tx: VersionedTransaction) {
  return createHash("sha256").update(tx.message.serialize()).digest("hex");
}

function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new PumpError("The token image could not be read.");
  return new Blob([Buffer.from(m[2], "base64")], { type: m[1] });
}

/** Upload image + metadata to Pump.fun's IPFS and return the metadata URI. */
export async function uploadMetadata(launch: Launch, website: string): Promise<string> {
  if (!launch.image) throw new PumpError("Pump.fun needs a token image. Add one in Token details.");
  const blob = dataUrlToBlob(launch.image);
  const form = new FormData();
  form.append("file", blob, `token.${blob.type.split("/")[1]}`);
  form.append("name", launch.name);
  form.append("symbol", launch.ticker);
  form.append("description", launch.description ?? "");
  if (launch.x) form.append("twitter", launch.x);
  form.append("website", website);
  form.append("showName", "true");

  const res = await fetch(IPFS_URL, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  const data = res?.ok ? ((await res.json().catch(() => null)) as { metadataUri?: string } | null) : null;
  if (!data?.metadataUri) throw new PumpError("Pump.fun did not accept the token metadata. Try again in a moment.", 502);
  return data.metadataUri;
}

/** Ask PumpPortal for the unsigned create (+ optional dev buy) transaction. */
export async function buildCreateTx(opts: {
  creator: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  buySol: number;
}): Promise<VersionedTransaction> {
  const res = await fetch(PORTAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: opts.creator,
      action: "create",
      tokenMetadata: { name: opts.name, symbol: opts.symbol, uri: opts.uri },
      mint: opts.mint,
      denominatedInSol: "true",
      amount: opts.buySol,
      slippage: 10,
      priorityFee: 0.0005,
      pool: "pump",
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) {
    const detail = res ? (await res.text().catch(() => "")).slice(0, 200) : "";
    throw new PumpError(`Pump.fun could not build the transaction${detail ? `: ${detail}` : "."}`, 502);
  }
  const tx = VersionedTransaction.deserialize(new Uint8Array(await res.arrayBuffer()));
  assertCreateTx(tx, opts.creator, opts.mint);
  return tx;
}

/** The transaction must be paid by the creator, signed by the mint and call Pump.fun. */
export function assertCreateTx(tx: VersionedTransaction, creator: string, mint: string) {
  const { header, staticAccountKeys, compiledInstructions } = tx.message;
  const signers = staticAccountKeys.slice(0, header.numRequiredSignatures).map((k) => k.toBase58());
  const programs = compiledInstructions.map((i) => staticAccountKeys[i.programIdIndex]?.toBase58());
  if (signers[0] !== creator || !signers.includes(mint) || signers.length !== 2 || !programs.includes(PUMP_PROGRAM)) {
    throw new PumpError("The launch transaction did not match this draft.", 502);
  }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) throw new PumpError("Solana did not respond. Try again.", 502);
  const data = (await res.json().catch(() => null)) as {
    result?: T;
    error?: { message?: string; data?: { err?: unknown; logs?: string[] } };
  } | null;
  if (!data) throw new PumpError("Solana returned an unreadable response.", 502);
  if (data.error) {
    const detail = [JSON.stringify(data.error.data?.err ?? ""), ...(data.error.data?.logs ?? [])];
    throw new PumpError(friendlyRpcError(data.error.message ?? "", detail), 400);
  }
  return data.result as T;
}

function friendlyRpcError(message: string, logs: string[] = []) {
  const all = `${message} ${logs.join(" ")}`;
  if (/AccountNotFound|prior credit|insufficient (funds|lamports)|custom program error: 0x1\b/i.test(all)) return "Your wallet does not have enough SOL for this launch.";
  if (/Blockhash not found|block height exceeded/i.test(all)) return "The transaction expired before it was sent. Launch again to get a fresh one.";
  if (/slippage|TooMuchSolRequired|0x1772/i.test(all)) return "The opening buy moved past its slippage limit. Try again.";
  const last = logs.filter((l) => /error|failed/i.test(l)).pop();
  return `Solana rejected the transaction: ${(last ?? message).replace(/^Program log: /, "").slice(0, 160)}`;
}

export async function accountExists(address: string): Promise<boolean> {
  const r = await rpc<{ value: unknown | null }>("getAccountInfo", [address, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }]);
  return r.value !== null;
}

/** Relay fully signed bytes. Solana runs a preflight simulation first. */
export async function sendSigned(bytes: Uint8Array): Promise<string> {
  return rpc<string>("sendTransaction", [
    Buffer.from(bytes).toString("base64"),
    { encoding: "base64", preflightCommitment: "confirmed", maxRetries: 5 },
  ]);
}

export type ConfirmState = { state: "pending" } | { state: "failed"; reason: string } | { state: "live" };

/** Check a signature landed, succeeded, and really created this mint for this creator. */
export async function checkCreate(signature: string, creator: string, mint: string): Promise<ConfirmState> {
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
  const ok =
    !tx.meta?.err &&
    keys[0]?.pubkey === creator &&
    keys.some((k) => k.pubkey === mint && k.signer) &&
    tx.transaction.message.instructions.some((i) => i.programId === PUMP_PROGRAM);
  return ok ? { state: "live" } : { state: "failed", reason: "That transaction did not create this token." };
}

/** Market cap in USD from Dexscreener, once the token trades anywhere. */
export async function marketCapUsd(mint: string): Promise<number | null> {
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 60 },
  }).catch(() => null);
  if (!res?.ok) return null;
  const pairs = (await res.json().catch(() => [])) as { marketCap?: number; fdv?: number }[];
  const caps = pairs.map((p) => p.marketCap ?? p.fdv ?? 0).filter((n) => n > 0);
  return caps.length ? Math.max(...caps) : null;
}
