"use client";

import { useFormState } from "react-dom";
import { updateProfileAction, type SettingsState } from "./actions";
import { Field, Input, Select } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";

export function ProfileForm({ name, displayCurrency }: { name: string; displayCurrency: string }) {
  const [state, action] = useFormState<SettingsState, FormData>(updateProfileAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required />
      </Field>
      <Field label="Display currency" htmlFor="displayCurrency" hint="Balances and limits are shown in this currency.">
        <Select id="displayCurrency" name="displayCurrency" defaultValue={displayCurrency}>
          <option value="EUR">Euro (EUR)</option>
          <option value="USD">US dollar (USD)</option>
        </Select>
      </Field>
      <Submit pendingLabel="Saving" variant="secondary" size="md" full={false}>
        Save
      </Submit>
    </form>
  );
}
