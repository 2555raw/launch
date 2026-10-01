"use client";

import { AlertTriangle, ArrowRight, BadgeCheck, CircleDollarSign, Coins, Footprints, Hourglass, Send, Target, Users } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { StepsChart } from "@/components/dashboard/StepsChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { fmtAmount, fmtDate, fmtSteps, shortAddress } from "@/lib/format";
import { useAdminMeta } from "./hooks";
import { PageHeader } from "./PageHeader";

export function AdminOverviewView() {
  const { data, isLoading } = useAdminMeta();

  if (isLoading || !data) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  }
  const t = data.settings.payoutTokenSymbol;
  const avgPerUser = data.series.map((d) => ({ day: d.day, steps: d.users ? Math.round(d.steps / d.users) : 0 }));

  return (
    <div>
      <PageHeader
        label="Overview"
        title="Platform statistics"
        description={`Private rates: ~${fmtAmount(data.settings.tierAvg)} ${t} for ${fmtSteps(data.settings.tierMin)}–${fmtSteps(data.settings.tierThreshold)} steps, up to ${fmtAmount(data.settings.tierMax)} above · paid in ${t}`}
      />

      {(data.stepsAwaitingReview > 0 || data.payouts.failed > 0 || data.rewards.approved > 0 || data.payouts.requested > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {data.payouts.requested > 0 && (
            <Alert href="/admin/requests" tone="lime" text={`${data.payouts.requested} payout request${data.payouts.requested === 1 ? "" : "s"} waiting for you`} />
          )}
          {data.stepsAwaitingReview > 0 && (
            <Alert href="/admin/steps" tone="amber" text={`${data.stepsAwaitingReview} step ${data.stepsAwaitingReview === 1 ? "entry" : "entries"} awaiting review`} />
          )}
          {data.rewards.approved > 0 && (
            <Alert href="/admin/users?status=approved" tone="lime" text={`${fmtAmount(data.rewards.approved)} ${t} approved and ready to pay`} />
          )}
          {data.payouts.failed > 0 && <Alert href="/admin/payouts" tone="red" text={`${data.payouts.failed} failed payout${data.payouts.failed === 1 ? "" : "s"} need${data.payouts.failed === 1 ? "s" : ""} attention`} />}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered users" value={data.users.users} decimals={0} hint={`+${data.users.newWeek} this week · ${data.users.suspended} suspended`} icon={Users} />
        <StatCard label="Active today" value={data.today.active} decimals={0} hint={`${data.today.goalMet} reached the goal`} icon={Target} delay={0.05} />
        <StatCard label="Steps today" value={data.today.steps} decimals={0} hint="All non-rejected entries" icon={Footprints} delay={0.1} />
        <StatCard label="Total distributed" value={data.rewards.distributed} prefix="$" suffix={t} hint="Allocated, excluding rejected" icon={Coins} accent delay={0.15} />
        <StatCard label="Pending review" value={data.rewards.pending} prefix="$" suffix={t} hint="Rewards awaiting approval" icon={Hourglass} delay={0.2} />
        <StatCard label="Approved, unpaid" value={data.rewards.approved} prefix="$" suffix={t} hint="Ready to prepare payouts" icon={BadgeCheck} delay={0.25} />
        <StatCard label="In payment" value={data.rewards.processing} prefix="$" suffix={t} hint={`${data.payouts.inFlight} payouts in flight`} icon={Send} delay={0.3} />
        <StatCard label="Paid out" value={data.rewards.paid} prefix="$" suffix={t} hint={`${data.payouts.confirmed} confirmed transfers`} icon={CircleDollarSign} delay={0.35} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <CardHeader label="14 days" title="Average steps per active user" />
          <div className="mt-8">
            <StepsChart data={avgPerUser} goal={data.settings.dailyStepGoal} />
          </div>
        </Card>
        <Card className="p-6">
          <CardHeader
            label="Distributions"
            title="Recent runs"
            action={
              <Link href="/admin/rewards" className="text-xs text-lime-300 hover:underline">
                Run new →
              </Link>
            }
          />
          <div className="mt-5 space-y-2">
            {data.distributions.length === 0 && <EmptyState title="No distributions yet">Run the first one from the Rewards page.</EmptyState>}
            {data.distributions.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div>
                  <div className="text-sm font-medium">
                    {fmtDate(d.periodStart)}
                    {d.periodEnd !== d.periodStart && ` – ${fmtDate(d.periodEnd)}`}
                  </div>
                  <div className="text-[11.5px] text-white/45">
                    {d.participants} walkers · fees {fmtAmount(d.eligibleFees)} · by {shortAddress(d.createdBy)}
                  </div>
                </div>
                <div className="text-right font-mono text-sm text-lime-300">{fmtAmount(d.totalAllocated)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Alert({ href, text, tone }: { href: string; text: string; tone: "amber" | "lime" | "red" }) {
  const cls =
    tone === "amber"
      ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-100"
      : tone === "red"
        ? "border-red-400/25 bg-red-500/[0.07] text-red-100"
        : "border-lime-400/25 bg-lime-400/[0.06] text-lime-100";
  return (
    <Link href={href} className={`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:brightness-125 ${cls}`}>
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {text}
      </span>
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </Link>
  );
}
