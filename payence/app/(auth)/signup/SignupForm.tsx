"use client";

import { useFormState } from "react-dom";
import { signupAction, type FormState } from "../actions";
import { Field, Input, Select } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";

const COUNTRIES = [
  ["IE", "Ireland"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["PT", "Portugal"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
];

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useFormState<FormState, FormData>(signupAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name" htmlFor="name" error={state?.field === "name" ? state.error : undefined}>
        <Input id="name" name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email" htmlFor="email" error={state?.field === "email" ? state.error : undefined}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 10 characters. A passphrase beats a short complicated word."
        error={state?.field === "password" ? state.error : undefined}
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Country" htmlFor="country" hint="Sets which limits and rules apply to your account.">
        <Select id="country" name="country" defaultValue="IE">
          {COUNTRIES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Submit pendingLabel="Creating account">Create account</Submit>
      <p className="text-center text-[12px] leading-relaxed text-muted">
        By continuing you agree to the Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}
