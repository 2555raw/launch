"use client";

import { useFormState } from "react-dom";
import { updateMerchantAction, type MerchantState } from "../actions";
import { Field, Input, Select } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { ASSET_IDS, asset, type AssetId } from "@/lib/assets";

export function MerchantSettingsForm({
  name,
  websiteUrl,
  settlementAsset,
  pricingCurrency,
  accepted,
}: {
  name: string;
  websiteUrl: string;
  settlementAsset: string;
  pricingCurrency: string;
  accepted: AssetId[];
}) {
  const [state, action] = useFormState<MerchantState, FormData>(updateMerchantAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}

      <Field label="Business name" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required />
      </Field>
      <Field label="Website" htmlFor="websiteUrl">
        <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={websiteUrl} placeholder="https://example.com" />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-medium">Accepted assets</legend>
        <div className="space-y-2">
          {ASSET_IDS.map((a) => (
            <label key={a} className="flex items-center gap-3 rounded-xl border border-hair px-4 py-3">
              <input
                type="checkbox"
                name="acceptedAssets"
                value={a}
                defaultChecked={accepted.includes(a)}
                className="h-4 w-4 accent-[#141414]"
              />
              <span className="text-[13.5px]">
                <span className="font-medium">{asset(a).symbol}</span>
                <span className="text-muted"> · {asset(a).name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Price in" htmlFor="pricingCurrency">
        <Select id="pricingCurrency" name="pricingCurrency" defaultValue={pricingCurrency}>
          <option value="EUR">Euro (EUR)</option>
          <option value="USD">US dollar (USD)</option>
        </Select>
      </Field>

      <Field label="Settle into" htmlFor="settlementAsset">
        <Select id="settlementAsset" name="settlementAsset" defaultValue={settlementAsset}>
          {ASSET_IDS.map((a) => (
            <option key={a} value={a}>
              {asset(a).name} ({a})
            </option>
          ))}
        </Select>
      </Field>

      <Submit pendingLabel="Saving" variant="secondary" size="md" full={false}>
        Save settings
      </Submit>
    </form>
  );
}
