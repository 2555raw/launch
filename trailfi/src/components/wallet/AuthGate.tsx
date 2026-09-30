"use client";

import { motion } from "framer-motion";
import { KeyRound, ShieldCheck, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConnectWallet } from "./ConnectWallet";

export function AuthGate({ children, title = "Connect your wallet", description }: { children: ReactNode; title?: string; description?: string }) {
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
        <p className="relative mx-auto mt-3 max-w-md text-white/60">
          {description ??
            "Your dashboard is private to your wallet. Connect and sign a free verification message to see your steps and rewards."}
        </p>
        <div className="relative mt-8 flex justify-center">
          <ConnectWallet size="lg" />
        </div>
        <div className="relative mt-8 grid gap-3 text-left text-[13px] text-white/55 sm:grid-cols-2">
          <div className="flex gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
            We never ask for seed phrases or private keys.
          </div>
          <div className="flex gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
            Your public address is used to identify you and send rewards.
          </div>
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}
