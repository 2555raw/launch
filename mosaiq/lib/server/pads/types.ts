import "server-only";
import type { Launch } from "@/lib/types";

/**
 * One adapter per launchpad that launches on-chain. `prepare` builds the
 * unsigned transaction(s) for the creator's wallet; `verify` checks a sent
 * transaction on-chain and returns the new token's contract address.
 */
export interface EvmCall {
  to: `0x${string}`;
  data: `0x${string}`;
  /** Wei as a 0x-prefixed hex string. */
  value: `0x${string}`;
  label: string;
}

export type Prepared =
  | { kind: "evm"; chainId: number; calls: EvmCall[] }
  | { kind: "solana"; transaction: string; mint: string; messageHash: string };

export interface PrepareContext {
  creator: string;
  /** Solana only: public key of the fresh mint keypair the browser generated. */
  mint?: string;
  origin: string;
  /** Public URL of the token image hosted by this site. */
  imageUrl: string;
  /** Public URL of a metadata JSON hosted by this site (name, symbol, description, image, links). */
  metadataUrl: string;
}

export type VerifyResult = { state: "pending" } | { state: "failed"; reason: string } | { state: "live"; token: string };

export interface OnchainAdapter {
  wallet: "evm" | "solana";
  prepare(launch: Launch, ctx: PrepareContext): Promise<{ prepared: Prepared; metadataUri?: string }>;
  verify(launch: Launch, tx: string): Promise<VerifyResult>;
}

export class LaunchError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
