"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { xIntent } from "@/lib/social";
import { useSession } from "./SessionProvider";

interface Notice {
  kind: "verified" | "rejected" | "paid";
  id: string;
  day?: string;
  steps?: number;
  amount?: string | null;
  note?: string | null;
  txUrl?: string | null;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Opens an X post with the payout's share card; the link carries the walker's invite code. */
export function sharePayout(id: string, amount: string, referralCode?: string | null) {
  const url = `${window.location.origin}/paid/${id}${referralCode ? `?ref=${referralCode}` : ""}`;
  window.open(xIntent(`I just got paid $${Number(amount).toFixed(2)} in ETH for walking 👟 Walk, get paid:`, url), "_blank", "noopener,noreferrer");
}

/**
 * Tells a signed-in walker what happened since their last visit: uploads that were
 * verified or rejected, and payouts that landed. Each notice shows once.
 */
export function Notices() {
  const { status } = useSession();
  const qc = useQueryClient();
  const busy = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    const check = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await fetch("/api/me/notices", { cache: "no-store" });
        if (!res.ok) return;
        const { notices, referralCode } = (await res.json()) as { notices: Notice[]; referralCode: string | null };
        if (!notices.length) return;
        notices.forEach((n, i) => {
          setTimeout(() => {
            if (n.kind === "verified") {
              toast.success(`Your steps for ${fmtDay(n.day!)} are verified`, {
                description: n.amount ? `+$${Number(n.amount).toFixed(2)} credited to your balance.` : `${n.steps?.toLocaleString("en-US")} steps counted.`,
                duration: 10_000,
                action: { label: "Dashboard", onClick: () => window.location.assign("/dashboard") },
              });
            } else if (n.kind === "rejected") {
              toast.error(`Your upload for ${fmtDay(n.day!)} was not accepted`, {
                description: n.note ? `Reason: ${n.note}` : "The screenshot did not match the steps or the date.",
                duration: 12_000,
              });
            } else {
              toast.success(`You got paid $${Number(n.amount).toFixed(2)} in ETH`, {
                description: "It's in your wallet on Robinhood Chain.",
                duration: 15_000,
                action: { label: "Share on X", onClick: () => sharePayout(n.id, n.amount ?? "0", referralCode) },
              });
            }
          }, i * 600);
        });
        await fetch("/api/me/notices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entries: notices.filter((n) => n.kind !== "paid").map((n) => n.id),
            payouts: notices.filter((n) => n.kind === "paid").map((n) => n.id),
          }),
        });
        await qc.invalidateQueries({ queryKey: ["me"] });
      } finally {
        busy.current = false;
      }
    };
    void check();
    const t = setInterval(check, 120_000);
    return () => clearInterval(t);
  }, [status, qc]);

  return null;
}
