"use client";

import { useFormState } from "react-dom";
import { createMerchantAction, type MerchantState } from "../actions";
import { Field, Input, Select } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { ASSET_IDS, asset } from "@/lib/assets";

export function OnboardingForm() {
  const [state, action] = useFormState<MerchantState, FormData>(createMerchantAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Business name" htmlFor="name">
        <Input id="name" name="name" required autoFocus placeholder="Blue Bottle Coffee" />
      </Field>
      <Field label="Website" htmlFor="websiteUrl" hint="Optional. Shown to customers on the checkout page.">
        <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://example.com" />
      </Field>
      <Field label="Country" htmlFor="country">
        <Select id="country" name="country" defaultValue="IE">
          {[["IE", "Ireland"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["NL", "Netherlands"], ["US", "United States"]].map(
            ([c, l]) => (
              <option key={c} value={c}>
                {l}
              </option>
            )
          )}
        </Select>
      </Field>
      <Field label="You price in" htmlFor="pricingCurrency" hint="Customers see this currency; they pay the stablecoin equivalent.">
        <Select id="pricingCurrency" name="pricingCurrency" defaultValue="EUR">
          <option value="EUR">Euro (EUR)</option>
          <option value="USD">US dollar (USD)</option>
        </Select>
      </Field>
      <Field label="Settle into" htmlFor="settlementAsset" hint="Payments in other accepted assets are converted to this one.">
        <Select id="settlementAsset" name="settlementAsset" defaultValue="USDC">
          {ASSET_IDS.map((a) => (
            <option key={a} value={a}>
              {asset(a).name} ({a})
            </option>
          ))}
        </Select>
      </Field>
      <Alert tone="info" title="Business verification.">
        New merchants start unverified and can take payments up to a low ceiling. Full verification (KYB) is carried
        out by a regulated provider, which is not connected in this environment.
      </Alert>
      <Submit pendingLabel="Creating">Create merchant account</Submit>
    </form>
  );
}
