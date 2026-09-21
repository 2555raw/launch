"use client";

import { useState } from "react";
import { asset, type AssetId } from "@/lib/assets";
import { formatUnits } from "@/lib/money";

/**
 * The amount keypad-friendly input. It is `inputMode="decimal"` so phones show
 * a number pad, it never coerces to a float, and it shows the balance it is
 * spending from with a one-tap Max.
 */
export function AmountInput({
  assetId,
  available,
  name = "amount",
  autoFocus,
}: {
  assetId: AssetId;
  available: bigint;
  name?: string;
  autoFocus?: boolean;
}) {
  const a = asset(assetId);
  const [value, setValue] = useState("");
  const max = formatUnits(available, a.decimals);
  const over = (() => {
    if (!value) return false;
    const n = Number(value);
    return Number.isFinite(n) && n > Number(max);
  })();

  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
          over ? "border-danger" : "border-hairStrong focus-within:border-ink"
        }`}
      >
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ""))}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          required
          aria-label={`Amount in ${a.symbol}`}
          aria-invalid={over}
          placeholder="0.00"
          className="tnum w-full bg-transparent text-[30px] font-bold tracking-tight outline-none placeholder:text-faint"
        />
        <span className="shrink-0 text-[15px] font-semibold text-muted">{a.symbol}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[12.5px]">
        <span className={over ? "text-danger" : "text-muted"}>
          {over ? "More than your available balance." : `${max} ${a.symbol} available`}
        </span>
        <button
          type="button"
          onClick={() => setValue(max)}
          className="rounded-pill border border-hair px-2.5 py-1 font-medium text-ink transition-colors hover:border-hairStrong"
        >
          Max
        </button>
      </div>
    </div>
  );
}
