import "server-only";
import { createPublicClient, http } from "viem";
import { env } from "@/lib/env";
import { getPayoutChain } from "./chains";

let client: ReturnType<typeof createPublicClient> | null = null;

/** Read-only RPC client used to verify signatures and payout transactions. */
export function publicClient() {
  if (!client) client = createPublicClient({ chain: getPayoutChain(), transport: http(env.rpcUrl || undefined) });
  return client;
}
