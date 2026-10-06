"use client";

import { AlertTriangle, ArrowRight, Footprints, Gauge, Inbox, Mail, PauseCircle, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const owed = data.rewards.approved + data.rewards.processing;
  const short = data.payoutBalance !== null && owed > data.payoutBalance;
  const rates = s.ratePoints.filter(([steps]) => steps > 0).map(([steps]) => ({ steps, amount: tierReward(steps, { ...s, points: s.ratePoints }) }));

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

      {short && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] p-4 text-[13.5px] leading-relaxed text-amber-100/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong className="font-semibold">Your payout wallet is short.</strong> It holds ${fmtAmount(data.payoutBalance ?? 0)} {t} but walkers are owed $
            {fmtAmount(owed)}. Top it up before paying the requests.
          </span>
        </div>
      )}
      {s.signupsPaused && (
        <Link
          href="/admin/settings"
          className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13.5px] text-white/70 transition hover:border-white/20"
        >
          <PauseCircle className="h-4 w-4 shrink-0 text-amber-300" /> New sign-ups are paused. Existing walkers can still upload.
          <span className="ml-auto text-lime-300">Change</span>
        </Link>
      )}

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
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Number label="Walkers" value={data.users.users.toLocaleString("en-US")} hint={`+${data.users.newWeek} this week`} icon={<Users className="h-4 w-4" />} />
        <Number
          label="Owed to walkers"
          value={`$${fmtAmount(owed)}`}
          hint={data.payoutBalance !== null ? `Payout wallet holds $${fmtAmount(data.payoutBalance)}` : "Verified, not paid yet"}
          icon={<TokenIcon symbol={t} />}
        />
        <Number label="Paid out" value={`$${fmtAmount(data.rewards.paid)}`} hint={`${data.payouts.confirmed} ${data.payouts.confirmed === 1 ? "payment" : "payments"}`} icon={<TokenIcon symbol={t} />} accent />
        <Number
          label="Credited today"
          value={`$${fmtAmount(data.creditedToday)}`}
          hint={
            s.dailyBudget > 0
              ? `of $${fmtAmount(s.dailyBudget)} daily budget · $${fmtAmount(Math.max(0, s.dailyBudget - data.creditedToday))} left`
              : "No daily budget set"
          }
          icon={<Gauge className="h-4 w-4" />}
        />
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
            label="Rates"
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
          <RateCalculator tiers={{ ...s, points: s.ratePoints }} token={t} />
          <p className="mt-4 text-[12px] leading-relaxed text-white/40">
            Between two rates a day pays the average in proportion, so 2,250 steps sits halfway between $1 and $2. Verifying a photo
            credits that day straight away. Walkers see the daily maximum on the home page.
          </p>
        </Card>
      </div>
    </div>
  );
}

/** Type any step count and see what that day pays, averaged between the two rates around it. */
function RateCalculator({ tiers, token }: { tiers: Parameters<typeof tierReward>[1]; token: string }) {
  const [raw, setRaw] = useState("2250");
  const steps = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
  const amount = tierReward(steps, tiers);
  return (
    <div className="mt-4 rounded-xl border border-lime-400/25 bg-lime-400/[0.05] p-3.5">
      <div className="label !text-[10px]">Try a day</div>
      <div className="mt-2 flex items-center gap-3">
        <input
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-label="Steps"
          className="w-28 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-lime-400/50"
        />
        <span className="text-sm text-white/50">steps pays</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-lg font-semibold text-lime-300">
          <TokenIcon symbol={token} /> ${fmtAmount(amount)}
        </span>
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
