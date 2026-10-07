"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { usePublicStats } from "./usePublicStats";

/** The Strydo token contract address with a copy button. Hidden until the admin sets one. */
export function ContractAddress({ className }: { className?: string }) {
  const { data } = usePublicStats();
  const [copied, setCopied] = useState(false);
  const ca = data?.projectCa;
  if (!ca) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      toast.success("CA copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select the address and copy it by hand.");
    }
  };

  return (
    <div
      className={cn(
        "flex w-fit max-w-full items-center gap-2 rounded-full border border-lime-400/30 bg-ink-950/70 py-1.5 pl-1.5 pr-1.5 backdrop-blur",
        className,
      )}
    >
      <span className="shrink-0 rounded-full bg-lime-400 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-ink-950">CA</span>
      <span className="min-w-0 font-mono text-[13px] text-white/85" title={ca}>
        {/* Phones get a shortened address so the pill never widens the page; copy always takes the full one. */}
        <span className="sm:hidden">{ca.length > 18 ? `${ca.slice(0, 8)}…${ca.slice(-6)}` : ca}</span>
        <span className="hidden select-all sm:inline">{ca}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy contract address"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-lime-300"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
