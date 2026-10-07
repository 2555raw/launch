"use client";

import { motion } from "framer-motion";
import { KeyRound, ShieldCheck, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { cn } from "@/lib/cn";
import { ConnectWallet } from "./ConnectWallet";

/**
 * Shows its children only to a signed-in wallet. Walker pages get a full
 * "connect to start" screen; a custom title (the admin panel) gets a compact card.
 */
export function AuthGate({ children, title, description }: { children: ReactNode; title?: string; description?: string }) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-72 md:row-span-2" />
        <Skeleton className="h-32 md:col-span-2" />
        <Skeleton className="h-32 md:col-span-2" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return title ? <CompactGate title={title} description={description} /> : <ConnectToStart />;
  }

  return <>{children}</>;
}

const STEPS = [
  { n: 1, label: "Connect", icon: <Wallet className="h-4 w-4" /> },
  { n: 2, label: "Upload a screenshot", icon: <Upload className="h-4 w-4" /> },
  { n: 3, label: "Get paid in ETH", icon: <TokenIcon symbol="ETH" className="h-4 w-4" /> },
];

function ConnectToStart() {
  const pathname = usePathname();
  const section = pathname.startsWith("/steps") ? "Upload steps" : "Dashboard";

  return (
    <div className="grid items-center gap-12 py-4 lg:min-h-[calc(100vh-180px)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-2 text-[13px] text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> {section}
        </div>
        <h1 className="mt-5 font-display text-[44px] font-bold leading-[1.02] tracking-tight sm:text-6xl">
          Connect your wallet
          <span className="block text-lime-400">to start walking.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60">
          Your wallet is your account. Sign a short message to prove it&apos;s yours. It&apos;s free, moves no money and
          needs no email or password. Your ETH is sent to this wallet on Robinhood Chain.
        </p>

        <ol className="mt-8 flex flex-wrap gap-2.5">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-4 text-[14px] font-medium text-white/85"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 font-mono text-[12px] text-white/50">{s.n}</span>
              <span className="text-lime-400">{s.icon}</span>
              {s.label}
            </li>
          ))}
        </ol>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <ConnectWallet size="lg" />
          <span className="flex items-center gap-2 text-[14px] text-white/60">
            <TokenIcon symbol="ETH" /> Free to join. <span className="text-lime-300">Paid in ETH</span>
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
          {[
            { href: "/#how-it-works", label: "How it works" },
            { href: "/#faq", label: "FAQ" },
            { href: "/terms", label: "Terms" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="text-white/70 underline decoration-white/25 underline-offset-4 transition hover:text-lime-300 hover:decoration-lime-400">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-white/45">
          <span className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-lime-400/80" /> We never ask for seed phrases or private keys
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-lime-400/80" /> No transaction, no gas
          </span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
        <ExampleCard />
      </motion.div>
    </div>
  );
}

const GOAL = 10_000;
/** A sample week, priced with the live rates (about $1 per 1,500 steps, $5 from 10,000). */
const WEEK = [
  { day: "Mon", steps: 8432, amount: 4.61, status: "paid" },
  { day: "Tue", steps: 11250, amount: 5, status: "paid" },
  { day: "Wed", steps: 6104, amount: 4.03, status: "verified" },
  { day: "Thu", steps: 3210, amount: 2.14, status: "review" },
] as const;
const STATUS = {
  paid: { label: "Paid", cls: "bg-lime-400 text-ink-950" },
  verified: { label: "Verified", cls: "border border-lime-400/40 text-lime-300" },
  review: { label: "In review", cls: "border border-amber-400/35 text-amber-200/90" },
} as const;
const APPS = [
  { name: "Apple Health", icon: "/apps/apple-health.png" },
  { name: "Google Fit", icon: "/apps/google-fit.png" },
  { name: "Samsung Health", icon: "/apps/samsung-health.png" },
  { name: "Fitbit", icon: "/apps/fitbit.png" },
  { name: "Garmin", icon: "/apps/garmin-connect.png" },
];

/** A sample week as a walker sees it: what each day paid, and the week's total. */
function ExampleCard() {
  const earned = WEEK.filter((d) => d.status !== "review").reduce((t, d) => t + d.amount, 0);
  const steps = WEEK.reduce((t, d) => t + d.steps, 0);
  return (
    <div className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-ink-900/70 p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-lime-400/15 blur-3xl" />

      <div className="relative flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
        <span>Example week</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400" /> Robinhood Chain
        </span>
      </div>

      {/* Week total */}
      <div className="relative mt-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-white/50">Earned this week</div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-1 flex items-center gap-2.5 font-display text-[44px] font-bold leading-none tracking-tight text-lime-300"
          >
            +${earned.toFixed(2)}
          </motion.div>
          <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-white/50">
            <TokenIcon symbol="ETH" className="h-3.5 w-3.5" /> paid in ETH
          </div>
        </div>
        <div className="text-right font-mono text-[12px] leading-relaxed text-white/45">
          {steps.toLocaleString("en-US")} steps
          <br />
          {WEEK.length} uploads
        </div>
      </div>

      {/* Days */}
      <ul className="relative mt-6 space-y-2.5">
        {WEEK.map((d, i) => (
          <motion.li
            key={d.day}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 font-display text-[15px] font-semibold">{d.day}</span>
              <span className="font-mono text-[13px] text-white/70">{d.steps.toLocaleString("en-US")}</span>
              <span className="ml-auto font-mono text-[13px] text-lime-300/90">${d.amount.toFixed(2)}</span>
              <span className={cn("w-[78px] rounded-full py-0.5 text-center font-mono text-[10px] uppercase tracking-wider", STATUS[d.status].cls)}>
                {STATUS[d.status].label}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (d.steps / GOAL) * 100)}%` }}
                transition={{ delay: 0.45 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className={cn("h-full rounded-full", d.status === "review" ? "bg-amber-300/50" : "bg-gradient-to-r from-lime-500 to-lime-300")}
              />
            </div>
          </motion.li>
        ))}
      </ul>

      <div className="relative mt-8 border-t border-white/[0.07] pt-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">Screenshot from</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {APPS.map((a) => (
            <span key={a.name} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1.5 pr-3 text-[12.5px] text-white/75">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.icon} alt="" width={24} height={24} className="h-6 w-6 rounded-[7px]" />
              {a.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompactGate({ title, description }: { title: string; description?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong relative mx-auto max-w-xl overflow-hidden rounded-[32px] p-8 text-center sm:p-12"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-lime-400/20 blur-3xl" />
      <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-lime-400/30 bg-forest-800 text-lime-300 shadow-glow">
        <Wallet className="h-7 w-7" />
      </div>
      <h1 className="relative mt-6 font-display text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p className="relative mx-auto mt-3 max-w-md text-white/60">{description}</p>}
      <div className="relative mt-8 flex justify-center">
        <ConnectWallet size="lg" />
      </div>
    </motion.div>
  );
}
