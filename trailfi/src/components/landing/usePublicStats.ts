"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/fetcher";

export interface PublicStats {
  walkers: number;
  today: { walkers: number; steps: number; goalMet: number };
  series: Array<{ day: string; steps: number }>;
  paid: { total: number; count: number };
  dailyGoal: number;
  tokenSymbol: string;
  maxDaily: number;
  maxDailySteps: number;
  /** The Strydo token contract address; empty until the admin sets it. */
  projectCa: string;
}

/** Live community totals shared by the landing page cards. */
export function usePublicStats() {
  return useQuery({ queryKey: ["public-stats"], queryFn: () => api<PublicStats>("/api/stats"), refetchInterval: 60_000 });
}
