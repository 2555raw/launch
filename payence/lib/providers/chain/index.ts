import { config } from "@/lib/config";
import type { BlockchainProvider } from "../types";
import { SimulatedChain } from "./simulated";

let cached: BlockchainProvider | null = null;

/** One provider per process, chosen by CHAIN_PROVIDER. */
export function chain(): BlockchainProvider {
  if (cached) return cached;
  if (config.chain.provider === "evm") {
    // Loaded lazily so a simulated deployment never pulls viem into the bundle.
    const { EvmChain } = require("./evm") as typeof import("./evm");
    cached = new EvmChain();
  } else {
    cached = new SimulatedChain();
  }
  return cached;
}
