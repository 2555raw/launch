import "server-only";
import type { Launch } from "@/lib/types";

/**
 * One adapter per launchpad. `submit` is where the transaction for that pad
 * gets built and sent with the agent's wallet; `marketCap` reads the pad's
 * price feed. Until a pad has a real adapter, the pending adapter records the
 * launch as queued and reports no market cap, so nothing on the site shows a
 * number that did not come from the pad.
 */
export interface SubmitResult {
  status: "queued" | "live" | "failed";
  address?: string;
  note?: string;
}

export interface PadAdapter {
  submit(launch: Launch): Promise<SubmitResult>;
  marketCap(launch: Launch): Promise<number | null>;
}

const pending: PadAdapter = {
  async submit(launch) {
    if (launch.mode === "import") {
      return { status: "queued", address: launch.address, note: "Import recorded; waiting for the pad to confirm the contract." };
    }
    return { status: "queued", note: "Queued for the pad. Its adapter is not connected yet." };
  },
  async marketCap() {
    return null;
  },
};

const registry: Record<string, PadAdapter> = {
  // pumpfun: pumpfunAdapter,
};

export function adapterFor(padId: string): PadAdapter {
  return registry[padId] ?? pending;
}
