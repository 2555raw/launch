import type { ReactNode } from "react";
import { asset, type AssetId } from "@/lib/assets";

/** The shell every checkout state shares, so the page never jumps between them. */
export function CheckoutFrame({
  merchant,
  website,
  children,
}: {
  merchant: string;
  website?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[440px]">
        <div className="rounded-sheet border border-hair bg-surface px-6 py-7 shadow-float md:px-8">
          <header className="flex items-center justify-between gap-4 border-b border-hair pb-5">
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-[0.1em] text-muted">Paying</p>
              <p className="truncate text-[17px] font-bold tracking-tight">{merchant}</p>
              {website && <p className="truncate text-[12.5px] text-muted">{hostOf(website)}</p>}
            </div>
            <span className="shrink-0 text-[15px] font-extrabold tracking-[-0.04em]">PAYENCE</span>
          </header>
          <div className="pt-6">{children}</div>
        </div>
        <p className="mt-5 text-center text-[11.5px] text-muted">
          Secured by Payence · Stablecoin payments
        </p>
      </div>
    </div>
  );
}

export function PriceBlock({
  currency,
  amount,
  description,
}: {
  currency: string;
  amount: string;
  description?: string | null;
}) {
  return (
    <div className="text-center">
      <p className="text-[42px] font-extrabold leading-none tracking-[-0.04em]">{format(currency, amount)}</p>
      {description && <p className="mt-2.5 text-[14px] text-muted">{description}</p>}
    </div>
  );
}

function format(currency: string, amount: string): string {
  if (currency === "EUR" || currency === "USD") {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(Number(amount) / 100);
  }
  const a = asset(currency as AssetId);
  return `${(Number(amount) / 10 ** a.decimals).toFixed(2)} ${a.symbol}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
