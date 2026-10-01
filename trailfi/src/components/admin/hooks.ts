"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetcher";

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
    updatedBy: string | null;
    updatedAt: string;
  };
  payoutWallets: string[];
  demoMode: boolean;
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
  amount: string;
  amountUnits: string;
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
