"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { changePasswordAction, enableTotpAction, disableTotpAction, updateLimitAction, beginTotpAction, type SettingsState } from "../actions";
import { Field, Input } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Copyable } from "@/components/ui/Copyable";
import { Badge } from "@/components/ui/Status";

export function PasswordForm() {
  const [state, action] = useFormState<SettingsState, FormData>(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="Current password" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="next" hint="At least 10 characters.">
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Submit pendingLabel="Changing" variant="secondary" size="md" full={false}>
        Change password
      </Submit>
    </form>
  );
}

export function LimitForm({ current }: { current: number | null }) {
  const [state, action] = useFormState<SettingsState, FormData>(updateLimitAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="Your daily limit" htmlFor="dailyLimit" hint="Leave empty to use only your level's limit.">
        <Input
          id="dailyLimit"
          name="dailyLimit"
          inputMode="decimal"
          defaultValue={current ?? ""}
          placeholder="500"
        />
      </Field>
      <Submit pendingLabel="Saving" variant="secondary" size="md" full={false}>
        Save limit
      </Submit>
    </form>
  );
}

export function TotpSection({ enabled, secret, qr }: { enabled: boolean; secret: string | null; qr: string | null }) {
  const [enableState, enableAction] = useFormState<SettingsState, FormData>(enableTotpAction, undefined);
  const [disableState, disableAction] = useFormState<SettingsState, FormData>(disableTotpAction, undefined);
  const [confirmingOff, setConfirmingOff] = useState(false);

  if (enabled) {
    return (
      <div className="space-y-4">
        <Badge tone="positive">On</Badge>
        {disableState?.error && <Alert tone="error">{disableState.error}</Alert>}
        {!confirmingOff ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmingOff(true)}>
            Turn off two-factor
          </Button>
        ) : (
          <form action={disableAction} className="space-y-3 rounded-xl border border-danger/25 bg-danger-soft/50 px-4 py-4">
            <p className="text-[13px] leading-relaxed text-ink">
              Turning this off makes your password the only thing protecting your balance. Enter it to confirm.
            </p>
            <Field label="Password" htmlFor="off-password">
              <Input id="off-password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <div className="flex gap-2">
              <Submit pendingLabel="Turning off" variant="danger" size="md" full={false}>
                Turn off
              </Submit>
              <Button variant="ghost" size="md" onClick={() => setConfirmingOff(false)}>
                Keep it on
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (!secret) {
    return (
      <form action={beginTotpAction}>
        <Button type="submit" variant="secondary" size="md">
          Set up two-factor
        </Button>
      </form>
    );
  }

  return (
    <form action={enableAction} className="space-y-4">
      {enableState?.error && <Alert tone="error">{enableState.error}</Alert>}
      <ol className="space-y-4 text-[13.5px] leading-relaxed">
        <li>
          <strong className="font-semibold">1.</strong> Scan this with your authenticator app.
          {qr && (
            <div
              className="mt-3 w-[190px] rounded-xl border border-hair bg-white p-3"
              role="img"
              aria-label="Two-factor setup QR code"
              dangerouslySetInnerHTML={{ __html: qr.replace("<svg", '<svg width="100%" height="100%"') }}
            />
          )}
        </li>
        <li>
          <strong className="font-semibold">2.</strong> Or type the key by hand.
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="break-all rounded-lg bg-shell px-3 py-2 font-mono text-[12.5px]">{secret}</code>
            <Copyable value={secret} label="Copy key" />
          </div>
        </li>
        <li>
          <strong className="font-semibold">3.</strong> Enter the six digits it shows.
        </li>
      </ol>
      <Field label="Code from your app" htmlFor="totp-code">
        <Input
          id="totp-code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          placeholder="000000"
          className="tnum tracking-[0.3em]"
        />
      </Field>
      <Submit pendingLabel="Turning on" variant="secondary" size="md" full={false}>
        Turn on two-factor
      </Submit>
    </form>
  );
}
