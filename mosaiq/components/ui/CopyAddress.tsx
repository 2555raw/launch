"use client";

import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { useCopy } from "./useCopy";

/** A token's contract address (CA): shortened or full, copied on click. */
export function CopyAddress({ address, full, className }: { address: string; full?: boolean; className?: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        copy(address);
      }}
      title={address}
      aria-label={`Copy contract address ${address}`}
      className={cn("inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-fog transition-colors hover:text-bone", className)}
    >
      <span className={full ? "min-w-0 break-all text-left" : "truncate"}>{full ? address : shortAddress(address)}</span>
      {copied ? <Check className="size-3.5 shrink-0 text-mint" aria-hidden="true" /> : <Copy className="size-3.5 shrink-0" aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}
