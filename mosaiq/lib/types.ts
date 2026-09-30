import type { ChainId } from "./pads";

/**
 * draft     saved from the studio, waiting for an agent
 * queued    an agent submitted it; the pad adapter has not confirmed yet
 * live      the pad confirmed the token and returned an address
 * failed    the adapter rejected it
 */
export type LaunchStatus = "draft" | "queued" | "live" | "failed";

export interface Launch {
  id: string;
  mode: "create" | "import";
  status: LaunchStatus;
  name: string;
  ticker: string;
  description?: string;
  image?: string;
  chain: ChainId;
  pad: string;
  pair: string;
  x?: string;
  website?: string;
  openingBuy?: string;
  address?: string;
  marketCapUsd: number | null;
  agentId?: string;
  agentName?: string;
  statusNote?: string;
  /** On-chain launches: the wallet that pays and signs. */
  creator?: string;
  /** On-chain launches: the mint the prepared transaction creates. */
  mint?: string;
  /** Pump.fun metadata JSON, uploaded once per draft. */
  metadataUri?: string;
  /** SHA-256 of the prepared transaction message, so only that message is relayed. */
  preparedHash?: string;
  signature?: string;
  createdAt: string;
  submittedAt?: string;
}

/** What the public API returns: drafts never leave the server this way. */
export type PublicLaunch = Omit<Launch, "agentId">;

export interface Agent {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
  lastSeenAt?: string;
  launches: number;
}

export interface PublicAgent {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

export interface Stats {
  marketCapUsd: number;
  totalLaunches: number;
  launches24h: number;
  byPad: Record<string, number>;
  series: { date: string; count: number }[];
}

export interface CreatorRank {
  name: string;
  launches: number;
}
