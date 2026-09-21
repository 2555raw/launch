"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { refundAction, type MerchantState } from "../actions";
import { Field, Input } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { AssetId } from "@/lib/assets";

/** Refunds are irreversible, so the amount is typed and the panel is deliberate. */
export function RefundDialog({
  transactionId,
  assetId,
  maxAmount,
  idempotencyKey,
}: {
  transactionId: string;
  assetId: AssetId;
  maxAmount: string;
  idempotencyKey: string;
}) {
  const [state, action] = useFormState<MerchantState, FormData>(refundAction, undefined);
  const [open, setOpen] = useState(false);

  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Refund
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-xl border border-hair bg-shell/50 px-4 py-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Field label={`Refund amount (${assetId})`} htmlFor={`refund-${transactionId}`} hint={`Up to ${maxAmount} ${assetId}. Leave empty to refund it all.`}>
        <Input id={`refund-${transactionId}`} name="amount" inputMode="decimal" placeholder={maxAmount} />
      </Field>
      <Field label="Reason" htmlFor={`reason-${transactionId}`} hint="Optional. Kept on the record, not shown to the customer.">
        <Input id={`reason-${transactionId}`} name="reason" maxLength={140} />
      </Field>
      <div className="flex gap-2">
        <Submit pendingLabel="Refunding" variant="danger" size="md" full={false}>
          Send refund
        </Submit>
        <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
