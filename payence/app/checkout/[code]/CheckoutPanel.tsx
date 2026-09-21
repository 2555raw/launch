"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { payRequestAction, type ActionState } from "@/app/(app)/actions";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { asset, type AssetId } from "@/lib/assets";
import { formatUnits } from "@/lib/money";

type Quote = { asset: AssetId; amount: string; rate: string; decimals: number };

/**
 * The confirm step. It shows the exact amount in the chosen asset, the rate it
 * came from, and the balance it will leave, then holds the countdown so the
 * person is never surprised by an expiry mid-tap.
 */
export function CheckoutPanel({
  code,
  quotes,
  balances,
  expiresAt,
  merchantName,
  idempotencyKey,
}: {
  code: string;
  quotes: Quote[];
  balances: Record<string, string>;
  expiresAt: number | null;
  merchantName: string;
  idempotencyKey: string;
}) {
  const [state, action] = useFormState<ActionState, FormData>(payRequestAction, undefined);
  const affordable = quotes.find((q) => BigInt(balances[q.asset] ?? "0") >= BigInt(q.amount));
  const [selected, setSelected] = useState<AssetId>((affordable ?? quotes[0]).asset);
  const quote = quotes.find((q) => q.asset === selected)!;
  const balance = BigInt(balances[selected] ?? "0");
  const enough = balance >= BigInt(quote.amount);
  const remaining = useCountdown(expiresAt);

  if (remaining === 0) {
    return (
      <div className="space-y-4">
        <Alert tone="warning" title="This payment request expired.">
          Ask {merchantName} for a new code. Nothing was charged.
        </Alert>
        <Button href="/dashboard" variant="secondary" size="lg" full>
          Back to wallet
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state?.error && (
        <Alert tone="error" title={state.code === "INSUFFICIENT_FUNDS" ? "Not enough balance." : undefined}>
          {state.error}
        </Alert>
      )}
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Pay with</legend>
        <div className="space-y-2">
          {quotes.map((q) => {
            const bal = BigInt(balances[q.asset] ?? "0");
            const ok = bal >= BigInt(q.amount);
            const active = q.asset === selected;
            return (
              <label
                key={q.asset}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  active ? "border-ink" : "border-hair hover:border-hairStrong"
                }`}
              >
                <input
                  type="radio"
                  name="assetId"
                  value={q.asset}
                  checked={active}
                  onChange={() => setSelected(q.asset)}
                  className="h-4 w-4 accent-[#141414]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{asset(q.asset).symbol}</span>
                  <span className={`block text-[12px] ${ok ? "text-muted" : "text-danger"}`}>
                    {ok
                      ? `Balance ${formatUnits(bal, q.decimals, 2)}`
                      : `Balance ${formatUnits(bal, q.decimals, 2)} · not enough`}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[14px] font-semibold">
                  {formatUnits(BigInt(q.amount), q.decimals, 2)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <dl className="space-y-2 rounded-xl border border-hair bg-shell/60 px-4 py-3.5 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-muted">You pay</dt>
          <dd className="tnum font-semibold">
            {formatUnits(BigInt(quote.amount), quote.decimals, 2)} {quote.asset}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Rate</dt>
          <dd className="tnum">1 {quote.asset} = {Number(quote.rate).toFixed(4)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Fee to you</dt>
          <dd className="font-medium">None</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Settles in</dt>
          <dd>A few seconds</dd>
        </div>
        {remaining !== null && (
          <div className="flex justify-between">
            <dt className="text-muted">Expires in</dt>
            <dd className={`tnum ${remaining < 60 ? "text-danger" : ""}`}>{formatRemaining(remaining)}</dd>
          </div>
        )}
      </dl>

      {!enough && (
        <Alert tone="warning" title="Not enough balance.">
          Add {asset(selected).symbol} to your wallet, or pick another asset.
        </Alert>
      )}

      <Submit pendingLabel="Paying" disabled={!enough}>
        Pay {formatUnits(BigInt(quote.amount), quote.decimals, 2)} {quote.asset}
      </Submit>

      <p className="text-center text-[12px] leading-relaxed text-muted">
        Confirming moves the money immediately. A completed payment can only be returned by {merchantName}.
      </p>
    </form>
  );
}

/** Seconds left, or null when the request never expires. */
function useCountdown(expiresAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
