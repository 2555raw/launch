"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDateTime, shortAddress } from "@/lib/format";
import { tierReward } from "@/lib/rewards/engine";
import { PAYOUT_CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/web3/chains";
import { KNOWN_TOKENS } from "@/lib/web3/tokens";
import type { AdminOverview } from "./hooks";
import { PageHeader } from "./PageHeader";

type Settings = AdminOverview["settings"];
type Form = Omit<Settings, "updatedBy" | "updatedAt">;

export function SettingsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api<{ settings: Settings; history: Array<{ id: number; snapshot: Settings; changedBy: string; createdAt: string }> }>("/api/admin/settings"),
  });
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (data && !form) {
      const { updatedBy: _u, updatedAt: _t, ...rest } = data.settings;
      void _u;
      void _t;
      setForm(rest);
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: (f: Form) => api<{ settings: Settings }>("/api/admin/settings", { method: "PUT", json: f }),
    onSuccess: async () => {
      toast.success("Settings saved", { description: "New rates apply to the next photos you verify." });
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form || !data) return <Skeleton className="h-[600px]" />;

  const tokens = KNOWN_TOKENS[PAYOUT_CHAIN_ID] ?? [];
  const preset = tokens.find((t) => t.address.toLowerCase() === form.payoutTokenAddress.toLowerCase());
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  // What a day earns under the edited rates.
  const example = [1000, 3500, form.tierThreshold, Math.round((form.tierThreshold + form.tierCap) / 2), form.tierCap, form.tierCap + 5000].map((n) => ({
    steps: n,
    amount: tierReward(n, form),
  }));

  return (
    <div>
      <PageHeader
        label="Settings"
        title="Rates & settings"
        description="Changes apply to photos you verify from now on. Every change is saved in the history."
        action={
          <Button loading={save.isPending} onClick={() => save.mutate(form)} icon={<Save className="h-4 w-4" />}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="space-y-6 p-6 xl:col-span-2">
          <CardHeader label="Rates" title="What a day of steps pays" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First milestone (steps)" hint="Pay grows in a straight line from 0 up to here.">
              <input type="number" className="input font-mono" min={1000} step={500} value={form.tierThreshold} onChange={(e) => set("tierThreshold", Number(e.target.value))} />
            </Field>
            <Field label={`Pays at the first milestone (${form.payoutTokenSymbol})`} hint="For example $3.70 at 7,000 steps.">
              <input type="number" className="input font-mono" min={0} step={0.05} value={form.tierAvg} onChange={(e) => set("tierAvg", Number(e.target.value))} />
            </Field>
            <Field label="Top milestone (steps)" hint="From here on a day pays the top amount.">
              <input type="number" className="input font-mono" min={1000} step={500} value={form.tierCap} onChange={(e) => set("tierCap", Number(e.target.value))} />
            </Field>
            <Field label={`Top amount per day (${form.payoutTokenSymbol})`} hint="The most a single day can pay, for example $5.">
              <input type="number" className="input font-mono" min={0} step={0.05} value={form.tierMax} onChange={(e) => set("tierMax", Number(e.target.value))} />
            </Field>
            <Field label="Minimum steps to earn" hint="Days at or below this pay nothing. 0 means every step counts.">
              <input type="number" className="input font-mono" min={0} step={100} value={form.tierMin} onChange={(e) => set("tierMin", Number(e.target.value))} />
            </Field>
            <Field label="Daily goal shown to walkers" hint="Only used for the progress ring.">
              <input type="number" className="input font-mono" min={1000} max={100000} step={500} value={form.dailyStepGoal} onChange={(e) => set("dailyStepGoal", Number(e.target.value))} />
            </Field>
          </div>
          <p className="rounded-2xl border border-lime-400/20 bg-lime-400/[0.05] p-4 text-[12.5px] text-lime-100/80">
            These rates are private. Walkers only see the amount each verified day earns. Verifying a photo credits that day
            straight away.
          </p>

          <div className="hairline" />
          <CardHeader label="Payouts" title="Token" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Payout token" hint={`Network: ${SUPPORTED_CHAINS[PAYOUT_CHAIN_ID]?.name} (set by NEXT_PUBLIC_CHAIN_ID)`}>
              <select
                className="input"
                value={preset ? preset.address : "custom"}
                onChange={(e) => {
                  const t = tokens.find((x) => x.address === e.target.value);
                  if (t) setForm((f) => (f ? { ...f, payoutTokenSymbol: t.symbol, payoutTokenAddress: t.address, payoutTokenDecimals: t.decimals } : f));
                }}
              >
                {tokens.map((t) => (
                  <option key={t.address} value={t.address}>
                    {t.symbol} · {shortAddress(t.address)}
                  </option>
                ))}
                <option value="custom">Custom token…</option>
              </select>
            </Field>
            <Field label="Symbol">
              <input className="input font-mono" value={form.payoutTokenSymbol} onChange={(e) => set("payoutTokenSymbol", e.target.value)} />
            </Field>
            <Field label="Token contract address">
              <input className="input font-mono text-[13px]" value={form.payoutTokenAddress} onChange={(e) => set("payoutTokenAddress", e.target.value as `0x${string}`)} />
            </Field>
            <Field label="Decimals">
              <input type="number" className="input font-mono" min={0} max={36} value={form.payoutTokenDecimals} onChange={(e) => set("payoutTokenDecimals", Number(e.target.value))} />
            </Field>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <CardHeader label="Live example" title="What a day earns" />
            <dl className="mt-5 space-y-3 text-sm">
              {example.map((x) => (
                <Line key={x.steps} k={`${x.steps.toLocaleString()} steps`} v={`${fmtAmount(x.amount)} ${form.payoutTokenSymbol}`} accent={x.amount > 0} />
              ))}
            </dl>
          </Card>
          <Card className="p-6">
            <CardHeader label="Versions" title="Change history" action={<History className="h-4 w-4 text-white/40" />} />
            <ul className="mt-4 space-y-2 text-[12.5px]">
              <li className="rounded-xl border border-lime-400/20 bg-lime-400/[0.05] px-3 py-2">
                Current · {data.settings.updatedBy ? shortAddress(data.settings.updatedBy) : "default"} · {fmtDateTime(data.settings.updatedAt)}
              </li>
              {data.history.map((h) => (
                <li key={h.id} className="rounded-xl border border-white/5 px-3 py-2 text-white/55">
                  {fmtDateTime(h.createdAt)} · {shortAddress(h.changedBy)} replaced: {h.snapshot.tierAvg ?? "n/a"} at {h.snapshot.tierThreshold ?? "n/a"} steps · {h.snapshot.tierMax ?? "n/a"} top
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px] text-white/40">{hint}</span>}
    </label>
  );
}

function Line({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 last:border-0">
      <dt className="text-white/55">{k}</dt>
      <dd className={cn("font-mono", accent && "text-lime-300")}>{v}</dd>
    </div>
  );
}
