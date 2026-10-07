"use client";

import { ReminderCard } from "./ReminderCard";
import { sharePayout } from "@/components/providers/Notices";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Copy,
  ExternalLink,
  Hourglass,
  Info,
  PlusCircle,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";
import { MarkIcon } from "@/components/Logo";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/SessionProvider";
import { Badge, DemoBadge, StatusBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/cn";
import { XLogo } from "@/components/ui/XLogo";
import { xIntent } from "@/lib/social";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDate, fmtDateTime, fmtSteps, shortAddress } from "@/lib/format";
import { PAYOUT_CHAIN_ID, SUPPORTED_CHAINS, explorerTxUrl } from "@/lib/web3/chains";
import { StatCard } from "./StatCard";
import { StepsChart } from "./StepsChart";
import { TokenIcon } from "@/components/ui/TokenIcon";

interface StepEntry {
  id: string;
  day: string;
  steps: number;
  source: string;
  verification: string;
  flags: string[];
  reviewNote: string | null;
  createdAt: string;
}

interface MeResponse {
  user: { id: string; shortId: number; walletAddress: string; payoutConsentAt: string | null; createdAt: string };
  settings: {
    dailyStepGoal: number;
    payoutTokenSymbol: string;
    referralBonus: number;
  };
  today: { today: string; steps: number; goal: number; amount: string; eligible: boolean; tokenSymbol: string };
  summary: { pending: number; approved: number; processing: number; paid: number; total: number };
  steps: StepEntry[];
  rewards: Array<{ id: string; kind: string; periodStart: string; periodEnd: string; amount: number; status: string; validSteps: number; tokenSymbol: string }>;
  referral: { code: string; link: string; invited: number; rewarded: number; earned: number };
  payouts: Array<{
    id: string;
    amount: string;
    usdAmount?: string;
    tokenSymbol: string;
    chainId: number;
    status: string;
    simulated: boolean;
    txHash: string | null;
    steps: number;
    createdAt: string;
    confirmedAt: string | null;
  }>;
}

const SOURCE_LABEL: Record<string, string> = {
  manual_demo: "Uploaded",
  apple_health: "Apple Health",
  health_connect: "Health Connect",
  fitness_api: "Fitness API",
};

function celebrate() {
  const colors = ["#4d94ff", "#2f7bff", "#ffffff", "#9cc2ff"];
  confetti({ particleCount: 120, spread: 75, origin: { y: 0.35 }, colors, scalar: 0.9 });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors }), 220);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors }), 380);
}

export function DashboardView() {
  const { user } = useSession();
  const [activityOpen, setActivityOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MeResponse>("/api/me"),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  // Celebrate once per day when the goal is reached.
  const goalMet = data ? data.today.steps >= data.today.goal : false;
  useEffect(() => {
    if (!data || !goalMet) return;
    const key = `trailfi:celebrated:${data.user.id}:${data.today.today}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: celebrate anyway */
    }
    celebrate();
    toast.success("Daily goal complete!", { description: "Today's rewards count once your steps are verified." });
  }, [data, goalMet]);

  const chart = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, { steps: number; status: string }>();
    for (const s of data.steps) {
      if (s.verification === "rejected") continue;
      const prev = byDay.get(s.day);
      if (!prev || s.steps > prev.steps) byDay.set(s.day, { steps: s.steps, status: s.verification });
    }
    const out = [];
    const today = new Date(`${data.today.today}T00:00:00Z`);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day: d, steps: byDay.get(d)?.steps ?? 0, status: byDay.get(d)?.status });
    }
    return out;
  }, [data]);

  if (isLoading || !data) {
    if (error) return <EmptyState title="Could not load your dashboard">{(error as Error).message}</EmptyState>;
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-[420px]" />
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  const { today, summary, settings } = data;
  const token = settings.payoutTokenSymbol;
  const progress = today.goal ? today.steps / today.goal : 0;
  const todayEntry = data.steps.find((s) => s.day === today.today && s.verification !== "rejected");
  const chain = SUPPORTED_CHAINS[PAYOUT_CHAIN_ID];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="label">Dashboard · member #{data.user.shortId}</div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Good to see you back.</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="glass flex items-center gap-3 rounded-2xl py-2 pl-2.5 pr-3">
            <span className="relative">
              <AddressAvatar address={data.user.walletAddress} className="h-8 w-8" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-neon shadow-neon" />
            </span>
            <div className="leading-tight">
              <div className="font-mono text-[13px]">{shortAddress(data.user.walletAddress)}</div>
              <div className="text-[11px] text-lime-300/80">Connected · payouts on {chain?.name}</div>
            </div>
            <button
              className="ml-1 rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white"
              onClick={() => {
                void navigator.clipboard.writeText(data.user.walletAddress);
                toast.success("Address copied");
              }}
              aria-label="Copy address"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button variant="secondary" onClick={() => setActivityOpen(true)} icon={<Activity className="h-4 w-4" />}>
            View activity
          </Button>
        </div>
      </motion.div>

      <RequestBanner summary={summary} token={token} openRequest={data.payouts.find((p) => p.status === "requested")} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="lg:row-span-2">
          <Card className="relative h-full overflow-hidden p-6">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-lime-400/15 blur-3xl" />
            <CardHeader
              label={`Today · ${fmtDate(today.today, { weekday: "short", month: "short", day: "numeric" })}`}
              title="Daily goal"
              action={todayEntry ? <StatusBadge status={todayEntry.verification} /> : <Badge>no entry</Badge>}
            />
            <div className="relative mt-6 flex justify-center">
              <ProgressRing value={progress} size={220} stroke={16} id="dash-ring">
                <TodaySteps steps={today.steps} goal={today.goal} />
              </ProgressRing>
            </div>
            <div className="mt-6 text-center">
              {goalMet ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-sm font-medium text-lime-300"
                >
                  <CheckCircle2 className="h-4 w-4" /> Goal complete · {Math.round(progress * 100)}%
                </motion.div>
              ) : (
                <p className="text-sm text-white/55">
                  <span className="font-semibold text-white">{fmtSteps(Math.max(0, today.goal - today.steps))}</span> steps to reach
                  today&apos;s goal
                </p>
              )}
            </div>
            <div className="mt-6 grid gap-2">
              <ButtonLink href="/steps" variant="primary" icon={<PlusCircle className="h-4 w-4" />}>
                {todayEntry ? "Upload another day" : "Upload today's steps"}
              </ButtonLink>
              <p className="text-center text-[11.5px] text-white/40">
                Uploads include a screenshot from your health app and count once the team reviews them.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Stats */}
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
          <StatCard
            label="Estimated today"
            value={Number(today.amount)}
            prefix="$"
            
            hint={today.eligible ? "Projection · not guaranteed" : "Reach the goal to be eligible"}
            icon={Sparkles}
            accent
          />
          <StatCard
            label="Pending rewards"
            value={summary.pending + summary.approved + summary.processing}
            prefix="$"
            
            hint={`${fmtAmount(summary.approved)} approved · ${fmtAmount(summary.processing)} in payment`}
            icon={Hourglass}
            delay={0.05}
          />
          <StatCard label="Rewards paid" value={summary.paid} prefix="$" hint="Sent to your wallet" icon={Wallet} delay={0.1} />
          <StatCard
            label="Total earned"
            value={summary.total}
            prefix="$"
            
            hint="All allocated rewards, excluding rejected"
            icon={MarkIcon}
            delay={0.15}
          />
        </div>

        {/* Chart */}
        <Card className="p-6 lg:col-span-2">
          <CardHeader
            label="Last 14 days"
            title="Steps history"
            action={
              <div className="hidden items-center gap-4 text-[11px] text-white/50 sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-lime-400" /> goal met
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-white/25" /> below goal
                </span>
              </div>
            }
          />
          <div className="mt-8">
            <StepsChart data={chart} goal={today.goal} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Payment history */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="p-6 pb-4">
            <CardHeader label="Payouts" title="Payment history" />
          </div>
          {data.payouts.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState title="No payments yet">Approved rewards are bundled and sent to your wallet by the Strydo team.</EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="border-y border-white/10 bg-white/[0.02]">
                  <tr>
                    <th className="table-head">Date</th>
                    <th className="table-head">Amount</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p) => {
                    const url = p.txHash ? explorerTxUrl(p.chainId, p.txHash) : null;
                    return (
                      <tr key={p.id} className="border-b border-white/5 last:border-0">
                        <td className="table-cell">{fmtDateTime(p.confirmedAt ?? p.createdAt)}</td>
                        <td className="table-cell font-mono text-lime-300">
                          ${fmtAmount(p.usdAmount ?? p.amount)}{" "}
                          <span className="inline-flex items-center gap-1 text-white/40" title={`${p.amount} ${p.tokenSymbol}`}>
                            in <TokenIcon symbol={p.tokenSymbol} /> {p.tokenSymbol}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={p.status} />
                            {p.simulated && <DemoBadge>simulated</DemoBadge>}
                            {p.status === "confirmed" && !p.simulated && (
                              <button
                                onClick={() => sharePayout(p.id, p.usdAmount ?? p.amount, data.referral.code)}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60 transition hover:border-lime-400/40 hover:text-lime-300"
                                title="Share on X"
                              >
                                <XLogo className="h-2.5 w-2.5" /> Share
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="table-cell text-right">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12.5px] text-white/70 hover:text-lime-300">
                              {shortAddress(p.txHash, 8, 6)} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-white/30">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Rules */}
        <Card className="p-6">
          <CardHeader label="Current rules" title="How your rewards work" />
          <dl className="mt-5 space-y-3 text-sm">
            <Rule k="Daily goal" v={`${fmtSteps(settings.dailyStepGoal)} steps`} />
            <Rule k="Rewards" v="Grow with your verified steps" />
            <Rule k="Payout" v="Request it once approved" />
            <Rule k="Payout token" v={`${token} on ${chain?.name ?? ""}`} />
          </dl>
          <p className="mt-5 flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-[12px] leading-relaxed text-white/50">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Only verified activity is rewarded. The more you walk, the more you earn. Rewards are reviewed before
            payment and are never guaranteed.
          </p>
        </Card>
      </div>

      <ReminderCard />
      <InviteCard referral={data.referral} bonus={settings.referralBonus} token={token} />

      {/* Reward allocations */}
      <Card className="overflow-hidden">
        <div className="p-6 pb-4">
          <CardHeader label="Allocations" title="Reward history" />
        </div>
        {data.rewards.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState title="No rewards allocated yet">Rewards appear here after each distribution period closes.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="border-y border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="table-head">Period</th>
                  <th className="table-head">Valid steps</th>
                  <th className="table-head">Amount</th>
                  <th className="table-head">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rewards.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="table-cell">
                      {fmtDate(r.periodStart)}
                      {r.periodEnd !== r.periodStart && ` to ${fmtDate(r.periodEnd)}`}
                    </td>
                    <td className="table-cell font-mono">{r.kind === "referral" ? <span className="font-sans text-lime-300">Referral bonus</span> : r.kind === "prize" ? <span className="font-sans text-lime-300">🏆 Weekly prize</span> : fmtSteps(r.validSteps)}</td>
                    <td className="table-cell font-mono text-lime-300">
                      ${fmtAmount(r.amount)}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ActivityModal open={activityOpen} onClose={() => setActivityOpen(false)} entries={data.steps} />
    </div>
  );
}

function RequestBanner({
  summary,
  token,
  openRequest,
}: {
  summary: MeResponse["summary"];
  token: string;
  openRequest?: MeResponse["payouts"][number];
}) {
  const qc = useQueryClient();
  const request = useMutation({
    mutationFn: () => api<{ payout: { amount: string; usdAmount?: string; steps: number } }>("/api/me/payout-request", { method: "POST" }),
    onSuccess: async ({ payout }) => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Payout requested", { description: `$${fmtAmount(payout.usdAmount ?? payout.amount)} in ${token} · the team will send it to your wallet.` });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (openRequest) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col justify-between gap-3 rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-200">
            <Hourglass className="h-5 w-5" />
          </div>
          <div>
            <div className="label !text-amber-200/80">Payout requested</div>
            <div className="mt-1 font-display text-xl font-bold tabular">
              ${fmtAmount(openRequest.usdAmount ?? openRequest.amount)}{" "}
              <span className="inline-flex items-center gap-1.5 text-base text-white/50">
                in <TokenIcon symbol={openRequest.tokenSymbol} className="h-5 w-5" /> {openRequest.tokenSymbol}
              </span>
            </div>
            <div className="text-[12.5px] text-white/50">The team will send it to your wallet soon.</div>
          </div>
        </div>
        <StatusBadge status="requested" />
      </motion.div>
    );
  }
  if (summary.approved <= 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-lime-400/30 bg-lime-400/[0.07] p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime-400/20 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-forest-950">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="label !text-lime-300/80">Ready to request</div>
            <div className="mt-1 font-display text-2xl font-bold text-lime-300 tabular">
              ${fmtAmount(summary.approved)}{" "}
              <span className="inline-flex items-center gap-1.5 text-base text-white/50">
                in <TokenIcon symbol={token} className="h-5 w-5" /> {token}
              </span>
            </div>
            <div className="text-[12.5px] text-white/50">Approved rewards, paid to your connected wallet.</div>
          </div>
        </div>
        <Button size="lg" loading={request.isPending} onClick={() => request.mutate()} icon={<Send className="h-4 w-4" />}>
          Request payout
        </Button>
      </div>
    </motion.div>
  );
}

function TodaySteps({ steps, goal }: { steps: number; goal: number }) {
  const v = useCountUp(steps, 1500);
  return (
    <div>
      <div className="font-display text-[42px] font-bold leading-none tracking-tight tabular">{fmtSteps(v)}</div>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-white/45">of {fmtSteps(goal)} steps</div>
    </div>
  );
}

function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 last:border-0">
      <dt className="text-white/50">{k}</dt>
      <dd className="font-medium text-white/90">{v}</dd>
    </div>
  );
}

function ActivityModal({ open, onClose, entries }: { open: boolean; onClose: () => void; entries: StepEntry[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Your activity" subtitle="Every step entry and its verification status." className="sm:max-w-2xl">
      {entries.length === 0 ? (
        <EmptyState title="No activity yet">Log your first walk to see it here.</EmptyState>
      ) : (
        <ul className="divide-y divide-white/5">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-lime-300">
                  <MarkIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-[15px] tabular">{fmtSteps(e.steps)} steps</div>
                  <div className="text-[12px] text-white/45">
                    {fmtDate(e.day, { weekday: "short", month: "short", day: "numeric" })} · {SOURCE_LABEL[e.source] ?? e.source}
                  </div>
                  {e.flags.length > 0 && <div className="mt-0.5 text-[11px] text-amber-200/70">Flagged: {e.flags.join(", ").replaceAll("_", " ")}</div>}
                  {e.reviewNote && <div className="mt-0.5 text-[11px] text-white/40">Review: {e.reviewNote}</div>}
                </div>
              </div>
              <StatusBadge status={e.verification} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function InviteCard({ referral, bonus, token }: { referral: MeResponse["referral"]; bonus: number; token: string }) {
  const tweet = `I'm walking and earning ${token} with @Strydo 🥾 Upload your daily steps, get verified, get paid. Join me:`;
  return (
    <Card className="relative overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime-400/15 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <CardHeader label="Invite friends" title={bonus > 0 ? `You both get $${fmtAmount(bonus)} ${token}` : "Bring your friends"} />
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">
            Share your link. When a friend joins through it and their first steps are verified, you both get the bonus.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/10 bg-black/30 px-3.5 font-mono text-[13px] text-white/80">
              <span className="truncate py-3">{referral.link.replace(/^https?:\/\//, "")}</span>
            </div>
            <Button
              variant="secondary"
              icon={<Copy className="h-4 w-4" />}
              onClick={() => {
                void navigator.clipboard.writeText(referral.link);
                toast.success("Invite link copied");
              }}
            >
              Copy
            </Button>
            <Button
              icon={<XLogo />}
              onClick={() =>
                window.open(
                  xIntent(tweet, referral.link),
                  "_blank",
                  "noopener",
                )
              }
            >
              Share on X
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <InviteStat k="Invited" v={String(referral.invited)} />
          <InviteStat k="Verified" v={String(referral.rewarded)} />
          <InviteStat k="Earned" v={`$${fmtAmount(referral.earned)}`} accent />
        </dl>
      </div>
    </Card>
  );
}

function InviteStat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4 text-center", accent ? "border-lime-400/25 bg-lime-400/[0.06]" : "border-white/10 bg-white/[0.03]")}>
      <dd className={cn("font-display text-2xl font-bold tabular", accent && "text-lime-300")}>{v}</dd>
      <dt className="label mt-1 !text-[9.5px]">{k}</dt>
    </div>
  );
}
