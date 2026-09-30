"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { DemoBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { DEMO_LEADERBOARD } from "@/lib/demo-data";
import { fmtAmount, fmtSteps } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Reveal, SectionHeading } from "./Reveal";

interface Row {
  rank: number;
  wallet: string;
  steps: number;
  rewards: number;
}

const MEDALS = ["from-amber-200 to-amber-500", "from-slate-100 to-slate-400", "from-orange-300 to-orange-700"];

export function Leaderboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async (): Promise<{ demo: boolean; rows: Row[]; tokenSymbol: string }> => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 60_000,
  });
  // If the API is unreachable, fall back to the (clearly labelled) demo table.
  const rows = data?.rows ?? (isError ? DEMO_LEADERBOARD : []);
  const demo = data?.demo ?? true;
  const max = Math.max(1, ...rows.map((r) => r.steps));

  return (
    <section id="leaderboard" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="container">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading index="03" label="Leaderboard" title="Today's trailblazers." />
          <Reveal className="flex items-center gap-3 lg:pb-3">
            {demo && <DemoBadge>Demo · fictional wallets</DemoBadge>}
            <span className="label">Resets 00:00 UTC</span>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-12">
          <div className="glass overflow-hidden rounded-3xl">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-white/10 bg-white/[0.02]">
                  <tr>
                    <th className="table-head w-20">Rank</th>
                    <th className="table-head">Wallet</th>
                    <th className="table-head">Daily steps</th>
                    <th className="table-head text-right">Rewards earned</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="table-cell" colSpan={4}>
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))}
                  {rows.map((r, i) => (
                    <motion.tr
                      key={`${r.rank}-${r.wallet}`}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className={cn("group border-b border-white/5 transition hover:bg-white/[0.035]", i < 3 && "bg-lime-400/[0.02]")}
                    >
                      <td className="table-cell">
                        {i < 3 ? (
                          <span className={cn("grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br font-display text-sm font-bold text-ink-950", MEDALS[i])}>
                            {r.rank}
                          </span>
                        ) : (
                          <span className="pl-2.5 font-mono text-sm text-white/45">{String(r.rank).padStart(2, "0")}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <AddressAvatar address={r.wallet.replace("…", "0")} className="h-7 w-7" />
                          <span className="font-mono text-[13.5px]">{r.wallet}</span>
                          {i === 0 && <Trophy className="h-4 w-4 text-amber-300" />}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <span className="w-16 font-mono tabular">{fmtSteps(r.steps)}</span>
                          <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-white/10 sm:block">
                            <div className="h-full rounded-full bg-gradient-to-r from-lime-500 to-neon" style={{ width: `${(r.steps / max) * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-right font-mono text-lime-300 tabular">
                        {fmtAmount(r.rewards)} <span className="text-white/40">{data?.tokenSymbol ?? "USDC"}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
