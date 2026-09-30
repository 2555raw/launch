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
import { computeDistribution } from "@/lib/rewards/engine";
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
      toast.success("Settings saved", { description: "New rules apply to the next distribution." });
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form || !data) return <Skeleton className="h-[600px]" />;

  const tokens = KNOWN_TOKENS[PAYOUT_CHAIN_ID] ?? [];
  const preset = tokens.find((t) => t.address.toLowerCase() === form.payoutTokenAddress.toLowerCase());
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  // Live example with the edited rules.
  let example: { pool: string; a: string; b: string; c: string } | null = null;
  try {
    const r = computeDistribution({
      eligibleFees: 100,
      config: form,
      participants: [
        { userId: "a", days: [{ day: "d", steps: form.dailyStepGoal }] },
        { userId: "b", days: [{ day: "d", steps: Math.round(form.dailyStepGoal * 1.5) }] },
        { userId: "c", days: [{ day: "d", steps: form.dailyStepGoal * 5 }] },
      ],
    });
    const get = (id: string) => r.allocations.find((x) => x.userId === id)?.amount ?? "0";
    example = { pool: r.pool, a: get("a"), b: get("b"), c: get("c") };
  } catch {
    example = null;
  }

  return (
    <div>
      <PageHeader
        label="Settings"
        title="Distribution rules"
        description="Changes apply to future distributions only. Every change is versioned and logged."
        action={
          <Button loading={save.isPending} onClick={() => save.mutate(form)} icon={<Save className="h-4 w-4" />}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="space-y-6 p-6 xl:col-span-2">
          <CardHeader label="Rewards" title="Fee share and goals" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fees shared with walkers (%)" hint="Share of eligible fees that forms the reward pool.">
              <input type="number" className="input font-mono" min={0} max={100} step={0.5} value={form.rewardPercent} onChange={(e) => set("rewardPercent", Number(e.target.value))} />
              <input type="range" min={0} max={100} step={0.5} value={form.rewardPercent} onChange={(e) => set("rewardPercent", Number(e.target.value))} className="mt-3 w-full accent-lime-400" />
            </Field>
            <Field label="Daily step goal" hint="A day counts only when verified steps reach this number.">
              <input type="number" className="input font-mono" min={1000} max={100000} step={500} value={form.dailyStepGoal} onChange={(e) => set("dailyStepGoal", Number(e.target.value))} />
            </Field>
            <Field label={`Max reward per user per period (${form.payoutTokenSymbol})`} hint="Hard cap on any single allocation.">
              <input type="number" className="input font-mono" min={0} step={1} value={form.maxRewardPerUser} onChange={(e) => set("maxRewardPerUser", Number(e.target.value))} />
            </Field>
            <Field label="Step cap multiplier" hint="Steps above goal × multiplier add no extra weight.">
              <input type="number" className="input font-mono" min={1} max={10} step={0.25} value={form.stepCapMultiplier} onChange={(e) => set("stepCapMultiplier", Number(e.target.value))} />
            </Field>
            <Field label="Distribution frequency" hint="Daily: one day per run. Weekly: up to seven days per run.">
              <div className="grid grid-cols-2 gap-2">
                {(["daily", "weekly"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set("distributionFrequency", f)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition",
                      form.distributionFrequency === f ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-white/10 text-white/60 hover:text-white",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Estimated daily fees (${form.payoutTokenSymbol})`} hint="Only used for the projections users see.">
              <input type="number" className="input font-mono" min={0} step={1} value={form.estimatedDailyFees} onChange={(e) => set("estimatedDailyFees", Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-lime-400" checked={form.redistributeExcess} onChange={(e) => set("redistributeExcess", e.target.checked)} />
            <span>
              <span className="font-medium">Redistribute capped excess</span>
              <span className="mt-0.5 block text-[12.5px] text-white/50">When a user hits the cap, share the rest among other walkers. If off, it stays in the treasury.</span>
            </span>
          </label>

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
            <CardHeader label="Live example" title="100 in eligible fees" />
            {example ? (
              <dl className="mt-5 space-y-3 text-sm">
                <Line k="Reward pool" v={`${fmtAmount(example.pool)} ${form.payoutTokenSymbol}`} accent />
                <Line k={`Walker A · ${form.dailyStepGoal.toLocaleString()} steps`} v={fmtAmount(example.a)} />
                <Line k={`Walker B · ${Math.round(form.dailyStepGoal * 1.5).toLocaleString()} steps`} v={fmtAmount(example.b)} />
                <Line k={`Walker C · ${(form.dailyStepGoal * 5).toLocaleString()} steps`} v={fmtAmount(example.c)} />
              </dl>
            ) : (
              <p className="mt-4 text-sm text-red-200">These values are out of range.</p>
            )}
          </Card>
          <Card className="p-6">
            <CardHeader label="Versions" title="Change history" action={<History className="h-4 w-4 text-white/40" />} />
            <ul className="mt-4 space-y-2 text-[12.5px]">
              <li className="rounded-xl border border-lime-400/20 bg-lime-400/[0.05] px-3 py-2">
                Current · {data.settings.updatedBy ? shortAddress(data.settings.updatedBy) : "default"} · {fmtDateTime(data.settings.updatedAt)}
              </li>
              {data.history.map((h) => (
                <li key={h.id} className="rounded-xl border border-white/5 px-3 py-2 text-white/55">
                  {fmtDateTime(h.createdAt)} · {shortAddress(h.changedBy)} replaced: {h.snapshot.rewardPercent}% · goal {h.snapshot.dailyStepGoal} · cap {h.snapshot.maxRewardPerUser}
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
