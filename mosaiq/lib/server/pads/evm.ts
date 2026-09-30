import "server-only";
import { createPublicClient, defineChain, getAddress, http, isAddress, type Address, type Hex, type PublicClient, type TransactionReceipt } from "viem";
import { evmChains } from "@/lib/onchain";
import { LaunchError, type EvmCall, type VerifyResult } from "./types";

const clients = new Map<string, PublicClient>();

export function evmClient(chainKey: string): PublicClient {
  const c = evmChains[chainKey];
  if (!c) throw new LaunchError(`Unknown EVM chain ${chainKey}.`, 500);
  let client = clients.get(chainKey);
  if (!client) {
    const rpc = process.env[`RPC_URL_${chainKey.toUpperCase()}`] || c.rpcUrl;
    client = createPublicClient({
      chain: defineChain({ id: c.chainId, name: c.chainName, nativeCurrency: c.nativeCurrency, rpcUrls: { default: { http: [rpc] } } }),
      transport: http(rpc, { timeout: 20_000 }),
    }) as PublicClient;
    clients.set(chainKey, client);
  }
  return client;
}

export function assertEvmAddress(v: string): Address {
  if (!isAddress(v, { strict: false })) throw new LaunchError("creator must be an EVM wallet address (0x…).", 422);
  return v as Address;
}

export const hex = (n: bigint): Hex => `0x${n.toString(16)}`;

export function call(to: Address, data: Hex, value: bigint, label: string): EvmCall {
  return { to, data, value: hex(value), label };
}

/** Fail early with a clear message when the wallet cannot cover value plus a little gas. */
export async function assertBalance(chainKey: string, owner: Address, value: bigint) {
  const c = evmChains[chainKey];
  const balance = await evmClient(chainKey).getBalance({ address: owner }).catch(() => null);
  if (balance === null || balance > value) return;
  const need = Number(value) / 10 ** c.nativeCurrency.decimals;
  throw new LaunchError(`Your wallet needs more than ${need} ${c.nativeCurrency.symbol} on ${c.chainName} for this launch, plus gas.`);
}

/** Turn a simulation revert into one readable line. */
export function simulationError(err: unknown): LaunchError {
  const msg = (err as { shortMessage?: string; message?: string })?.shortMessage ?? (err as Error)?.message ?? "";
  if (/insufficient funds|exceeds balance|transfer amount exceeds/i.test(msg)) return new LaunchError("Your wallet does not have enough funds for this launch.");
  const reason = /reverted with (?:the following reason|custom error)[^:]*:\s*([^\n]+)/i.exec(msg)?.[1] ?? /Error: ([A-Za-z0-9_]+\([^)]*\))/.exec(msg)?.[1];
  return new LaunchError(`The launchpad rejected this launch${reason ? `: ${reason.trim().slice(0, 140)}` : "."}`);
}

/**
 * Receipt checks shared by every EVM pad: the transaction must have succeeded,
 * been sent by the creator to the pad's contract, and emitted its creation event.
 */
export async function verifyEvm(
  chainKey: string,
  hash: string,
  expected: { from: string; to: string[] },
  tokenFrom: (receipt: TransactionReceipt) => string | null,
): Promise<VerifyResult> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new LaunchError("Pass the transaction hash.", 422);
  const client = evmClient(chainKey);
  const receipt = await client.getTransactionReceipt({ hash: hash as Hex }).catch(() => null);
  if (!receipt) return { state: "pending" };
  if (receipt.status !== "success") return { state: "failed", reason: "The transaction reverted on-chain." };
  const to = receipt.to?.toLowerCase();
  if (receipt.from.toLowerCase() !== expected.from.toLowerCase() || !to || !expected.to.some((a) => a.toLowerCase() === to)) {
    return { state: "failed", reason: "That transaction was not this launch." };
  }
  const token = tokenFrom(receipt);
  return token ? { state: "live", token: getAddress(token) } : { state: "failed", reason: "The transaction did not create a token." };
}

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
