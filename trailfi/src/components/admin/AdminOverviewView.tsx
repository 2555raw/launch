"use client";

import { ArrowRight, Footprints, Inbox, Mail, Users } from "lucide-react";
import Link from "next/link";
import { StepsChart } from "@/components/dashboard/StepsChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { cn } from "@/lib/cn";
import { fmtAmount, fmtSteps } from "@/lib/format";
import { tierReward } from "@/lib/rewards/engine";
import { useAdminMeta } from "./hooks";
import { PageHeader } from "./PageHeader";

export function AdminOverviewView() {
  const { data, isLoading } = useAdminMeta();

  if (isLoading || !data) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }
  const t = data.settings.payoutTokenSymbol;
  const s = data.settings;
  const rates = [s.tierThreshold / 2, s.tierThreshold, (s.tierThreshold + s.tierCap) / 2, s.tierCap].map((n) => ({
    steps: Math.round(n),
    amount: tierReward(Math.round(n), s),
  }));

  return (
    <div>
      <PageHeader
        label="Overview"
        title="Today on Stepit"
        action={
          <a
            href="/api/admin/newsletter"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] text-white/70 transition hover:border-lime-400/40 hover:text-lime-300"
          >
            <Mail className="h-4 w-4" /> Newsletter · {data.newsletterSubscribers} · CSV
          </a>
        }
      />

      {/* What needs doing */}
      <div className="grid gap-5 md:grid-cols-2">
        <TodoCard
          href="/admin/steps"
          icon={Footprints}
          count={data.stepsAwaitingReview}
          title="Photos to review"
          empty="No photos waiting"
          action="Review photos"
        />
        <TodoCard
          href="/admin/requests"
          icon={Inbox}
          count={data.payouts.requested}
          title="Payout requests"
          empty="No requests waiting"
          action="Pay requests"
        />
      </div>

      {/* Key numbers */}
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Number label="Walkers" value={data.users.users.toLocaleString("en-US")} hint={`+${data.users.newWeek} this week`} icon={<Users className="h-4 w-4" />} />
        <Number
          label="Owed to walkers"
          value={`$${fmtAmount(data.rewards.approved + data.rewards.processing)}`}
          hint="Verified, not paid yet"
          icon={<TokenIcon symbol={t} />}
        />
        <Number label="Paid out" value={`$${fmtAmount(data.rewards.paid)}`} hint={`${data.payouts.confirmed} payments`} icon={<TokenIcon symbol={t} />} accent />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <CardHeader label="Last 14 days" title="Steps uploaded per walker" />
          <div className="mt-8">
            <StepsChart
              data={data.series.map((d) => ({ day: d.day, steps: d.users ? Math.round(d.steps / d.users) : 0 }))}
              goal={data.settings.dailyStepGoal}
            />
          </div>
        </Card>
        <Card className="p-6">
          <CardHeader
            label="Private"
            title="Your rates"
            action={
              <Link href="/admin/settings" className="text-xs text-lime-300 hover:underline">
                Change
              </Link>
            }
          />
          <ul className="mt-5 space-y-2">
            {rates.map((r) => (
              <li key={r.steps} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm">
                <span className="text-white/60">{fmtSteps(r.steps)} steps</span>
                <span className="flex items-center gap-1.5 font-mono text-lime-300">
                  <TokenIcon symbol={t} /> ${fmtAmount(r.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] leading-relaxed text-white/40">
            Verifying a photo credits that day straight away. Walkers never see these rates.
          </p>
        </Card>
      </div>
    </div>
  );
}

function TodoCard({
  href,
  icon: Icon,
  count,
  title,
  empty,
  action,
}: {
  href: string;
  icon: typeof Footprints;
  count: number;
  title: string;
  empty: string;
  action: string;
}) {
  const busy = count > 0;
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-5 overflow-hidden rounded-3xl border p-6 transition",
        busy ? "border-lime-400/40 bg-lime-400/[0.07] hover:border-lime-400/70" : "glass hover:border-white/20",
      )}
    >
      {busy && <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime-400/20 blur-2xl" />}
      <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl", busy ? "bg-lime-400 text-ink-950" : "bg-white/5 text-white/40")}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="flex-1">
        <div className="text-sm text-white/55">{title}</div>
        <div className={cn("font-display text-3xl font-bold", busy ? "text-white" : "text-white/40")}>{busy ? count : empty}</div>
      </div>
      {busy && (
        <span className="flex items-center gap-1 text-sm font-medium text-lime-300">
          {action} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      )}
    </Link>
  );
}

function Number({ label, value, hint, icon, accent }: { label: string; value: string; hint: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-3xl border p-5", accent ? "border-lime-400/25 bg-lime-400/[0.05]" : "glass")}>
      <div className="flex items-center justify-between">
        <span className="label !text-[10px]">{label}</span>
        <span className="text-white/50">{icon}</span>
      </div>
      <div className={cn("mt-3 font-display text-[28px] font-bold leading-none tabular", accent && "text-lime-300")}>{value}</div>
      <div className="mt-2 text-[12px] text-white/45">{hint}</div>
    </div>
  );
}
