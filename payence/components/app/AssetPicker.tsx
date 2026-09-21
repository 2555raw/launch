"use client";

import { asset, type AssetId } from "@/lib/assets";
import { formatUnits } from "@/lib/money";

/** A radio group that looks like cards: bigger targets than a select on a phone. */
export function AssetPicker({
  name,
  assets,
  balances,
  value,
  onChange,
}: {
  name: string;
  assets: AssetId[];
  balances?: Record<string, bigint>;
  value: AssetId;
  onChange: (a: AssetId) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Asset" className="grid grid-cols-3 gap-2">
      {assets.map((a) => {
        const meta = asset(a);
        const selected = a === value;
        return (
          <label
            key={a}
            className={`cursor-pointer rounded-xl border px-3 py-3 text-center transition-colors ${
              selected ? "border-ink bg-ink text-canvas" : "border-hair hover:border-hairStrong"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={a}
              checked={selected}
              onChange={() => onChange(a)}
              className="sr-only"
            />
            <span className="block text-[14px] font-semibold">{meta.symbol}</span>
            {balances && (
              <span className={`mt-0.5 block text-[11.5px] tnum ${selected ? "text-canvas/60" : "text-muted"}`}>
                {formatUnits(balances[a] ?? 0n, meta.decimals, 2)}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
