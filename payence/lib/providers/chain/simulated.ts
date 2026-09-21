import { createHash, randomBytes } from "crypto";
import type { BlockchainProvider, ChainTransfer } from "../types";
import { network, type NetworkId } from "@/lib/networks";
import type { AssetId } from "@/lib/assets";

/**
 * The development chain. It produces deterministic, well-formed addresses and
 * hashes so every screen, receipt and explorer link in the app can be exercised
 * end to end, and it never claims a transfer settled on a public network:
 * `simulated` is true, and the UI labels every artefact it produces.
 */
export class SimulatedChain implements BlockchainProvider {
  readonly name = "simulated";
  readonly simulated = true;

  async deriveDepositAddress(net: NetworkId, index: number): Promise<string> {
    const seed = createHash("sha256").update(`payence-sim:${net}:${index}`).digest();
    if (network(net).family === "solana") return base58(seed);
    return "0x" + seed.subarray(0, 20).toString("hex");
  }

  async watchDeposits(net: NetworkId, _addresses: string[], sinceBlock: number) {
    // Nothing arrives on its own here: simulated deposits are credited from the
    // app's developer tools, which call the deposit service directly.
    void net;
    return { transfers: [] as ChainTransfer[], block: sinceBlock };
  }

  async sendTransfer(input: { network: NetworkId; asset: AssetId; to: string; amount: bigint; idempotencyKey: string }) {
    const hash = createHash("sha256")
      .update(`${input.network}:${input.to}:${input.amount}:${input.idempotencyKey}`)
      .digest("hex");
    return { hash: network(input.network).family === "solana" ? base58(Buffer.from(hash, "hex")) : `0x${hash}` };
  }

  async getTransfer(): Promise<ChainTransfer | null> {
    return null;
  }

  async estimateFee(net: NetworkId): Promise<bigint> {
    return network(net).withdrawalFeeUnits;
  }

  isValidAddress(net: NetworkId, address: string): boolean {
    if (network(net).family === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(buf: Buffer): string {
  let n = BigInt("0x" + buf.toString("hex"));
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  return out.padStart(43, "1");
}

export function randomHash(): string {
  return "0x" + randomBytes(32).toString("hex");
}
