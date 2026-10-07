"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Crown, Trophy } from "lucide-react";
import { MarkIcon } from "@/components/Logo";
import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";
import { fmtSteps } from "@/lib/format";
import { Reveal, SectionHeading } from "./Reveal";

interface Row {
  rank: number;
  wallet: string;
  steps: number;
  days: number;
  you: boolean;
}
interface Ranking {
  weekStart: string;
  weekEnd: string;
  walkers: number;
  rows: Row[];
  me: Row | null;
  prize: number;
  prizeAwarded: boolean;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Days left until the week resets (Monday 00:00 UTC). */
function resetsIn() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const left = (8 - (day === 0 ? 7 : day)) % 7 || 7;
  return left === 1 ? "Resets tonight, 00:00 UTC" : `Resets in ${left} days`;
}

const PODIUM = [
  { tone: "from-lime-300/25 to-lime-400/5 border-lime-400/40", text: "text-lime-300", label: "1st" },
  { tone: "from-white/15 to-white/[0.02] border-white/20", text: "text-white/85", label: "2nd" },
  { tone: "from-amber-300/15 to-amber-400/[0.02] border-amber-300/25", text: "text-amber-200/90", label: "3rd" },
];

/** Top walkers of the week by verified steps. Wallets are shortened by the API. */
export function WeeklyRanking() {
  const [week, setWeek] = useState<"this" | "last">("this");
  const { data, isLoading } = useQuery({
    queryKey: ["weekly-ranking", week],
    queryFn: async (): Promise<Ranking> => {
      const res = await fetch(`/api/leaderboard/weekly?week=${week}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 60_000,
  });
  const rows = data?.rows ?? [];
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const leader = Math.max(1, rows[0]?.steps ?? 1);
  const meOutside = data?.me && !rows.some((r) => r.you) ? data.me : null;

  return (
    <section id="ranking" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="container">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading index="03" label="Ranking" title="Top walkers" accent="this week.">
            Ranked by verified steps from Monday to Sunday. Only the first and last characters of each wallet are shown.
          </SectionHeading>
          <Reveal className="flex flex-col items-start gap-3 lg:items-end lg:pb-3">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-[13px]">
              {(["this", "last"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWeek(w)}
                  className={cn("relative rounded-full px-4 py-1.5 font-medium transition", week === w ? "text-ink-950" : "text-white/60 hover:text-white")}
                >
                  {week === w && <motion.span layoutId="rank-tab" className="absolute inset-0 rounded-full bg-lime-400" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                  <span className="relative">{w === "this" ? "This week" : "Last week"}</span>
                </button>
              ))}
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
              {data ? `${fmtDay(data.weekStart)} to ${fmtDay(data.weekEnd)}` : "…"} · {week === "this" ? resetsIn() : "Final"}
            </span>
          </Reveal>
        </div>

        {data && data.prize > 0 && (
          <Reveal className="mt-10">
            <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-lime-400/35 bg-gradient-to-r from-lime-400/[0.12] via-lime-400/[0.05] to-transparent p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-ink-950">
                  <Trophy className="h-6 w-6" />
                </span>
                <div>
                  <div className="font-display text-xl font-bold sm:text-2xl">
                    Most steps this week wins <span className="text-lime-300">${data.prize % 1 ? data.prize.toFixed(2) : data.prize}</span>
                  </div>
                  <div className="text-[13.5px] text-white/55">
                    Every Monday the walker with the most verified steps gets a bonus in USDG, on top of their daily pay.
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-2 whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.14em] text-lime-300">
                <TokenIcon symbol="USDG" /> {week === "this" ? resetsIn() : data.prizeAwarded ? "Prize awarded" : "Winner being paid"}
              </span>
            </div>
          </Reveal>
        )}

        <Reveal delay={0.1} className="mt-8">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-3xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="glass rounded-3xl px-6 py-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-lime-300">
                <Trophy className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium text-white/80">{week === "this" ? "The week is wide open" : "No verified steps last week"}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-white/45">
                Upload your steps and, once they&apos;re verified, you&apos;ll show up here.
              </p>
              <Link href="/steps" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-lime-300 hover:text-lime-200">
                Upload your steps <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              {/* Podium */}
              <div className="grid gap-4 md:grid-cols-3">
                {top.map((r, i) => (
                  <motion.div
                    key={`${week}-${r.wallet}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={cn(
                      "relative overflow-hidden rounded-3xl border bg-gradient-to-b p-6",
                      PODIUM[Math.min(r.rank, 3) - 1].tone,
                      r.you && "ring-2 ring-lime-400/70",
                      i === 0 && "md:order-2",
                      i === 1 && "md:order-1",
                      i === 2 && "md:order-3",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.16em]", PODIUM[Math.min(r.rank, 3) - 1].text)}>
                        {r.rank === 1 && <Crown className="h-4 w-4" />} {PODIUM[Math.min(r.rank, 3) - 1].label}
                      </span>
                      {r.you && <span className="rounded-full bg-lime-400 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ink-950">You</span>}
                    </div>
                    {r.rank === 1 && data && data.prize > 0 && (
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-lime-400 px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-ink-950">
                        <Trophy className="h-3.5 w-3.5" /> {week === "this" ? "On track for" : "Won"} ${data.prize % 1 ? data.prize.toFixed(2) : data.prize}
                      </div>
                    )}
                    <div className="mt-5 flex items-center gap-3">
                      <AddressAvatar address={r.wallet.replace("…", "0")} className="h-10 w-10" />
                      <span className="font-mono text-[14px] text-white/85">{r.wallet}</span>
                    </div>
                    <div className="mt-5 font-display text-4xl font-bold tracking-tight tabular">{fmtSteps(r.steps)}</div>
                    <div className="mt-1 text-[13px] text-white/50">
                      steps · {r.days} {r.days === 1 ? "day" : "days"} walked
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 4th and down, plus you if you're further back */}
              {(rest.length > 0 || meOutside) && (
                <div className="glass mt-4 overflow-hidden rounded-3xl">
                  {[...rest, ...(meOutside ? [meOutside] : [])].map((r, i) => (
                    <div
                      key={`${week}-${r.wallet}-${i}`}
                      className={cn(
                        "flex items-center gap-4 border-b border-white/5 px-5 py-3.5 last:border-0",
                        r.you && "bg-lime-400/[0.07]",
                        r === meOutside && "border-t border-dashed border-white/10",
                      )}
                    >
                      <span className="w-8 font-mono text-[13px] text-white/45">#{r.rank}</span>
                      <AddressAvatar address={r.wallet.replace("…", "0")} className="h-7 w-7" />
                      <span className="w-32 font-mono text-[13.5px]">{r.wallet}</span>
                      {r.you && <span className="rounded-full bg-lime-400 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ink-950">You</span>}
                      <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                        <div className="h-full rounded-full bg-gradient-to-r from-lime-500/70 to-lime-300/70" style={{ width: `${(r.steps / leader) * 100}%` }} />
                      </div>
                      <span className="ml-auto flex items-center gap-2 font-mono text-[13.5px] tabular sm:ml-0 sm:w-28 sm:justify-end">
                        <MarkIcon className="h-3.5 w-3.5 text-lime-400/80" /> {fmtSteps(r.steps)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-center text-[12.5px] text-white/40">
                {data?.walkers} {data?.walkers === 1 ? "walker" : "walkers"} with verified steps {week === "this" ? "so far this week" : "last week"}
              </p>
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
