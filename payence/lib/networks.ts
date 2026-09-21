import type { AssetId } from "./assets";

/**
 * Networks the platform can settle on. The user never has to pick one to pay
 * (balances are ledger balances); networks matter for deposits, withdrawals and
 * the explorer link on a receipt.
 */
export type NetworkId = "base" | "base-sepolia" | "ethereum" | "polygon" | "solana";
export type ChainFamily = "evm" | "solana";

export type Network = {
  id: NetworkId;
  name: string;
  family: ChainFamily;
  chainId?: number;
  testnet: boolean;
  explorer: { tx: (hash: string) => string; address: (a: string) => string };
  /** Typical confirmation window shown to users, in seconds. */
  confirmationSeconds: number;
  confirmations: number;
  /** ERC-20 (or SPL) contract addresses per asset; absent means unsupported here. */
  tokens: Partial<Record<AssetId, string>>;
  /** Flat network fee charged to the user on withdrawal, in the asset's base units. */
  withdrawalFeeUnits: bigint;
};

const evmExplorer = (base: string) => ({
  tx: (h: string) => `${base}/tx/${h}`,
  address: (a: string) => `${base}/address/${a}`,
});

export const NETWORKS: Record<NetworkId, Network> = {
  base: {
    id: "base",
    name: "Base",
    family: "evm",
    chainId: 8453,
    testnet: false,
    explorer: evmExplorer("https://basescan.org"),
    confirmationSeconds: 4,
    confirmations: 2,
    tokens: {
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      EURC: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
    },
    withdrawalFeeUnits: 20_000n, // 0.02
  },
  "base-sepolia": {
    id: "base-sepolia",
    name: "Base Sepolia (testnet)",
    family: "evm",
    chainId: 84532,
    testnet: true,
    explorer: evmExplorer("https://sepolia.basescan.org"),
    confirmationSeconds: 4,
    confirmations: 1,
    tokens: {
      USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      EURC: "0x808456652fdb597867f38412077A9182bf77359F",
    },
    withdrawalFeeUnits: 0n,
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    family: "evm",
    chainId: 1,
    testnet: false,
    explorer: evmExplorer("https://etherscan.io"),
    confirmationSeconds: 60,
    confirmations: 12,
    tokens: {
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      EURC: "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
    },
    withdrawalFeeUnits: 3_000_000n, // 3.00
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    family: "evm",
    chainId: 137,
    testnet: false,
    explorer: evmExplorer("https://polygonscan.com"),
    confirmationSeconds: 10,
    confirmations: 30,
    tokens: {
      USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
    withdrawalFeeUnits: 50_000n, // 0.05
  },
  solana: {
    id: "solana",
    name: "Solana",
    family: "solana",
    testnet: false,
    explorer: {
      tx: (h) => `https://solscan.io/tx/${h}`,
      address: (a) => `https://solscan.io/account/${a}`,
    },
    confirmationSeconds: 2,
    confirmations: 1,
    tokens: {
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      EURC: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    },
    withdrawalFeeUnits: 10_000n, // 0.01
  },
};

export const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[];

export function isNetworkId(v: unknown): v is NetworkId {
  return typeof v === "string" && v in NETWORKS;
}

export function network(id: NetworkId): Network {
  return NETWORKS[id];
}

/** Networks on which a given asset can move. */
export function networksFor(assetId: AssetId, includeTestnets: boolean): Network[] {
  return NETWORK_IDS.map((id) => NETWORKS[id]).filter(
    (n) => n.tokens[assetId] && (includeTestnets || !n.testnet)
  );
}
