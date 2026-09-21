import { createPublicClient, createWalletClient, http, parseAbi, getAddress, isAddress, type Address } from "viem";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";
import type { BlockchainProvider, ChainTransfer } from "../types";
import { network, type NetworkId } from "@/lib/networks";
import { asset, type AssetId } from "@/lib/assets";
import { config } from "@/lib/config";

const ERC20 = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

/**
 * Real EVM settlement over viem. It reads deposits from ERC-20 Transfer logs and
 * sends withdrawals from a hot wallet key.
 *
 * The key handling here is the development shape: HOT_WALLET_PRIVATE_KEY in the
 * environment. Before real money, that signer must move behind a KMS/HSM or a
 * custody provider (Fireblocks, Turnkey, Coinbase Prime) and this class keeps
 * only the call into it. See ARCHITECTURE.md.
 */
export class EvmChain implements BlockchainProvider {
  readonly name = "evm";
  readonly simulated = false;

  private client(net: NetworkId) {
    const n = network(net);
    if (n.family !== "evm") throw new Error(`${net} is not an EVM network`);
    if (!config.chain.rpcUrl) throw new Error("CHAIN_RPC_URL is not set");
    return createPublicClient({ transport: http(config.chain.rpcUrl) });
  }

  private tokenAddress(net: NetworkId, assetId: AssetId): Address {
    const addr = network(net).tokens[assetId];
    if (!addr) throw new Error(`${assetId} is not deployed on ${net}`);
    return getAddress(addr);
  }

  async deriveDepositAddress(_net: NetworkId, index: number): Promise<string> {
    if (!config.chain.depositMnemonic) throw new Error("DEPOSIT_MNEMONIC is not set");
    return mnemonicToAccount(config.chain.depositMnemonic, { addressIndex: index }).address;
  }

  async watchDeposits(net: NetworkId, addresses: string[], sinceBlock: number) {
    const client = this.client(net);
    const head = Number(await client.getBlockNumber());
    if (!addresses.length || head <= sinceBlock) return { transfers: [] as ChainTransfer[], block: head };
    const watched = new Set(addresses.map((a) => a.toLowerCase()));
    const transfers: ChainTransfer[] = [];
    const n = network(net);
    for (const [assetId, token] of Object.entries(n.tokens) as [AssetId, string][]) {
      const logs = await client.getLogs({
        address: getAddress(token),
        event: ERC20[0],
        fromBlock: BigInt(sinceBlock + 1),
        toBlock: BigInt(head),
      });
      for (const log of logs) {
        const to = (log.args.to as string | undefined)?.toLowerCase();
        if (!to || !watched.has(to)) continue;
        transfers.push({
          hash: log.transactionHash!,
          network: net,
          asset: assetId,
          amount: log.args.value as bigint,
          from: (log.args.from as string) ?? "",
          to,
          confirmations: head - Number(log.blockNumber),
          blockNumber: Number(log.blockNumber),
          timestamp: Date.now(),
        });
      }
    }
    return { transfers, block: head };
  }

  async sendTransfer(input: { network: NetworkId; asset: AssetId; to: string; amount: bigint }) {
    if (!config.chain.hotWalletKey) throw new Error("HOT_WALLET_PRIVATE_KEY is not set");
    const account = privateKeyToAccount(config.chain.hotWalletKey as `0x${string}`);
    const wallet = createWalletClient({ account, transport: http(config.chain.rpcUrl) });
    const hash = await wallet.writeContract({
      address: this.tokenAddress(input.network, input.asset),
      abi: ERC20,
      functionName: "transfer",
      args: [getAddress(input.to), input.amount],
      chain: null,
    });
    return { hash };
  }

  async getTransfer(net: NetworkId, hash: string): Promise<ChainTransfer | null> {
    const client = this.client(net);
    const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null);
    if (!receipt) return null;
    const head = Number(await client.getBlockNumber());
    return {
      hash,
      network: net,
      asset: "USDC",
      amount: 0n,
      from: receipt.from,
      to: receipt.to ?? "",
      confirmations: head - Number(receipt.blockNumber),
      blockNumber: Number(receipt.blockNumber),
      timestamp: Date.now(),
    };
  }

  async estimateFee(net: NetworkId, assetId: AssetId): Promise<bigint> {
    // Gas is paid in the chain's native asset; the user is quoted a flat fee in
    // their stablecoin, which the platform absorbs the variance on.
    void assetId;
    return network(net).withdrawalFeeUnits;
  }

  isValidAddress(_net: NetworkId, address: string): boolean {
    return isAddress(address);
  }
}
