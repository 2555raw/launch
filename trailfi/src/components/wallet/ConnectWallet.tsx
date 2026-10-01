"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Copy, LayoutDashboard, LogOut, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDisconnect } from "wagmi";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { MobileWalletSheet, useNeedsWalletApp } from "./MobileWallets";

export function AddressAvatar({ address, className }: { address: string; className?: string }) {
  // Deterministic gradient per address — purely cosmetic.
  const h1 = parseInt(address.slice(2, 6), 16) % 360;
  const h2 = (h1 + 70 + (parseInt(address.slice(-4), 16) % 90)) % 360;
  return (
    <span
      className={cn("inline-block h-6 w-6 shrink-0 rounded-full ring-1 ring-white/20", className)}
      style={{ background: `conic-gradient(from 140deg, hsl(${h1} 85% 60%), hsl(${h2} 80% 55%), hsl(${h1} 85% 60%))` }}
    />
  );
}

export function ConnectWallet({ size = "md", className, label = "Connect Wallet" }: { size?: "sm" | "md" | "lg"; className?: string; label?: string }) {
  const needsWalletApp = useNeedsWalletApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = ready && account && chain && authenticationStatus === "authenticated";

        if (!ready) {
          return (
            <Button size={size} className={cn("pointer-events-none opacity-60", className)} icon={<Wallet className="h-4 w-4" />}>
              {label}
            </Button>
          );
        }
        if (!connected) {
          return (
            <>
              <Button
                size={size}
                className={className}
                onClick={() => (needsWalletApp && !account ? setSheetOpen(true) : openConnectModal())}
                icon={<Wallet className="h-4 w-4" />}
              >
                {account ? "Verify wallet" : label}
              </Button>
              <MobileWalletSheet open={sheetOpen} onClose={() => setSheetOpen(false)} openConnectModal={openConnectModal} />
            </>
          );
        }
        return <AccountMenu address={account.address} chainName={chain.name ?? "Network"} size={size} />;
      }}
    </ConnectButton.Custom>
  );
}

function AccountMenu({ address, chainName, size }: { address: string; chainName: string; size: "sm" | "md" | "lg" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { disconnect } = useDisconnect();
  const { user, signOut } = useSession();

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "glass flex items-center gap-2.5 rounded-2xl pl-2.5 pr-3 font-mono text-[13px] transition hover:border-lime-400/40",
          size === "sm" ? "h-9" : size === "lg" ? "h-14" : "h-11",
        )}
        aria-expanded={open}
      >
        <span className="relative">
          <AddressAvatar address={address} />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-neon shadow-neon" />
        </span>
        <span className="tabular">{shortAddress(address)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-white/50 transition", open && "rotate-180")} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl p-1.5"
          >
            <div className="px-3 pb-2.5 pt-2">
              <div className="label !text-[10px]">Connected · {chainName}</div>
              <div className="mt-1 break-all font-mono text-xs text-white/70">{address}</div>
            </div>
            <div className="hairline mx-2 mb-1" />
            <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} onClick={() => setOpen(false)}>
              Dashboard
            </MenuLink>
            {user?.role === "admin" && (
              <MenuLink href="/admin" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setOpen(false)}>
                Admin panel
              </MenuLink>
            )}
            <button
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
              onClick={() => {
                void navigator.clipboard.writeText(address);
                toast.success("Address copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy address
            </button>
            <button
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-200/90 transition hover:bg-red-500/10"
              onClick={async () => {
                setOpen(false);
                await signOut();
                disconnect();
                toast("Wallet disconnected");
              }}
            >
              <LogOut className="h-4 w-4" /> Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}
