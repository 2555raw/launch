"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { simulateDepositAction, type ActionState } from "../../actions";
import { AssetPicker } from "@/components/app/AssetPicker";
import { Field, Input } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import type { AssetId } from "@/lib/assets";
import type { NetworkId } from "@/lib/networks";

/**
 * Demo tooling, and labelled as such. It exists because the chain provider is
 * simulated: there is no faucet to send from. With a real provider configured
 * the server action refuses, so this cannot create balance in production.
 */
export function SimulateDeposit({ network, assets }: { network: NetworkId; assets: AssetId[] }) {
  const [state, action] = useFormState<ActionState, FormData>(simulateDepositAction, undefined);
  const [assetId, setAssetId] = useState<AssetId>(assets[0]);

  return (
    <section className="rounded-card border border-dashed border-hairStrong bg-shell/60 px-5 py-5">
      <h2 className="text-[14px] font-semibold">Demo: simulate an incoming deposit</h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
        This environment has no real chain connected. Use this to fund the account so you can try paying, sending and
        converting. It is disabled automatically once a real chain provider is set.
      </p>
      <form action={action} className="mt-4 space-y-4">
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <input type="hidden" name="network" value={network} />
        <AssetPicker name="assetId" assets={assets} value={assetId} onChange={setAssetId} />
        <Field label="Amount" htmlFor="sim-amount">
          <Input id="sim-amount" name="amount" inputMode="decimal" defaultValue="250" required />
        </Field>
        <Submit pendingLabel="Crediting" variant="secondary" size="md">
          Credit demo funds
        </Submit>
      </form>
    </section>
  );
}
