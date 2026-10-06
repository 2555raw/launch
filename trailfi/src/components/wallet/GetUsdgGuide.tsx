"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Copy, Loader2, Search, Smartphone, Sparkles, Wallet, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useSession } from "@/components/providers/SessionProvider";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { cn } from "@/lib/cn";
import { ConnectWallet } from "./ConnectWallet";

interface Check {
  ok: boolean;
  symbol: string;
  balance: string;
  min: string;
}

const ROUTES = [
  {
    id: "robinhood",
    icon: Smartphone,
    title: "From the Robinhood app",
    badge: "Easiest",
    time: "About 2 minutes",
    steps: [
      <>Open the Robinhood app, go to Crypto and buy a little <b>USDG</b> (Global Dollar).</>,
      <>On the USDG page tap <b>Send</b>.</>,
      <>Choose the <b>Robinhood Chain</b> network.</>,
      <>Paste your wallet address (copy it above) and the amount.</>,
      <>Tap <b>Review</b>, then <b>Submit</b>.</>,
    ],
    note: "Robinhood doesn't allow USDG transfers on Robinhood Chain for New York residents.",
    links: [{ href: "https://robinhood.com/us/en/support/articles/crypto-transfers/", label: "Robinhood help: sending crypto" }],
  },
  {
    id: "bridge",
    icon: Sparkles,
    title: "Have USDC on another network?",
    badge: "Seconds",
    time: "About 1 minute",
    steps: [
      <>Open <b>Across</b> and connect the same wallet.</>,
      <>Pick <b>USDC</b> on the network where you hold it: Base, Arbitrum, Ethereum, Optimism, Polygon and more.</>,
      <>Set the destination to <b>Robinhood Chain</b>. You receive <b>USDG</b>, one for one.</>,
      <>Confirm in your wallet. It usually lands in a few seconds.</>,
    ],
    note: "You pay the small network fee of the chain you send from.",
    links: [
      { href: "https://across.to/robinhood-bridge", label: "Across bridge" },
      { href: "https://relay.link/bridge/robinhood", label: "Relay (alternative)" },
      { href: "https://docs.robinhood.com/chain/bridging", label: "All official routes" },
    ],
  },
] as const;

/** Step by step guide to the USDG a wallet needs to cash out, with a live balance check. */
export function GetUsdgGuide() {
  const { address: connected } = useAccount();
  const { status } = useSession();
  const [address, setAddress] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Check | null>(null);
  const [route, setRoute] = useState<(typeof ROUTES)[number]["id"]>("robinhood");

  useEffect(() => {
    if (connected && !address) setAddress(connected);
  }, [connected, address]);

  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch(`/api/token-check?address=${encodeURIComponent(address.trim())}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not check this wallet");
      setResult(body);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const active = ROUTES.find((r) => r.id === route) ?? ROUTES[0];

  return (
    <div className="mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 text-[13px] text-white/60">
          <TokenIcon symbol="USDG" /> Get USDG
        </div>
        <h1 className="mt-4 font-display text-[40px] font-bold leading-[1.02] tracking-tight sm:text-6xl">
          Get USDG <span className="text-lime-400">in 2 minutes.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/60">
          Joining is free. To cash out, your wallet needs a little USDG on Robinhood Chain. Any amount works, even $1. It stays in your wallet:
          Stepit only reads the balance and never asks to move it.
        </p>
        <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
          {[
            ["Keeps out bots", "Empty wallets are free to create by the hundred. Needing a little USDG to get paid makes farming rewards not worth it."],
            ["Your wallet is ready", "It shows your wallet already holds USDG on Robinhood Chain, the same token and network your rewards are sent on."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[14px] font-semibold text-lime-300">Why: {t.toLowerCase()}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">{d}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Live check */}
      <div className="glass mt-10 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
          <Wallet className="h-3.5 w-3.5" /> Your wallet
        </div>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setResult(null);
              }}
              placeholder="0x… your wallet address"
              spellCheck={false}
              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pl-4 pr-12 font-mono text-[14px] text-white placeholder:text-white/30 focus:border-lime-400/50 focus:outline-none"
            />
            {address && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(address);
                  toast.success("Address copied");
                }}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/45 hover:bg-white/5 hover:text-white"
                aria-label="Copy address"
                title="Copy address"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={check}
            disabled={checking || !address.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 text-[14px] font-semibold text-ink-950 transition hover:bg-lime-300 disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Check my USDG
          </button>
        </div>
        {!connected && <p className="mt-2 text-[12.5px] text-white/40">Connect your wallet to fill this in, or paste the address you&apos;ll use.</p>}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "mt-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                result.ok ? "border-lime-400/30 bg-lime-400/[0.07]" : "border-amber-400/25 bg-amber-400/[0.06]",
              )}
            >
              <div className="flex items-center gap-3">
                {result.ok ? <CheckCircle2 className="h-6 w-6 shrink-0 text-lime-300" /> : <XCircle className="h-6 w-6 shrink-0 text-amber-300" />}
                <div>
                  <div className="font-semibold">
                    {result.ok ? `You hold ${Number(result.balance).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${result.symbol}. You're ready to cash out.` : `No ${result.symbol} on Robinhood Chain yet`}
                  </div>
                  <div className="text-[13px] text-white/55">
                    {result.ok ? "This wallet can cash out its rewards." : "You can still join and walk. Follow one of the routes below before you cash out."}
                  </div>
                </div>
              </div>
              {result.ok && status !== "authenticated" && <ConnectWallet size="md" />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Routes */}
      <div className="mt-10 inline-flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-[13.5px]">
        {ROUTES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoute(r.id)}
            className={cn("relative flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition", route === r.id ? "text-ink-950" : "text-white/60 hover:text-white")}
          >
            {route === r.id && <motion.span layoutId="usdg-route" className="absolute inset-0 rounded-xl bg-lime-400" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
            <r.icon className="relative h-4 w-4" />
            <span className="relative">{r.title}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={active.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="glass mt-4 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight">{active.title}</h2>
            <span className="rounded-full bg-lime-400/15 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-lime-300">{active.badge}</span>
            <span className="text-[13px] text-white/45">{active.time}</span>
          </div>
          <ol className="mt-6 space-y-4">
            {active.steps.map((s, i) => (
              <li key={i} className="flex gap-4 text-[15px] leading-relaxed text-white/75 [&_b]:font-semibold [&_b]:text-white">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lime-400 font-mono text-[12px] font-bold text-ink-950">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[13px] text-white/45">{active.note}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {active.links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-medium transition",
                  i === 0 ? "bg-white text-ink-950 hover:bg-lime-300" : "border border-white/10 text-white/75 hover:border-lime-400/40 hover:text-lime-300",
                )}
              >
                {l.label} <ArrowUpRight className="h-4 w-4" />
              </a>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Questions */}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          ["Why USDG?", "It's what Stepit pays in, and holding a little keeps out throwaway wallets."],
          ["Does Stepit take it?", "No. Stepit only reads your balance. It never asks for approvals or moves your funds."],
          ["Do I need ETH for gas?", "Not to join, cash out or get paid. Only if you later want to send your USDG somewhere."],
        ].map(([q, a]) => (
          <div key={q} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="font-semibold">{q}</div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
