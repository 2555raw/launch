"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { fmtAmount } from "@/lib/format";

interface PublicPayout {
  wallet: string;
  amount: string;
  usdAmount?: string;
  token: string;
  paidAt: string;
  txUrl: string | null;
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
}

/**
 * A running strip of the latest real payouts, each linking to its transaction. It shares the
 * leaderboard's query, so it costs no extra request, and hides itself until the first payout.
 */
export function PayoutTicker() {
  const { data } = useQuery({
    queryKey: ["public-payouts"],
    queryFn: async (): Promise<{ payouts: PublicPayout[] }> => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });
  const rows = data?.payouts ?? [];
  if (rows.length === 0) return null;
  // Repeat short lists so the strip always fills the screen before it loops.
  const loop = Array.from({ length: Math.max(2, Math.ceil(8 / rows.length)) }, () => rows).flat();

  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-ink-950/80 py-3 backdrop-blur" aria-label="Latest payouts">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink-950 to-transparent" />
      <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
        {[...loop, ...loop].map((p, i) => (
          <a
            key={i}
            href={p.txUrl ?? "#leaderboard"}
            target={p.txUrl ? "_blank" : undefined}
            rel="noreferrer"
            className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] py-1.5 pl-1.5 pr-3.5 text-[13px] text-white/70 transition hover:border-lime-400/40 hover:text-white"
          >
            <AddressAvatar address={p.wallet.replace("…", "0")} className="h-6 w-6" />
            <span className="font-mono">{p.wallet}</span>
            <span>got paid</span>
            <span className="flex items-center gap-1 font-mono font-semibold text-lime-300">
              +${fmtAmount(p.usdAmount ?? p.amount)} <span className="font-sans font-normal text-white/45">in</span> <TokenIcon symbol={p.token} className="h-3.5 w-3.5" />
            </span>
            <span className="text-white/35">{ago(p.paidAt)}</span>
            {p.txUrl && <ArrowUpRight className="h-3.5 w-3.5 text-white/35" />}
          </a>
        ))}
      </div>
    </div>
  );
}
