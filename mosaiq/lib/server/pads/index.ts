import "server-only";
import { argus } from "./argus";
import { pons } from "./pons";
import { pump } from "./pump";
import { stonk } from "./stonk";
import type { OnchainAdapter } from "./types";

const adapters: Record<string, OnchainAdapter> = { pump, pons, argus, stonk };

export function onchainAdapter(pad: string): OnchainAdapter | null {
  return adapters[pad] ?? null;
}
