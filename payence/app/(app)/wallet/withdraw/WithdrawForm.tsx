"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { withdrawAction, type ActionState } from "../../actions";
import { AmountInput } from "@/components/app/AmountInput";
import { AssetPicker } from "@/components/app/AssetPicker";
import { Field, Input, Select } from "@/components/ui/Field";
import { Submit } from "@/components/ui/Submit";
import { Alert } from "@/components/ui/Alert";
import { asset, type AssetId } from "@/lib/assets";
import { formatUnits } from "@/lib/money";

type Net = { id: string; name: string; assets: AssetId[]; fee: string; seconds: number };

export function WithdrawForm({
  balances,
  networks,
  idempotencyKey,
}: {
  balances: Record<string, string>;
  networks: Net[];
  idempotencyKey: string;
}) {
  const [state, action] = useFormState<ActionState, FormData>(withdrawAction, undefined);
  const [assetId, setAssetId] = useState<AssetId>("USDC");
  const usable = networks.filter((n) => n.assets.includes(assetId));
  const [networkId, setNetworkId] = useState(usable[0]?.id ?? networks[0].id);
  const net = usable.find((n) => n.id === networkId) ?? usable[0];
  const available = BigInt(balances[assetId] ?? "0");
  const decimals = asset(assetId).decimals;
  const asBigints = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, BigInt(v)]));

  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <Field label="Asset">
        <AssetPicker
          name="assetId"
          assets={["USDC", "USDT", "EURC"]}
          balances={asBigints}
          value={assetId}
          onChange={(a) => {
            setAssetId(a);
            const next = networks.find((n) => n.assets.includes(a));
            if (next && !networks.find((n) => n.id === networkId)?.assets.includes(a)) setNetworkId(next.id);
          }}
        />
      </Field>

      <Field
        label="Network"
        htmlFor="network"
        hint={net ? `Arrives in about ${net.seconds < 60 ? `${net.seconds} seconds` : `${Math.round(net.seconds / 60)} minutes`}.` : undefined}
      >
        <Select id="network" name="network" value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
          {usable.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Destination address"
        htmlFor="address"
        hint="Check it twice. A transfer to the wrong address cannot be reversed by anyone."
      >
        <Input
          id="address"
          name="address"
          placeholder="0x…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="font-mono text-[13.5px]"
        />
      </Field>

      <Field label="Amount">
        <AmountInput assetId={assetId} available={available} />
      </Field>

      <dl className="space-y-2 rounded-xl border border-hair bg-shell/60 px-4 py-3.5 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-muted">Payence fee</dt>
          <dd className="font-medium">Free</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Network fee</dt>
          <dd className="tnum font-medium">
            {net ? `${formatUnits(BigInt(net.fee), decimals, 2)} ${asset(assetId).symbol}` : "—"}
          </dd>
        </div>
      </dl>

      <Submit pendingLabel="Submitting">Withdraw</Submit>
    </form>
  );
}
