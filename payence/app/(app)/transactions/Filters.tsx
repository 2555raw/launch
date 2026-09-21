"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icons";
import { ASSET_IDS } from "@/lib/assets";

/**
 * Filters as a plain GET form: the result is a URL, so a filtered view can be
 * bookmarked, shared with support, and reloaded without client state.
 */
export function TransactionFilters({ defaults }: { defaults: Record<string, string | undefined> }) {
  const [open, setOpen] = useState(
    Boolean(defaults.asset || defaults.status || defaults.type || defaults.from || defaults.to)
  );

  return (
    <form method="get" className="card px-4 py-3.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            name="q"
            defaultValue={defaults.q ?? ""}
            placeholder="Search merchant, note or hash"
            aria-label="Search transactions"
            className="h-11 w-full rounded-xl border border-hair bg-canvas pl-9 pr-3 text-[14px] outline-none transition-colors focus:border-ink"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="h-11 shrink-0 rounded-xl border border-hair px-3.5 text-[13px] font-medium transition-colors hover:border-hairStrong"
        >
          Filters
        </button>
        <button type="submit" className="h-11 shrink-0 rounded-xl bg-ink px-4 text-[13px] font-medium text-canvas">
          Apply
        </button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-hair pt-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="block text-[12px] text-muted">Asset</span>
            <select name="asset" defaultValue={defaults.asset ?? ""} className="h-10 w-full rounded-lg border border-hair bg-canvas px-2.5 text-[13px]">
              <option value="">Any</option>
              {ASSET_IDS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-[12px] text-muted">Status</span>
            <select name="status" defaultValue={defaults.status ?? ""} className="h-10 w-full rounded-lg border border-hair bg-canvas px-2.5 text-[13px]">
              <option value="">Any</option>
              {["completed", "processing", "pending", "failed", "cancelled", "expired"].map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-[12px] text-muted">Type</span>
            <select name="type" defaultValue={defaults.type ?? ""} className="h-10 w-full rounded-lg border border-hair bg-canvas px-2.5 text-[13px]">
              <option value="">Any</option>
              {["payment", "transfer", "deposit", "withdrawal", "refund", "conversion"].map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-[12px] text-muted">From</span>
            <input type="date" name="from" defaultValue={defaults.from ?? ""} className="h-10 w-full rounded-lg border border-hair bg-canvas px-2.5 text-[13px]" />
          </label>
          <label className="space-y-1.5">
            <span className="block text-[12px] text-muted">To</span>
            <input type="date" name="to" defaultValue={defaults.to ?? ""} className="h-10 w-full rounded-lg border border-hair bg-canvas px-2.5 text-[13px]" />
          </label>
          <div className="flex items-end">
            <a href="/transactions" className="text-[13px] text-muted underline underline-offset-4 hover:text-ink">
              Clear all
            </a>
          </div>
        </div>
      )}
    </form>
  );
}
