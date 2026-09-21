"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { convertAction, type ActionState } from "../../actions";
import { AmountInput } from "@/components/app/AmountInput";
import { Field, Select } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { ASSET_IDS, asset, type AssetId } from "@/lib/assets";
import { Icon } from "@/components/ui/Icons";

export function ConvertForm({
  balances,
  feeBps,
  rateSource,
  idempotencyKey,
}: {
  balances: Record<string, string>;
  feeBps: number;
  rateSource: string;
  idempotencyKey: string;
}) {
  const [state, action] = useFormState<ActionState, FormData>(convertAction, undefined);
  const [from, setFrom] = useState<AssetId>("USDC");
  const [to, setTo] = useState<AssetId>("EURC");
  const available = BigInt(balances[from] ?? "0");

  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <Field label="From" htmlFor="from">
        <Select
          id="from"
          name="from"
          value={from}
          onChange={(e) => {
            const next = e.target.value as AssetId;
            setFrom(next);
            if (next === to) setTo(ASSET_IDS.find((a) => a !== next)!);
          }}
        >
          {ASSET_IDS.map((a) => (
            <option key={a} value={a}>
              {asset(a).name} ({a})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Amount">
        <AmountInput assetId={from} available={available} />
      </Field>

      <div className="flex justify-center text-muted" aria-hidden>
        <Icon.swap className="h-5 w-5" />
      </div>

      <Field label="To" htmlFor="to">
        <Select
          id="to"
          name="to"
          value={to}
          onChange={(e) => {
            const next = e.target.value as AssetId;
            setTo(next);
            if (next === from) setFrom(ASSET_IDS.find((a) => a !== next)!);
          }}
        >
          {ASSET_IDS.filter((a) => a !== from).map((a) => (
            <option key={a} value={a}>
              {asset(a).name} ({a})
            </option>
          ))}
        </Select>
      </Field>

      <dl className="space-y-2 rounded-xl border border-hair bg-shell/60 px-4 py-3.5 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-muted">Conversion fee</dt>
          <dd className="font-medium">{(feeBps / 100).toFixed(2)}%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Rate source</dt>
          <dd className="font-medium">{rateSource}</dd>
        </div>
      </dl>
      <p className="text-[12.5px] leading-relaxed text-muted">
        The exact rate is taken when you confirm, and the receipt records it. Converting between assets with different
        pegs carries currency risk.
      </p>

      <Submit pendingLabel="Converting">Convert</Submit>
    </form>
  );
}
