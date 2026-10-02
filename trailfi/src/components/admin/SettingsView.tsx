"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Plus, Save, Trash2 } from "lucide-react";
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
  const setPoint = (i: number, part: 0 | 1, value: number) =>
    set(
      "ratePoints",
      form.ratePoints.map((p, j) => (j === i ? ((part === 0 ? [value, p[1]] : [p[0], value]) as [number, number]) : p)),
    );
  const tiers = { ...form, points: form.ratePoints };

  // What a day earns under the edited rates.
  const example = [791, 1500, 3000, 4500, 6000, 8000, 10000, 15000].map((n) => ({ steps: n, amount: tierReward(n, tiers) }));

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
          <div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-1 pb-2">
              <span className="label !text-[10px]">Steps</span>
              <span className="label !text-[10px]">Pays ({form.payoutTokenSymbol})</span>
              <span className="w-9" />
            </div>
            <div className="space-y-2">
              {form.ratePoints.map(([steps, amount], i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
                  <input
                    type="number"
                    className="input font-mono"
                    min={0}
                    step={100}
                    value={steps}
                    onChange={(e) => setPoint(i, 0, Number(e.target.value))}
                    aria-label={`Milestone ${i + 1} steps`}
                  />
                  <input
                    type="number"
                    className="input font-mono"
                    min={0}
                    step={0.05}
                    value={amount}
                    onChange={(e) => setPoint(i, 1, Number(e.target.value))}
                    aria-label={`Milestone ${i + 1} amount`}
                  />
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-lg text-white/35 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
                    disabled={form.ratePoints.length <= 2}
                    onClick={() => set("ratePoints", form.ratePoints.filter((_, j) => j !== i))}
                    aria-label="Remove milestone"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const last = form.ratePoints[form.ratePoints.length - 1] ?? [0, 0];
                set("ratePoints", [...form.ratePoints, [last[0] + 2000, last[1]]]);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12.5px] text-white/70 transition hover:border-lime-400/40 hover:text-lime-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add milestone
            </button>
            <p className="mt-3 text-[12px] leading-relaxed text-white/45">
              Between two milestones a day pays the proportional amount. From the last milestone on it pays the last amount.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Minimum steps to earn" hint="Days at or below this pay nothing. 0 means every step counts.">
              <input type="number" className="input font-mono" min={0} step={100} value={form.tierMin} onChange={(e) => set("tierMin", Number(e.target.value))} />
            </Field>
            <Field label="Daily goal shown to walkers" hint="Only used for the progress ring.">
              <input type="number" className="input font-mono" min={1000} max={100000} step={500} value={form.dailyStepGoal} onChange={(e) => set("dailyStepGoal", Number(e.target.value))} />
            </Field>
            <Field
              label={`Referral bonus, each (${form.payoutTokenSymbol})`}
              hint="Paid to the walker and to the friend who invited them when the walker's first photo is verified. 0 turns it off."
            >
              <input type="number" className="input font-mono" min={0} step={0.25} value={form.referralBonus} onChange={(e) => set("referralBonus", Number(e.target.value))} />
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
                  {fmtDateTime(h.createdAt)} · {shortAddress(h.changedBy)} replaced the rates · goal {h.snapshot.dailyStepGoal}
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
