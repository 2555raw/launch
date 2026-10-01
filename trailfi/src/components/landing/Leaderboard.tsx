"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Footprints, Send } from "lucide-react";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtAmount, fmtSteps } from "@/lib/format";
import { Reveal, SectionHeading } from "./Reveal";

interface PublicPayout {
  wallet: string;
  amount: string;
  token: string;
  steps: number;
  paidAt: string;
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
}

/** Public payouts: empty until walkers are paid; wallets are always shortened by the API. */
export function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-payouts"],
    queryFn: async (): Promise<{ payouts: PublicPayout[] }> => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });
  const rows = data?.payouts ?? [];

  return (
    <section id="leaderboard" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="container">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading index="03" label="Payouts" title="Steps, turned into pay.">
            Every time a walker is paid, the payout shows up here.
          </SectionHeading>
          <Reveal className="flex items-center gap-2 lg:pb-3">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-neon" />
            <span className="label">Live</span>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-12">
          <div className="glass overflow-hidden rounded-3xl">
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="border-b border-white/10 bg-white/[0.02]">
                  <tr>
                    <th className="table-head">Status</th>
                    <th className="table-head">Wallet</th>
                    <th className="table-head">Steps</th>
                    <th className="table-head text-right">Received</th>
                    <th className="table-head text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="table-cell" colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-lime-300">
                          <Send className="h-5 w-5" />
                        </div>
                        <p className="mt-4 font-medium text-white/80">No payouts yet</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-white/45">
                          When walkers request their rewards and get paid, each payment appears here with the steps that earned it.
                        </p>
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
                    <motion.tr
                      key={`${r.wallet}-${r.paidAt}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                    >
                      <td className="table-cell">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                          <Check className="h-3 w-3" /> Paid
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <AddressAvatar address={r.wallet.replace("…", "0")} className="h-7 w-7" />
                          <span className="font-mono text-[13.5px]">{r.wallet}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="inline-flex items-center gap-2 font-mono tabular">
                          <Footprints className="h-3.5 w-3.5 text-lime-400/80" />
                          {fmtSteps(r.steps)}
                        </span>
                      </td>
                      <td className="table-cell text-right font-mono text-lime-300 tabular">
                        +{fmtAmount(r.amount)} <span className="text-white/40">{r.token}</span>
                      </td>
                      <td className="table-cell text-right text-[12.5px] text-white/45">{ago(r.paidAt)}</td>
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
