"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { sendAction, type ActionState } from "../actions";
import { AmountInput } from "@/components/app/AmountInput";
import { AssetPicker } from "@/components/app/AssetPicker";
import { Field, Input } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { AssetId } from "@/lib/assets";

export function SendForm({
  assets,
  balances,
  idempotencyKey,
}: {
  assets: AssetId[];
  balances: Record<string, string>;
  idempotencyKey: string;
}) {
  const [state, action] = useFormState<ActionState, FormData>(sendAction, undefined);
  const [assetId, setAssetId] = useState<AssetId>(assets[0]);
  const available = BigInt(balances[assetId] ?? "0");
  const asBigints = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, BigInt(v)]));

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <Alert tone="error" title={state.code === "INSUFFICIENT_FUNDS" ? "Not enough balance." : undefined}>
          {state.error}
          {state.code === "INSUFFICIENT_FUNDS" && (
            <span className="mt-2 block">
              <Button href="/wallet/deposit" size="sm" variant="secondary">
                Add money
              </Button>
            </span>
          )}
        </Alert>
      )}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <Field label="Asset">
        <AssetPicker name="assetId" assets={assets} balances={asBigints} value={assetId} onChange={setAssetId} />
      </Field>

      <Field label="Amount">
        <AmountInput assetId={assetId} available={available} autoFocus />
      </Field>

      <Field label="To" htmlFor="recipient" hint="A Payence handle like @alice, or the email on their account.">
        <Input id="recipient" name="recipient" placeholder="@alice" autoCapitalize="none" autoCorrect="off" required />
      </Field>

      <Field label="Note" htmlFor="note" hint="Optional. Only you and the recipient see it.">
        <Input id="note" name="note" maxLength={140} placeholder="Dinner on Friday" />
      </Field>

      <Submit pendingLabel="Sending">Review and send</Submit>
    </form>
  );
}
