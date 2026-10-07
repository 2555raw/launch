"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetcher";
import { fmtAmount } from "@/lib/format";
import { fmtEth, isNativeToken } from "@/lib/web3/tokens";

export interface AdminOverview {
  users: { users: number; suspended: number; newWeek: number };
  today: { active: number; steps: number; goalMet: number };
  rewards: { pending: number; approved: number; processing: number; paid: number; distributed: number };
  payouts: { confirmed: number; inFlight: number; failed: number; requested: number };
  series: Array<{ day: string; steps: number; users: number }>;
  stepsAwaitingReview: number;
  newsletterSubscribers: number;
  settings: {
    rewardPercent: number;
    dailyStepGoal: number;
    maxRewardPerUser: number;
    stepCapMultiplier: number;
    distributionFrequency: "daily" | "weekly";
    payoutTokenSymbol: string;
    payoutTokenAddress: `0x${string}`;
    payoutTokenDecimals: number;
    estimatedDailyFees: number;
    redistributeExcess: boolean;
    tierMin: number;
    tierAvg: number;
    tierThreshold: number;
    tierMax: number;
    tierCap: number;
    ratePoints: [number, number][];
    referralBonus: number;
    dailyBudget: number;
    signupsPaused: boolean;
    weeklyPrize: number;
    projectCa: string;
    updatedBy: string | null;
    updatedAt: string;
  };
  payoutWallets: string[];
  demoMode: boolean;
  creditedToday: number;
  /** Dollar value held by the payout wallets (ETH valued at the current price); null when unknown. */
  payoutBalance: number | null;
  /** The same balance in the payout token itself (ETH for native payouts). */
  payoutTokenBalance: number | null;
  /** Current ETH/USD price when paying in native ETH, null otherwise or when no source answers. */
  ethUsdPrice: number | null;
  /** False when the payout token is not a contract on the payout network. */
  tokenReady: boolean;
  distributions: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    eligibleFees: number;
    rewardPercent: number;
    pool: number;
    totalAllocated: number;
    participants: number;
    tokenSymbol: string;
    createdBy: string;
    createdAt: string;
  }>;
}

export function useAdminMeta() {
  return useQuery({ queryKey: ["admin", "overview"], queryFn: () => api<AdminOverview>("/api/admin/overview"), refetchInterval: 30_000 });
}

export interface Payout {
  id: string;
  userId: string;
  userShortId: number;
  walletAddress: `0x${string}`;
  /** Token quantity to send: dollars for a stablecoin, ETH for native payouts. */
  amount: string;
  amountUnits: string;
  /** The dollar value the payout stands for (equal to amount for a stablecoin). */
  usdAmount: string;
  /** ETH/USD price the native amount was quoted at; null for ERC20 payouts. */
  ethUsdPrice: string | null;
  /** When the native amount was quoted; null for ERC20 payouts. */
  quotedAt: string | null;
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
  chainId: number;
  status: "requested" | "prepared" | "submitted" | "confirmed" | "failed" | "cancelled";
  simulated: boolean;
  txHash: string | null;
  fromAddress: string | null;
  gasUsed: string | null;
  error: string | null;
  preparedBy: string;
  createdAt: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  rewardCount: number;
  steps: number;
  requestedAt: string | null;
}

/** ETH kept aside per native transfer for gas when checking the sending wallet's balance (0.0002 ETH). */
export const NATIVE_GAS_MARGIN_WEI = 200_000_000_000_000n;

/** A native payout's ETH amount is quoted again before signing once its price is older than this. */
export const QUOTE_MAX_AGE_MS = 10 * 60_000;

/** Whether a native payout still waiting to be sent has a stale (or missing) ETH price. */
export function needsRequote(p: Payout): boolean {
  if (!isNativeToken(p.tokenAddress) || (p.status !== "requested" && p.status !== "prepared")) return false;
  return !p.quotedAt || Date.now() - new Date(p.quotedAt).getTime() > QUOTE_MAX_AGE_MS;
}

/** Gets a fresh ETH price for a native payout and recomputes its ETH amount (same dollars). Moves no funds. */
export async function requotePayout(id: string): Promise<Payout> {
  return (await api<{ payout: Payout }>(`/api/admin/payouts/${id}`, { method: "PATCH", json: { action: "requote" } })).payout;
}

/** A payout's token quantity for a list: "0.001234" for ETH (two decimals would read 0.00), "4.61" for a stablecoin. */
export function fmtPayoutAmount(p: Pick<Payout, "amount" | "tokenAddress">): string {
  return isNativeToken(p.tokenAddress) ? fmtEth(p.amount) : fmtAmount(p.amount);
}

/** "0.001234 ETH ≈ $4.61 at $3,736.12/ETH" for native payouts, "4.61 USDG" for a stablecoin. */
export function payoutAmountText(p: Payout): string {
  if (!isNativeToken(p.tokenAddress)) return `${fmtAmount(p.amount)} ${p.tokenSymbol}`;
  const price = p.ethUsdPrice ? ` at $${fmtAmount(p.ethUsdPrice)}/${p.tokenSymbol}` : "";
  return `${fmtEth(p.amount)} ${p.tokenSymbol} ≈ $${fmtAmount(p.usdAmount)}${price}`;
}
