"use client";

import { useFormState } from "react-dom";
import { createApiKeyAction, createWebhookAction, type MerchantState } from "../actions";
import { Field, Input } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { Copyable } from "@/components/ui/Copyable";

/** A secret is rendered once, with the copy control right beside it. */
function SecretReveal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-positive/25 bg-positive-soft px-4 py-3.5">
      <p className="text-[12.5px] font-medium text-positive">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-ink">{value}</code>
        <Copyable value={value} label="Copy" />
      </div>
    </div>
  );
}

export function ApiKeyForm() {
  const [state, action] = useFormState<MerchantState, FormData>(createApiKeyAction, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.secret && <SecretReveal label="Copy this key now. It is not shown again." value={state.secret} />}
      <div className="flex gap-2">
        <Input name="name" placeholder="Server key" aria-label="Key name" className="flex-1" />
        <Submit pendingLabel="Creating" variant="secondary" size="md" full={false}>
          Create key
        </Submit>
      </div>
    </form>
  );
}

export function WebhookForm() {
  const [state, action] = useFormState<MerchantState, FormData>(createWebhookAction, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.secret && <SecretReveal label="Signing secret. Verify every delivery against it." value={state.secret} />}
      <Field label="Endpoint URL" htmlFor="webhook-url" hint="Must be https. Reply 2xx within 8 seconds or it is retried.">
        <Input id="webhook-url" name="url" type="url" placeholder="https://example.com/payence/webhook" required />
      </Field>
      <Submit pendingLabel="Adding" variant="secondary" size="md" full={false}>
        Add endpoint
      </Submit>
    </form>
  );
}
