"use client";

import { motion } from "framer-motion";
import { Activity, Smartphone, HeartPulse, KeyRound, ShieldCheck, Upload, Wallet, Watch } from "lucide-react";
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
  { n: 3, label: "Get paid in USDG", icon: <TokenIcon symbol="USDG" className="h-4 w-4" /> },
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
          needs no email or password. Your USDG is sent to this wallet on Robinhood Chain.
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
          <Link href="/get-usdg" className="flex items-center gap-2 text-[14px] text-white/60 transition hover:text-lime-300">
            <TokenIcon symbol="USDG" /> No USDG yet? <span className="text-lime-300 underline decoration-lime-400/40 underline-offset-4">Get some in 2 minutes</span>
          </Link>
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
const TUBE_MAX = 12_000;
const DAYS = [
  { day: "Mon", steps: 8432, status: "Paid", earned: "4.61" },
  { day: "Tue", steps: 6104, status: "Verified" },
  { day: "Wed", steps: 3210, status: "In review" },
];
const APPS = [
  { name: "Apple Health", icon: HeartPulse, tone: "bg-rose-500/15 text-rose-300" },
  { name: "Google Fit", icon: Activity, tone: "bg-sky-500/15 text-sky-300" },
  { name: "Samsung Health", icon: Smartphone, tone: "bg-indigo-500/15 text-indigo-300" },
  { name: "Fitbit / Garmin", icon: Watch, tone: "bg-teal-500/15 text-teal-300" },
];

/** A sample week as a walker sees it: each day fills towards the 10,000 step goal. */
function ExampleCard() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] rounded-[30px] border border-white/[0.09] bg-ink-900/70 p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      {/* Corner ticks */}
      {["left-3 top-3 border-l border-t", "right-3 top-3 border-r border-t", "bottom-3 left-3 border-b border-l", "bottom-3 right-3 border-b border-r"].map((c) => (
        <span key={c} className={cn("pointer-events-none absolute h-3.5 w-3.5 border-white/25", c)} />
      ))}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime-400/10 blur-3xl" />

      <div className="relative flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
        <span>Example</span>
        <span>Goal · 10,000 steps</span>
      </div>

      <div className="relative mt-12 flex gap-3">
        {/* Scale */}
        <div className="relative h-[200px] w-8 shrink-0 font-mono text-[10px] text-white/35">
          {[GOAL, 5000].map((v) => (
            <span key={v} className="absolute left-0 -translate-y-1/2" style={{ bottom: `${(v / TUBE_MAX) * 100}%` }}>
              {v / 1000}K
            </span>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-3 gap-4">
          {DAYS.map((d, i) => (
            <div key={d.day} className="flex flex-col items-center">
              <div className="relative h-[200px] w-[58px]">
                {d.earned && (
                  <motion.span
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.3 }}
                    className="absolute -top-9 left-1/2 flex -translate-x-1/4 items-center gap-1.5 whitespace-nowrap rounded-full border border-lime-400/50 bg-ink-950 px-2.5 py-1 font-mono text-[11px] text-lime-300 shadow-glow"
                  >
                    +${d.earned} <TokenIcon symbol="USDG" className="h-3.5 w-3.5" />
                  </motion.span>
                )}
                <div className="absolute inset-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)]">
                  {[GOAL, 5000].map((v) => (
                    <span key={v} className="absolute inset-x-0 h-px bg-white/10" style={{ bottom: `${(v / TUBE_MAX) * 100}%` }} />
                  ))}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.steps / TUBE_MAX) * 100}%` }}
                    transition={{ delay: 0.3 + i * 0.15, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "absolute inset-x-1.5 bottom-1.5 rounded-full",
                      d.status === "In review" ? "bg-gradient-to-t from-lime-500/40 to-lime-300/40" : "bg-gradient-to-t from-lime-500 to-lime-300",
                    )}
                  />
                  <span className="absolute left-3 top-3 h-10 w-1.5 rounded-full bg-white/10" />
                </div>
              </div>
              <div className="mt-4 text-[14px] font-medium">{d.day}</div>
              <div className="font-mono text-[12.5px] text-white/55">{d.steps.toLocaleString("en-US")}</div>
              <span
                className={cn(
                  "mt-2.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider sm:px-2.5 sm:text-[10.5px]",
                  d.status === "In review" ? "border-amber-400/30 text-amber-200/80" : "border-lime-400/35 text-lime-300",
                )}
              >
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-8 border-t border-white/[0.07] pt-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">Screenshot from</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {APPS.map((a) => (
            <span key={a.name} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 text-[12.5px] text-white/75">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full", a.tone)}>
                <a.icon className="h-3.5 w-3.5" />
              </span>
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
