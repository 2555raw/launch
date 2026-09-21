"use client";

import { useFormState } from "react-dom";
import { verifyMfaAction, type FormState } from "../../actions";
import { Field, Input } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";

export function VerifyForm() {
  const [state, action] = useFormState<FormState, FormData>(verifyMfaAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Authentication code" htmlFor="code">
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          className="tnum text-center text-[22px] tracking-[0.4em]"
          placeholder="000000"
        />
      </Field>
      <Submit pendingLabel="Checking">Verify</Submit>
    </form>
  );
}
