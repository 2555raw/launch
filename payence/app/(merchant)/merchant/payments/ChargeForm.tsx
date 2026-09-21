"use client";

import { useFormState } from "react-dom";
import { createChargeAction, type MerchantState } from "../actions";
import { Field, Input, Select } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";

export function ChargeForm({ pricingCurrency }: { pricingCurrency: string }) {
  const [state, action] = useFormState<MerchantState, FormData>(createChargeAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <Field label="Amount" htmlFor="amount">
        <div className="flex gap-2">
          <Input id="amount" name="amount" inputMode="decimal" placeholder="15.00" required autoFocus className="flex-1" />
          <Select name="currency" defaultValue={pricingCurrency} aria-label="Currency" className="w-32">
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="USDC">USDC</option>
            <option value="EURC">EURC</option>
          </Select>
        </div>
      </Field>

      <Field label="Description" htmlFor="description" hint="Shown to the customer while they pay.">
        <Input id="description" name="description" maxLength={140} placeholder="Two flat whites" />
      </Field>

      <Field label="Your reference" htmlFor="reference" hint="Optional. Your order or invoice number, returned on the webhook.">
        <Input id="reference" name="reference" maxLength={60} placeholder="ORDER-1043" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valid for" htmlFor="minutes" hint="After this the code stops working.">
          <Select id="minutes" name="minutes" defaultValue="30">
            <option value="5">5 minutes</option>
            <option value="30">30 minutes</option>
            <option value="1440">24 hours</option>
            <option value="10080">7 days</option>
          </Select>
        </Field>
        <Field label="Type" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="qr">
            <option value="qr">Counter QR</option>
            <option value="link">Payment link</option>
            <option value="checkout">Online checkout</option>
            <option value="pos">Point of sale</option>
          </Select>
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-hair px-4 py-3.5">
        <input type="checkbox" name="reusable" className="mt-0.5 h-4 w-4 accent-[#141414]" />
        <span className="text-[13.5px] leading-relaxed">
          <span className="block font-medium">Reusable code</span>
          <span className="block text-muted">
            A fixed code for a tip jar or a stall: it never expires and can be paid many times. A per-order charge
            should not be reusable.
          </span>
        </span>
      </label>

      <Submit pendingLabel="Creating">Create charge</Submit>
    </form>
  );
}
