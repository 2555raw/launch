"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, CircleCheck, Copy, LoaderCircle, RotateCcw, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PUMP_CREATE_COST_SOL, pumpCoinUrl, shortAddress, solscanTxUrl } from "@/lib/onchain";
import { connectWallet, detectWallets, phantomBrowseLink, walletErrorMessage, type WalletOption } from "@/lib/wallet";
import { useApp } from "@/components/shell/AppProvider";
import { PadGlyph } from "@/components/ui/PadGlyph";
import { useCopy } from "@/components/ui/useCopy";

type Step = "save" | "prepare" | "sign" | "send" | "confirm";
const steps: { id: Step; label: string }[] = [
  { id: "save", label: "Save the draft" },
  { id: "prepare", label: "Upload metadata and build the transaction" },
  { id: "sign", label: "Approve in your wallet" },
  { id: "send", label: "Send to Solana" },
  { id: "confirm", label: "Wait for confirmation" },
];

type Run =
  | { state: "idle" }
  | { state: "running"; step: Step }
  | { state: "error"; step: Step; message: string; signature?: string }
  | { state: "live"; mint: string; signature: string; ticker: string };

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post<T>(url: string, body: unknown): Promise<T & { fields?: Record<string, string> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status}).`), { fields: data.fields });
  return data;
}

/**
 * The on-chain path for Pump.fun: the person's own Solana wallet signs and
 * pays. The server builds the transaction and relays it; keys stay in the wallet.
 */
export function OnChainLaunch({
  payload,
  ticker,
  openingBuy,
  validate,
  onFieldErrors,
}: {
  payload: Record<string, unknown>;
  ticker: string;
  openingBuy: string;
  validate: () => boolean;
  onFieldErrors: (fields: Record<string, string>) => void;
}) {
  const { toast } = useApp();
  const { copied, copy } = useCopy();
  const [wallets, setWallets] = useState<WalletOption[] | null>(null);
  const [wallet, setWallet] = useState<{ option: WalletOption; address: string } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string>();
  const [run, setRun] = useState<Run>({ state: "idle" });
  const draft = useRef<{ key: string; id: string } | null>(null);

  // Wallet extensions inject after load; look again shortly after mount.
  useEffect(() => {
    setWallets(detectWallets());
    const t = setTimeout(() => setWallets(detectWallets()), 800);
    return () => clearTimeout(t);
  }, []);

  async function connect(option: WalletOption) {
    setConnecting(option.id);
    setWalletError(undefined);
    try {
      setWallet({ option, address: await connectWallet(option) });
    } catch (err) {
      setWalletError(walletErrorMessage(err));
    } finally {
      setConnecting(null);
    }
  }

  async function launch() {
    if (!wallet || run.state === "running") return;
    if (!validate()) return;
    let step: Step = "save";
    let signature: string | undefined;
    try {
      setRun({ state: "running", step });
      const key = JSON.stringify(payload);
      if (draft.current?.key !== key) {
        const saved = await post<{ id: string }>("/api/drafts", payload);
        draft.current = { key, id: saved.id };
      }
      const id = draft.current.id;

      setRun({ state: "running", step: (step = "prepare") });
      const { Keypair, VersionedTransaction } = await import("@solana/web3.js");
      const mint = Keypair.generate();
      const prepared = await post<{ transaction: string }>(`/api/launches/${id}/prepare`, {
        creator: wallet.address,
        mint: mint.publicKey.toBase58(),
      });

      setRun({ state: "running", step: (step = "sign") });
      const tx = VersionedTransaction.deserialize(fromBase64(prepared.transaction));
      // The wallet signs first, then the mint keypair adds its signature.
      const signed = await wallet.option.provider.signTransaction(tx).catch((err) => {
        throw new Error(walletErrorMessage(err));
      });
      signed.sign([mint]);

      setRun({ state: "running", step: (step = "send") });
      ({ signature } = await post<{ signature: string }>(`/api/launches/${id}/send`, { transaction: toBase64(signed.serialize()) }));

      setRun({ state: "running", step: (step = "confirm") });
      for (let i = 0; i < 45; i++) {
        await sleep(2000);
        const r = await post<{ state: string; launch: { statusNote?: string } }>(`/api/launches/${id}/confirm`, { signature }).catch(() => null);
        if (r?.state === "live") {
          draft.current = null;
          setRun({ state: "live", mint: mint.publicKey.toBase58(), signature, ticker });
          toast({ kind: "success", title: `$${ticker} is live`, body: "Created on Pump.fun from your wallet." });
          return;
        }
        if (r?.state === "failed") throw new Error(r.launch.statusNote ?? "The transaction failed on Solana.");
      }
      throw new Error("Still not confirmed. Check the transaction on Solscan; it may land in a moment.");
    } catch (err) {
      const e = err as Error & { fields?: Record<string, string> };
      if (e.fields) onFieldErrors(e.fields);
      setRun({ state: "error", step, message: e.message || "Something went wrong.", signature });
    }
  }

  const running = run.state === "running";
  const stepIndex = run.state === "running" || run.state === "error" ? steps.findIndex((s) => s.id === run.step) : -1;
  const buy = Number(openingBuy) || 0;

  return (
    <div className="rounded-2xl border border-line-strong bg-ink-2 p-5">
      <AnimatePresence mode="wait" initial={false}>
        {run.state === "live" ? (
          <motion.div key="live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="status">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CircleCheck className="size-5 text-mint" aria-hidden="true" /> ${run.ticker} is live on Pump.fun
            </p>
            <p className="mt-2 text-sm text-fog">Created and signed by your wallet. The contract address:</p>
            <button
              type="button"
              onClick={() => copy(run.mint, "mint")}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left font-mono text-sm transition hover:border-white/25"
            >
              <span className="min-w-0 break-all">{run.mint}</span>
              {copied === "mint" ? <Check className="size-4 shrink-0 text-mint" /> : <Copy className="size-4 shrink-0 text-fog" />}
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={pumpCoinUrl(run.mint)} target="_blank" rel="noreferrer" className="btn btn-primary">
                Open on Pump.fun <ArrowUpRight className="size-4" />
              </a>
              <a href={solscanTxUrl(run.signature)} target="_blank" rel="noreferrer" className="btn btn-ghost">
                Transaction <ArrowUpRight className="size-4" />
              </a>
              <Link href={`/explore?q=${run.mint}`} className="btn btn-ghost">
                See it on Explore
              </Link>
              <button type="button" className="btn btn-ghost text-fog" onClick={() => setRun({ state: "idle" })}>
                <RotateCcw className="size-4" /> Launch another
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="flow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-start gap-3">
              <PadGlyph pad="pump" size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold">Launch on Pump.fun from your wallet</p>
                <p className="mt-1 text-sm text-fog">
                  Your wallet signs and pays: about {PUMP_CREATE_COST_SOL} SOL
                  {buy > 0 ? ` plus the ${buy} SOL opening buy (with a small routing fee)` : ""}.
                </p>
              </div>
            </div>

            <div className="mt-4">
              {wallet ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-mint" aria-hidden="true" />
                    {wallet.option.name} · <span className="font-mono">{shortAddress(wallet.address)}</span>
                  </span>
                  <button type="button" className="text-xs text-mute underline-offset-4 hover:text-bone hover:underline" disabled={running} onClick={() => setWallet(null)}>
                    Change
                  </button>
                </div>
              ) : wallets === null ? null : wallets.length ? (
                <div className="flex flex-wrap gap-2">
                  {wallets.map((w) => (
                    <button key={w.id} type="button" className="btn btn-ghost" disabled={connecting !== null} onClick={() => connect(w)}>
                      {connecting === w.id ? <LoaderCircle className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                      Connect {w.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
                  <p className="text-fog">No Solana wallet in this browser.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                      Get Phantom <ArrowUpRight className="size-3.5" />
                    </a>
                    <a href={phantomBrowseLink(typeof window === "undefined" ? "https://padpicker.xyz/launch" : window.location.href)} className="btn btn-ghost btn-sm">
                      Open in Phantom app <ArrowUpRight className="size-3.5" />
                    </a>
                  </div>
                </div>
              )}
              {walletError && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {walletError}
                </p>
              )}
            </div>

            {(running || run.state === "error") && (
              <ol className="mt-4 space-y-2 text-sm" aria-label="Launch progress">
                {steps.map((s, i) => {
                  const done = i < stepIndex;
                  const current = i === stepIndex;
                  const failed = current && run.state === "error";
                  return (
                    <li key={s.id} className={cn("flex items-center gap-2.5", done ? "text-bone" : current ? "text-bone" : "text-mute")}>
                      {done ? (
                        <Check className="size-4 text-mint" aria-hidden="true" />
                      ) : failed ? (
                        <TriangleAlert className="size-4 text-danger" aria-hidden="true" />
                      ) : current ? (
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <span className="size-4 rounded-full border border-line-strong" aria-hidden="true" />
                      )}
                      {s.label}
                    </li>
                  );
                })}
              </ol>
            )}

            {run.state === "error" && (
              <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {run.message}
                </p>
                {run.signature && (
                  <a href={solscanTxUrl(run.signature)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-fog underline underline-offset-4">
                    View on Solscan <ArrowUpRight className="size-3" />
                  </a>
                )}
              </div>
            )}

            <button type="button" className="btn btn-accent btn-lg mt-4 w-full sm:w-auto" disabled={!wallet || running} onClick={launch} aria-busy={running}>
              {running ? <LoaderCircle className="size-4 animate-spin" /> : <PadGlyph pad="pump" size="sm" className="!size-4 !rounded-full" />}
              {running ? steps[stepIndex]?.label + "…" : run.state === "error" ? "Try again" : "Launch on Pump.fun"}
            </button>
            {!wallet && <p className="mt-2 text-xs text-mute">Connect a wallet to launch. You approve a single transaction.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
