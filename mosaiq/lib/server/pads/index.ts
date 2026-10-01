import "server-only";
import { argus } from "./argus";
import { flap } from "./flap";
import { four } from "./four";
import { pons } from "./pons";
import { pump } from "./pump";
import { stonk } from "./stonk";
import type { OnchainAdapter } from "./types";

const adapters: Record<string, OnchainAdapter> = { pump, pons, flap, four, argus, stonk };

export function onchainAdapter(pad: string): OnchainAdapter | null {
  return adapters[pad] ?? null;
}
