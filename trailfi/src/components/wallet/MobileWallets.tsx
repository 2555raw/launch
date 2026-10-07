"use client";

import { Copy, ExternalLink, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { walletConnectEnabled } from "@/lib/web3/wagmi";

/**
 * On a phone, a normal browser has no wallet to talk to. Each wallet app has a
 * built-in browser that does, so these links reopen the current page inside it.
 */
const APPS = [
  {
    name: "Phantom",
    logo: "/wallets/phantom.svg",
    link: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
  {
    name: "MetaMask",
    logo: "/wallets/metamask.svg",
    link: (url: string) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    name: "Coinbase Wallet",
    logo: "/wallets/coinbase.svg",
    link: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
];

/** True on a phone or tablet whose browser has no injected wallet. */
export function useNeedsWalletApp() {
  const [needs, setNeeds] = useState(false);
  useEffect(() => {
    const w = window as unknown as { ethereum?: unknown; phantom?: { ethereum?: unknown } };
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setNeeds(mobile && !w.ethereum && !w.phantom?.ethereum);
  }, []);
  return needs;
}

export function MobileWalletSheet({ open, onClose, openConnectModal }: { open: boolean; onClose: () => void; openConnectModal?: () => void }) {
  const url = typeof window === "undefined" ? "" : window.location.href;
  return (
    <Modal open={open} onClose={onClose} title="Open in your wallet" subtitle="Your wallet app has its own browser. Strydo opens there and connects in one tap.">
      <div className="space-y-2">
        {APPS.map((a) => (
          <a
            key={a.name}
            href={url ? a.link(url) : "#"}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-left transition hover:border-lime-400/40 hover:bg-white/[0.06]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.logo} alt="" className="h-9 w-9 rounded-xl" />
            <span className="flex-1 text-left font-medium">{a.name}</span>
            <ExternalLink className="h-4 w-4 text-white/40" />
          </a>
        ))}
        {walletConnectEnabled && openConnectModal && (
          <button
            onClick={() => {
              onClose();
              openConnectModal();
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-left transition hover:border-lime-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
              <QrCode className="h-4 w-4" />
            </span>
            <span className="flex-1 text-left font-medium">Other wallets</span>
          </button>
        )}
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-[12.5px] leading-relaxed text-white/55">
        Using Rabby or another wallet? Copy the link and open it in the wallet&apos;s browser.
        <button
          onClick={() => {
            void navigator.clipboard.writeText(url);
            toast.success("Link copied");
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 font-medium text-white/80 transition hover:border-lime-400/40 hover:text-lime-300"
        >
          <Copy className="h-4 w-4" /> Copy link
        </button>
      </div>
    </Modal>
  );
}
