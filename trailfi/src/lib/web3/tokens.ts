import { arbitrum, base, baseSepolia, mainnet, optimism, polygon, sepolia } from "viem/chains";

export interface PayoutToken {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

/** Well-known stablecoins per chain, offered as presets in the admin settings. */
export const KNOWN_TOKENS: Record<number, PayoutToken[]> = {
  [mainnet.id]: [
    { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
    { symbol: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
  ],
  [base.id]: [{ symbol: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 }],
  [arbitrum.id]: [
    { symbol: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6 },
  ],
  [optimism.id]: [{ symbol: "USDC", address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6 }],
  [polygon.id]: [{ symbol: "USDC", address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", decimals: 6 }],
  [sepolia.id]: [{ symbol: "USDC", address: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", decimals: 6 }],
  [baseSepolia.id]: [{ symbol: "USDC", address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e", decimals: 6 }],
};

export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;
