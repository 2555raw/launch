"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, CircleCheck, Copy, LoaderCircle, RotateCcw, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { connectEvm, detectEvmWallets, ensureChain, evmMetaMaskLink, sendEvmTx, type Eip1193, type EvmWalletOption } from "@/lib/evm-wallet";
import { evmChains, padTokenUrl, PUMP_CREATE_COST_SOL, shortAddress, txUrl, type WalletKind } from "@/lib/onchain";
import { getChain, getPad } from "@/lib/pads";
import { connectWallet, detectWallets, phantomBrowseLink, walletErrorMessage, type WalletOption } from "@/lib/wallet";
import { useApp } from "@/components/shell/AppProvider";
import { PadGlyph } from "@/components/ui/PadGlyph";
import { useCopy } from "@/components/ui/useCopy";

type Step = "save" | "prepare" | "sign" | "send" | "confirm";

type Run =
  | { state: "idle" }
  | { state: "running"; step: Step; detail?: string }
  | { state: "error"; step: Step; message: string; tx?: string }
  | { state: "live"; token: string; tx: string; ticker: string };

type Connected =
  | { kind: "solana"; option: WalletOption; address: string }
  | { kind: "evm"; option: EvmWalletOption; address: string };

/** What the launch costs on each pad, before any opening buy. */
const costs: Record<string, string> = {
  pump: `about ${PUMP_CREATE_COST_SOL} SOL`,
  pons: "the 0.0005 ETH Pons launch fee plus gas",
  flap: "gas only (Flap has no launch fee)",
  argus: "gas only, paid in USDC",
  stonk: "rent and network fees in SOL",
};

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

async function waitForReceipt(p: Eip1193, hash: string) {
  for (let i = 0; i < 90; i++) {
    const r = (await p.request({ method: "eth_getTransactionReceipt", params: [hash] }).catch(() => null)) as { status?: string } | null;
    if (r?.status) {
      if (r.status !== "0x1") throw new Error("The approval transaction failed.");
      return;
    }
    await sleep(2000);
  }
  throw new Error("The approval is taking too long to confirm. Try again in a moment.");
}

/**
 * The on-chain path: the person's own wallet (Solana or EVM) signs and pays.
 * The server builds the transaction and checks the result; keys stay in the wallet.
 */
export function OnChainLaunch({
  wallet: kind,
  pad: padId,
  payload,
  ticker,
  openingBuy,
  validate,
  onFieldErrors,
}: {
  wallet: WalletKind;
  pad: string;
  payload: Record<string, unknown>;
  ticker: string;
  openingBuy: string;
  validate: () => boolean;
  onFieldErrors: (fields: Record<string, string>) => void;
}) {
  const { toast } = useApp();
  const { copied, copy } = useCopy();
  const pad = getPad(padId)!;
  const chain = getChain(pad.chain)!;
  const [solWallets, setSolWallets] = useState<WalletOption[] | null>(null);
  const [evmWallets, setEvmWallets] = useState<EvmWalletOption[] | null>(null);
  const [wallet, setWallet] = useState<Connected | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string>();
  const [run, setRun] = useState<Run>({ state: "idle" });
  const draft = useRef<{ key: string; id: string } | null>(null);

  // Wallet extensions inject after load; look again shortly after mount.
  useEffect(() => {
    if (kind === "solana") {
      setSolWallets(detectWallets());
      const t = setTimeout(() => setSolWallets(detectWallets()), 800);
      return () => clearTimeout(t);
    }
    let alive = true;
    detectEvmWallets().then((w) => alive && setEvmWallets(w));
    return () => {
      alive = false;
    };
  }, [kind]);

  // A connected wallet of the other kind is useless on this pad.
  useEffect(() => {
    setWallet((w) => (w && w.kind !== kind ? null : w));
    setRun({ state: "idle" });
  }, [kind, padId]);

  const steps: { id: Step; label: string }[] = [
    { id: "save", label: "Save the draft" },
    { id: "prepare", label: "Prepare the launch" },
    { id: "sign", label: "Approve in your wallet" },
    { id: "send", label: kind === "solana" ? "Send to Solana" : `Send to ${chain.name}` },
    { id: "confirm", label: "Wait for confirmation" },
  ];

  async function connectSol(option: WalletOption) {
    setConnecting(option.id);
    setWalletError(undefined);
    try {
      setWallet({ kind: "solana", option, address: await connectWallet(option) });
    } catch (err) {
      setWalletError(walletErrorMessage(err));
    } finally {
      setConnecting(null);
    }
  }

  async function connectE(option: EvmWalletOption) {
    setConnecting(option.id);
    setWalletError(undefined);
    try {
      setWallet({ kind: "evm", option, address: await connectEvm(option) });
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
    let tx: string | undefined;
    try {
      setRun({ state: "running", step });
      const key = JSON.stringify(payload);
      if (draft.current?.key !== key) {
        const saved = await post<{ id: string }>("/api/drafts", payload);
        draft.current = { key, id: saved.id };
      }
      const id = draft.current.id;
      let token: string | undefined;

      if (wallet.kind === "solana") {
        setRun({ state: "running", step: (step = "prepare") });
        const { Keypair, VersionedTransaction } = await import("@solana/web3.js");
        const mint = Keypair.generate();
        token = mint.publicKey.toBase58();
        const prepared = await post<{ transaction: string }>(`/api/launches/${id}/prepare`, { creator: wallet.address, mint: token });

        setRun({ state: "running", step: (step = "sign") });
        const t = VersionedTransaction.deserialize(fromBase64(prepared.transaction));
        const provider = wallet.option.provider;
        if (provider.signAndSendTransaction) {
          // Wallets that submit themselves (Phantom's recommended path): the mint
          // signs first, then the wallet adds its signature and sends it.
          t.sign([mint]);
          const sent = await provider.signAndSendTransaction(t).catch((err) => {
            throw new Error(walletErrorMessage(err));
          });
          tx = typeof sent === "string" ? sent : sent.signature;
          setRun({ state: "running", step: (step = "send") });
        } else {
          // Otherwise the wallet signs, the mint adds its signature and the server relays it.
          const signed = await provider.signTransaction(t).catch((err) => {
            throw new Error(walletErrorMessage(err));
          });
          signed.sign([mint]);
          setRun({ state: "running", step: (step = "send") });
          ({ signature: tx } = await post<{ signature: string }>(`/api/launches/${id}/send`, { transaction: toBase64(signed.serialize()) }));
        }
      } else {
        const evm = evmChains[pad.chain];
        setRun({ state: "running", step: (step = "prepare") });
        const prepared = await post<{ chainId: number; calls: { to: string; data: string; value: string; label: string }[] }>(
          `/api/launches/${id}/prepare`,
          { creator: wallet.address },
        );
        const p = wallet.option.provider;
        setRun({ state: "running", step: (step = "sign"), detail: `Switch to ${evm.chainName}` });
        await ensureChain(p, {
          chainId: evm.chainId,
          chainName: evm.chainName,
          rpcUrls: [evm.rpcUrl],
          nativeCurrency: evm.nativeCurrency,
          blockExplorerUrls: [evm.explorer],
        }).catch((err) => {
          throw new Error(walletErrorMessage(err));
        });
        for (const [i, c] of prepared.calls.entries()) {
          const last = i === prepared.calls.length - 1;
          setRun({ state: "running", step: (step = "sign"), detail: prepared.calls.length > 1 ? `${c.label} (${i + 1}/${prepared.calls.length})` : undefined });
          const hash = await sendEvmTx(p, wallet.address, c).catch((err) => {
            throw new Error(walletErrorMessage(err));
          });
          if (last) tx = hash;
          else {
            setRun({ state: "running", step: (step = "send"), detail: c.label });
            await waitForReceipt(p, hash);
          }
        }
        setRun({ state: "running", step: (step = "send") });
      }

      setRun({ state: "running", step: (step = "confirm") });
      for (let i = 0; i < 60; i++) {
        await sleep(2000);
        const r = await post<{ state: string; launch: { statusNote?: string; address?: string } }>(`/api/launches/${id}/confirm`, { signature: tx }).catch(
          () => null,
        );
        if (r?.state === "live") {
          draft.current = null;
          token = r.launch.address ?? token!;
          setRun({ state: "live", token, tx: tx!, ticker });
          toast({ kind: "success", title: `$${ticker} is live`, body: `Created on ${pad.name} from your wallet.` });
          return;
        }
        if (r?.state === "failed") throw new Error(r.launch.statusNote ?? "The transaction failed on-chain.");
      }
      throw new Error("Still not confirmed. Check the transaction in the explorer; it may land in a moment.");
    } catch (err) {
      const e = err as Error & { fields?: Record<string, string> };
      if (e.fields) onFieldErrors(e.fields);
      setRun({ state: "error", step, message: e.message || "Something went wrong.", tx });
    }
  }

  const running = run.state === "running";
  const stepIndex = run.state === "running" || run.state === "error" ? steps.findIndex((s) => s.id === run.step) : -1;
  const buy = Number(openingBuy) || 0;
  const here = typeof window === "undefined" ? "https://padpicker.xyz/launch" : window.location.href;
  const options = kind === "solana" ? solWallets : evmWallets;

  return (
    <div className="rounded-2xl border border-line-strong bg-ink-2 p-5">
      <AnimatePresence mode="wait" initial={false}>
        {run.state === "live" ? (
          <motion.div key="live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="status">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CircleCheck className="size-5 text-mint" aria-hidden="true" /> ${run.ticker} is live on {pad.name}
            </p>
            <p className="mt-2 text-sm text-fog">Created and signed by your wallet. The contract address (CA):</p>
            <button
              type="button"
              onClick={() => copy(run.token, "mint")}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left font-mono text-sm transition hover:border-white/25"
            >
              <span className="min-w-0 break-all">{run.token}</span>
              {copied === "mint" ? <Check className="size-4 shrink-0 text-mint" /> : <Copy className="size-4 shrink-0 text-fog" />}
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {padTokenUrl(pad.id, run.token) ? (
                <a href={padTokenUrl(pad.id, run.token)!} target="_blank" rel="noreferrer" className="btn btn-primary">
                  Open on {pad.name} <ArrowUpRight className="size-4" />
                </a>
              ) : (
                <a href={`${chain.explorer}${run.token}`} target="_blank" rel="noreferrer" className="btn btn-primary">
                  View token <ArrowUpRight className="size-4" />
                </a>
              )}
              <a href={txUrl(pad.chain, run.tx)} target="_blank" rel="noreferrer" className="btn btn-ghost">
                Transaction <ArrowUpRight className="size-4" />
              </a>
              <Link href={`/explore?q=${run.token}`} className="btn btn-ghost">
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
              <PadGlyph pad={pad.id} size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold">
                  Launch on {pad.name} from your wallet
                </p>
                <p className="mt-1 text-sm text-fog">
                  Your wallet signs and pays {costs[pad.id] ?? "the network fees"}
                  {buy > 0 ? `, plus the ${buy} ${String(payload.pair ?? chain.native)} opening buy` : ""}.
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
              ) : options === null ? null : options.length ? (
                <div className="flex flex-wrap gap-2">
                  {kind === "solana"
                    ? solWallets!.map((w) => (
                        <button key={w.id} type="button" className="btn btn-ghost" disabled={connecting !== null} onClick={() => connectSol(w)}>
                          {connecting === w.id ? <LoaderCircle className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                          Connect {w.name}
                        </button>
                      ))
                    : evmWallets!.map((w) => (
                        <button key={w.id} type="button" className="btn btn-ghost" disabled={connecting !== null} onClick={() => connectE(w)}>
                          {connecting === w.id ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : w.icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={w.icon} alt="" className="size-4 rounded" />
                          ) : (
                            <Wallet className="size-4" />
                          )}
                          Connect {w.name}
                        </button>
                      ))}
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
                  <p className="text-fog">No {kind === "solana" ? "Solana" : "EVM"} wallet in this browser.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {kind === "solana" ? (
                      <>
                        <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                          Get Phantom <ArrowUpRight className="size-3.5" />
                        </a>
                        <a href={phantomBrowseLink(here)} className="btn btn-ghost btn-sm">
                          Open in Phantom app <ArrowUpRight className="size-3.5" />
                        </a>
                      </>
                    ) : (
                      <>
                        <a href="https://metamask.io/download" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                          Get MetaMask <ArrowUpRight className="size-3.5" />
                        </a>
                        <a href={evmMetaMaskLink(here)} className="btn btn-ghost btn-sm">
                          Open in MetaMask app <ArrowUpRight className="size-3.5" />
                        </a>
                      </>
                    )}
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
                    <li key={s.id} className={cn("flex items-center gap-2.5", done || current ? "text-bone" : "text-mute")}>
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
                      {current && run.state === "running" && run.detail && <span className="text-xs text-mute">· {run.detail}</span>}
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
                {run.tx && (
                  <a href={txUrl(pad.chain, run.tx)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-fog underline underline-offset-4">
                    View the transaction <ArrowUpRight className="size-3" />
                  </a>
                )}
              </div>
            )}

            <button type="button" className="btn btn-accent btn-lg mt-4 w-full sm:w-auto" disabled={!wallet || running} onClick={launch} aria-busy={running}>
              {running ? <LoaderCircle className="size-4 animate-spin" /> : <PadGlyph pad={pad.id} size="sm" className="!size-4 !rounded-full" />}
              {running ? steps[stepIndex]?.label + "…" : run.state === "error" ? "Try again" : `Launch on ${pad.name}`}
            </button>
            {!wallet && (
              <p className="mt-2 text-xs text-mute">
                Connect a wallet to launch. You approve {kind === "evm" && pad.id === "argus" && buy > 0 ? "a USDC approval and then the launch" : "a single transaction"}.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
