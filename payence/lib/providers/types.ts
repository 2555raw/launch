import type { AssetId } from "@/lib/assets";
import type { NetworkId } from "@/lib/networks";

/**
 * The seams. Every external system the platform depends on sits behind one of
 * these interfaces, so swapping a simulated implementation for a real vendor is
 * a change of one file plus an environment variable.
 */

export type ChainTransfer = {
  hash: string;
  network: NetworkId;
  asset: AssetId;
  amount: bigint;
  from: string;
  to: string;
  confirmations: number;
  blockNumber?: number;
  timestamp: number;
};

export interface BlockchainProvider {
  readonly name: string;
  /** True when funds do not really move on a public chain. */
  readonly simulated: boolean;
  /** A deposit address owned by the platform, dedicated to one user. */
  deriveDepositAddress(network: NetworkId, index: number): Promise<string>;
  /** Incoming transfers to the given addresses since a block cursor. */
  watchDeposits(network: NetworkId, addresses: string[], sinceBlock: number): Promise<{ transfers: ChainTransfer[]; block: number }>;
  /** Broadcast a withdrawal from the platform's hot wallet. */
  sendTransfer(input: { network: NetworkId; asset: AssetId; to: string; amount: bigint; idempotencyKey: string }): Promise<{ hash: string }>;
  getTransfer(network: NetworkId, hash: string): Promise<ChainTransfer | null>;
  /** Estimated network fee in the asset's base units, for display before signing. */
  estimateFee(network: NetworkId, asset: AssetId): Promise<bigint>;
  isValidAddress(network: NetworkId, address: string): boolean;
}

export type Quote = {
  from: string;
  to: string;
  /** Decimal string: 1 `from` buys this much `to`. */
  rate: string;
  asOf: number;
  source: string;
};

export interface ExchangeRateProvider {
  readonly name: string;
  quote(from: string, to: string): Promise<Quote>;
}

export type ComplianceDecision = {
  outcome: "allow" | "review" | "block";
  reason: string;
  /** Set when the decision opened a case a human must close. */
  caseId?: string;
};

export interface ComplianceProvider {
  readonly name: string;
  screenUser(input: { userId: string; name: string; country?: string | null }): Promise<ComplianceDecision>;
  screenTransaction(input: {
    userId: string;
    kind: "payment" | "withdrawal" | "deposit" | "transfer";
    fiatCents: bigint;
    currency: string;
    counterparty?: string;
    address?: string;
    network?: NetworkId;
  }): Promise<ComplianceDecision>;
  /** Identity verification handoff; returns where to send the user. */
  startKyc(input: { userId: string; email: string }): Promise<{ status: "pending" | "approved"; redirectUrl?: string }>;
}

export interface NotificationProvider {
  readonly name: string;
  send(input: { to: string; subject: string; text: string }): Promise<{ id: string; delivered: boolean }>;
}
