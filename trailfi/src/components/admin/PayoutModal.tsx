"use client";

import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Fuel, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatEther, formatUnits, type Hash } from "viem";
import { useAccount, useEstimateFeesPerGas, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDateTime, shortAddress } from "@/lib/format";
import { SUPPORTED_CHAINS, explorerAddressUrl, explorerTxUrl } from "@/lib/web3/chains";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { useAdminMeta, type Payout } from "./hooks";

type Phase = "idle" | "signing" | "submitting" | "mining" | "verifying";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  signing: "Waiting for your signature in the wallet…",
  submitting: "Recording the transaction…",
  mining: "Waiting for onchain confirmation…",
  verifying: "Verifying the transfer onchain…",
};

/**
 * Review-and-send dialog for one payout. Nothing moves until the admin ticks
 * the confirmation box, presses Send and approves the transfer in their own
 * wallet. The server then independently verifies the transaction.
 */
export function PayoutModal({ payout: initial, onClose }: { payout: Payout | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: meta } = useAdminMeta();
  const [payout, setPayout] = useState<Payout | null>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setPayout(initial);
    setConfirmed(false);
    setPhase("idle");
    setSuccess(false);
  }, [initial]);

  const chain = payout ? SUPPORTED_CHAINS[payout.chainId] : undefined;
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: payout?.chainId });
  const { writeContractAsync } = useWriteContract();
  const { data: fees } = useEstimateFeesPerGas({ chainId: payout?.chainId, query: { enabled: Boolean(payout) } });

  const authorised = Boolean(address && meta?.payoutWallets.includes(address.toLowerCase()));
  const onRightChain = walletChainId === payout?.chainId;
  const amountUnits = payout ? BigInt(payout.amountUnits) : 0n;

  const { data: balance } = useReadContract({
    address: payout?.tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: payout?.chainId,
    query: { enabled: Boolean(payout && address) },
  });

  const [gas, setGas] = useState<{ units: bigint; cost: bigint } | null | "error">(null);
  useEffect(() => {
    let cancelled = false;
    setGas(null);
    if (!payout || !publicClient || !(payout.status === "prepared" || payout.status === "requested")) return;
    const from = (address ?? meta?.payoutWallets[0]) as `0x${string}` | undefined;
    if (!from) return;
    publicClient
      .estimateContractGas({
        address: payout.tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [payout.walletAddress, BigInt(payout.amountUnits)],
        account: from,
      })
      .then((units) => {
        if (cancelled) return;
        const price = fees?.maxFeePerGas ?? fees?.gasPrice ?? 0n;
        setGas({ units, cost: units * price });
      })
      .catch(() => !cancelled && setGas("error"));
    return () => {
      cancelled = true;
    };
  }, [payout, publicClient, address, meta?.payoutWallets, fees]);

  const refresh = async (p?: Payout) => {
    if (p) setPayout(p);
    await qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const confirmLoop = async (id: string) => {
    setPhase("verifying");
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`/api/admin/payouts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const body = await res.json();
      if (res.status === 202) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (!res.ok) throw new Error(body.error ?? "Verification failed");
      await refresh(body.payout);
      if (body.payout.status === "confirmed") {
        setSuccess(true);
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.45 }, colors: ["#c4fb6d", "#b2f047", "#ffffff"] });
        toast.success("Payment confirmed onchain", { description: `${fmtAmount(body.payout.amount)} ${body.payout.tokenSymbol} sent.` });
      } else {
        toast.error("Payout failed verification", { description: body.payout.error });
      }
      return;
    }
    toast.message("Still pending", { description: "The transaction is not mined yet. Check again in a moment." });
  };

  const send = async () => {
    if (!payout || !address || !publicClient) return;
    let hash: Hash | undefined;
    try {
      setPhase("signing");
      hash = await writeContractAsync({
        address: payout.tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [payout.walletAddress, amountUnits],
        chainId: payout.chainId,
      });
      setPhase("submitting");
      const { payout: submitted } = await api<{ payout: Payout }>(`/api/admin/payouts/${payout.id}`, {
        method: "PATCH",
        json: { action: "submit", txHash: hash, from: address },
      });
      await refresh(submitted);
      setPhase("mining");
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 });
      await confirmLoop(payout.id);
    } catch (err) {
      const e = err as Error & { shortMessage?: string };
      const msg = e.shortMessage ?? e.message;
      toast.error(hash ? "Transaction sent but not yet confirmed" : "Transfer not sent", { description: msg.slice(0, 180) });
    } finally {
      setPhase("idle");
    }
  };

  const act = async (action: "cancel" | "simulate") => {
    if (!payout) return;
    try {
      const { payout: next } = await api<{ payout: Payout }>(`/api/admin/payouts/${payout.id}`, { method: "PATCH", json: { action } });
      await refresh(next);
      if (action === "simulate") {
        setSuccess(true);
        toast.success("Marked as paid (simulation)", { description: "No onchain transfer was made." });
      } else {
        toast("Payout cancelled", { description: "Its rewards are back to approved." });
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const busy = phase !== "idle";
  const insufficient = balance !== undefined && balance < amountUnits;
  const tokenReady = meta?.tokenReady !== false;
  const canSend =
    (payout?.status === "prepared" || payout?.status === "requested") && tokenReady && isConnected && authorised && onRightChain && confirmed && !busy && !insufficient;
  const txUrl = payout?.txHash ? explorerTxUrl(payout.chainId, payout.txHash) : null;

  return (
    <Modal
      open={Boolean(payout)}
      onClose={onClose}
      dismissable={!busy}
      title={success ? undefined : "Review payout"}
      subtitle={success ? undefined : "Check every field twice. Onchain transfers cannot be reversed."}
      className="sm:max-w-xl"
    >
      {payout && (
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 15 }}
                className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-400 text-forest-950 shadow-glow"
              >
                <Check className="h-10 w-10" strokeWidth={3} />
              </motion.div>
              <h3 className="mt-6 font-display text-2xl font-bold">{payout.simulated ? "Payout simulated" : "Payment confirmed"}</h3>
              <p className="mt-2 text-white/60">
                {fmtAmount(payout.amount)} {payout.tokenSymbol} → <span className="font-mono">{shortAddress(payout.walletAddress)}</span>
              </p>
              {txUrl && (
                <a href={txUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 font-mono text-sm text-lime-300 hover:underline">
                  {shortAddress(payout.txHash, 10, 8)} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <div className="mt-8">
                <Button variant="secondary" onClick={onClose}>
                  Done
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Amount */}
              <div className="rounded-2xl border border-lime-400/25 bg-lime-400/[0.06] p-5">
                <div className="flex items-center justify-between">
                  <span className="label !text-lime-300/80">Amount</span>
                  <StatusBadge status={payout.status} />
                </div>
                <div className="mt-2 font-display text-4xl font-bold text-lime-300 tabular">
                  {fmtAmount(payout.amount)} <span className="text-xl text-white/60">{payout.tokenSymbol}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-white/40">
                  {payout.amountUnits} base units · {payout.rewardCount} reward{payout.rewardCount === 1 ? "" : "s"} · user #{payout.userShortId}
                </div>
              </div>

              <dl className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02] text-sm">
                <Row k="Destination">
                  <div className="flex items-center gap-2">
                    <span className="break-all font-mono text-[12.5px]">{payout.walletAddress}</span>
                    <button
                      aria-label="Copy destination"
                      className="shrink-0 text-white/40 hover:text-white"
                      onClick={() => {
                        void navigator.clipboard.writeText(payout.walletAddress);
                        toast.success("Destination copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Row>
                <Row k="Token">
                  <a
                    href={explorerAddressUrl(payout.chainId, payout.tokenAddress) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-lime-300"
                  >
                    {payout.tokenSymbol} <span className="font-mono text-[12px] text-white/45">{shortAddress(payout.tokenAddress)}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Row>
                <Row k="Network">
                  {chain?.name ?? payout.chainId}
                  {chain?.testnet && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">testnet</span>}
                </Row>
                <Row k="Estimated gas">
                  <span className="inline-flex items-center gap-1.5">
                    <Fuel className="h-3.5 w-3.5 text-white/40" />
                    {!(payout.status === "prepared" || payout.status === "requested")
                      ? payout.gasUsed
                        ? `${Number(payout.gasUsed).toLocaleString()} gas used`
                        : "Not recorded"
                      : gas === null
                        ? "Estimating…"
                        : gas === "error"
                          ? "Unavailable (check balance / network)"
                          : `${Number(gas.units).toLocaleString()} gas ≈ ${Number(formatEther(gas.cost)).toFixed(6)} ${chain?.nativeCurrency.symbol ?? "ETH"}`}
                  </span>
                </Row>
                <Row k="Status">
                  <span className="capitalize">{payout.status}</span>
                  {payout.submittedAt && <span className="ml-2 text-white/40">· sent {fmtDateTime(payout.submittedAt)}</span>}
                </Row>
                <Row k="Transaction">
                  {payout.txHash ? (
                    <a href={txUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12.5px] hover:text-lime-300">
                      {shortAddress(payout.txHash, 10, 8)} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-white/40">Available after sending</span>
                  )}
                </Row>
              </dl>

              {payout.error && (
                <div className="flex gap-2.5 rounded-2xl border border-red-400/25 bg-red-500/[0.07] p-3.5 text-[13px] text-red-100">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {payout.error}
                </div>
              )}

              {(payout.status === "prepared" || payout.status === "requested") && (
                <>
                  {/* Sender checks */}
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-[13px]">
                    <div className="label !text-[10px]">Sending wallet</div>
                    {!tokenReady && (
                      <Check2 ok={false} text={`${payout.tokenSymbol} is not a token on ${chain?.name ?? "this network"}. Set the right contract in Settings.`} />
                    )}
                    {!isConnected ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/60">Connect an authorised payout wallet.</span>
                        <ConnectWallet size="sm" />
                      </div>
                    ) : (
                      <>
                        <Check2 ok={authorised} text={authorised ? `${shortAddress(address)} is an authorised payout wallet` : `${shortAddress(address)} is not in PAYOUT_WALLETS`} />
                        <div className="flex items-center justify-between gap-3">
                          <Check2 ok={onRightChain} text={onRightChain ? `Connected to ${chain?.name}` : `Wallet is on another network`} />
                          {!onRightChain && (
                            <Button size="sm" variant="outline" loading={switching} onClick={() => switchChainAsync({ chainId: payout.chainId }).catch(() => undefined)}>
                              Switch to {chain?.name}
                            </Button>
                          )}
                        </div>
                        {balance !== undefined && (
                          <Check2
                            ok={!insufficient}
                            text={`Balance ${fmtAmount(formatUnits(balance, payout.tokenDecimals))} ${payout.tokenSymbol}${insufficient ? " · insufficient" : ""}`}
                          />
                        )}
                      </>
                    )}
                  </div>

                  <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-[13px] leading-relaxed text-white/75 transition hover:border-white/20">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-lime-400"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      disabled={busy}
                    />
                    I have checked the destination address, amount, token and network. I authorise this transfer and
                    understand it cannot be reversed.
                  </label>

                  {busy && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-[13px] text-white/80">
                      <Loader2 className="h-4 w-4 animate-spin" /> {PHASE_LABEL[phase]}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1" disabled={!canSend} loading={busy} onClick={send} icon={<ShieldCheck className="h-4 w-4" />}>
                      Sign &amp; send {fmtAmount(payout.amount)} {payout.tokenSymbol}
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => act("cancel")}>
                      {payout.status === "requested" ? "Reject request" : "Cancel payout"}
                    </Button>
                  </div>
                  {meta?.demoMode && (
                    <button
                      disabled={busy}
                      onClick={() => act("simulate")}
                      className="w-full rounded-xl border border-dashed border-amber-400/30 px-3 py-2.5 text-[12.5px] text-amber-200/80 transition hover:bg-amber-400/5"
                    >
                      Demo mode: mark as paid without a transfer (simulated)
                    </button>
                  )}
                </>
              )}

              {payout.status === "submitted" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1"
                    loading={busy}
                    onClick={() =>
                      confirmLoop(payout.id)
                        .catch((e: Error) => toast.error(e.message))
                        .finally(() => setPhase("idle"))
                    }
                  >
                    Verify onchain confirmation
                  </Button>
                </div>
              )}

              {payout.status === "failed" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="danger" className="flex-1" onClick={() => act("cancel")}>
                    Cancel and release rewards
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Modal>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-white/45">{k}</dt>
      <dd className="text-white/90 sm:text-right">{children}</dd>
    </div>
  );
}

function Check2({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={cn("flex items-center gap-2", ok ? "text-white/75" : "text-amber-200")}>
      {ok ? <CheckCircle2 className="h-4 w-4 text-lime-400" /> : <AlertTriangle className="h-4 w-4" />}
      {text}
    </div>
  );
}
