"use client";

import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { AlertTriangle, Check, Loader2, Send, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatEther, formatUnits, parseUnits } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useSendTransaction, useSwitchChain, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { fmtAmount } from "@/lib/format";
import { PAYOUT_CHAIN_ID } from "@/lib/web3/chains";
import { ERC20_ABI, fmtEth, isNativeToken, usdToWei } from "@/lib/web3/tokens";
import { NATIVE_GAS_MARGIN_WEI, needsRequote, requotePayout, useAdminMeta, type Payout } from "./hooks";

/** One walker to pay: either a request already on file, or a verified walker to prepare first. */
export interface BatchItem {
  key: string;
  userShortId: number;
  walletAddress: `0x${string}`;
  /** The walker's verified dollars; for a payout on file its usdAmount is used instead. */
  amount: string;
  payout?: Payout;
  userId?: string;
}

type RowState = "queued" | "signing" | "sent" | "confirmed" | "failed" | "skipped";

/**
 * Pays several walkers in a row from the admin's wallet. Each transfer is still its own
 * transaction that the admin approves in the wallet; the dialog prepares, sends, records
 * and verifies them one after another and stops if one is rejected.
 */
export function BatchPayoutModal({ items, open, onClose }: { items: BatchItem[]; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: meta } = useAdminMeta();
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: PAYOUT_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const [checked, setChecked] = useState(false);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<Record<string, RowState>>({});
  // Freeze the list when the dialog opens, so background refreshes don't reshuffle it mid batch.
  const [list, setList] = useState<BatchItem[]>(items);

  useEffect(() => {
    if (open) {
      setChecked(false);
      setState({});
      setList(items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const token = meta?.settings;
  const tokenAddress = token?.payoutTokenAddress as `0x${string}` | undefined;
  const decimals = token?.payoutTokenDecimals ?? 6;
  const symbol = token?.payoutTokenSymbol ?? "USDG";
  // Native ETH: rewards are dollars, converted at the ETH price when each payout is quoted.
  const native = isNativeToken(tokenAddress);
  const price = meta?.ethUsdPrice ?? null;
  const usdOf = (i: BatchItem) => i.payout?.usdAmount ?? i.amount;
  // The ETH an item will send: its own quote when still fresh, otherwise an estimate at the current price.
  const weiOf = (i: BatchItem): bigint | null =>
    i.payout && !needsRequote(i.payout) ? BigInt(i.payout.amountUnits) : price !== null ? usdToWei(Number(usdOf(i)).toFixed(6), price.toFixed(2)) : null;
  const total = list.reduce((t, i) => t + Number(usdOf(i)), 0);
  const pending = list.filter((i) => state[i.key] !== "confirmed");
  const priceMissing = native && pending.some((i) => weiOf(i) === null);
  const totalUnits = native
    ? pending.reduce((t, i) => t + (weiOf(i) ?? 0n), 0n)
    : list.reduce((t, i) => t + parseUnits(Number(usdOf(i)).toFixed(decimals), decimals), 0n);
  // Every native transfer also pays gas from the same wallet: keep a small margin per transfer.
  const required = native ? totalUnits + NATIVE_GAS_MARGIN_WEI * BigInt(pending.length) : totalUnits;

  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: PAYOUT_CHAIN_ID,
    query: { enabled: Boolean(open && address && tokenAddress && !native) },
  });
  const { data: nativeBalance } = useBalance({ address, chainId: PAYOUT_CHAIN_ID, query: { enabled: Boolean(open && address && native) } });
  const balance = native ? nativeBalance?.value : tokenBalance;

  const authorised = Boolean(address && meta?.payoutWallets.includes(address.toLowerCase()));
  const onRightChain = chainId === PAYOUT_CHAIN_ID;
  const insufficient = balance !== undefined && balance < required;
  const done = list.length > 0 && list.every((i) => state[i.key] === "confirmed");
  const canSend =
    list.length > 0 &&
    isConnected &&
    authorised &&
    onRightChain &&
    checked &&
    !running &&
    !insufficient &&
    !priceMissing &&
    !done &&
    meta?.tokenReady !== false;

  const mark = (key: string, s: RowState) => setState((prev) => ({ ...prev, [key]: s }));

  const confirmOnChain = async (id: string) => {
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`/api/admin/payouts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (res.status === 202) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      const body = await res.json();
      return res.ok && body.payout?.status === "confirmed";
    }
    return false;
  };

  const run = async () => {
    if (!address || !publicClient) return;
    setRunning(true);
    let paid = 0;
    try {
      for (const item of list) {
        if (state[item.key] === "confirmed") continue;
        try {
          mark(item.key, "signing");
          let payout = item.payout;
          if (!payout) {
            payout = (await api<{ payout: Payout }>("/api/admin/payouts", { method: "POST", json: { userId: item.userId } })).payout;
          }
          // A request priced over ten minutes ago gets a fresh ETH price before the wallet is asked to sign.
          if (needsRequote(payout)) payout = await requotePayout(payout.id);
          // One wallet approval per transfer: native ETH is a plain value transfer, anything else an ERC20 transfer.
          const hash = isNativeToken(payout.tokenAddress)
            ? await sendTransactionAsync({ to: payout.walletAddress, value: BigInt(payout.amountUnits), chainId: payout.chainId })
            : await writeContractAsync({
                address: payout.tokenAddress,
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [payout.walletAddress, BigInt(payout.amountUnits)],
                chainId: payout.chainId,
              });
          await api(`/api/admin/payouts/${payout.id}`, { method: "PATCH", json: { action: "submit", txHash: hash, from: address } });
          mark(item.key, "sent");
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 });
          const ok = await confirmOnChain(payout.id);
          mark(item.key, ok ? "confirmed" : "failed");
          if (ok) paid++;
        } catch (err) {
          const e = err as Error & { shortMessage?: string };
          mark(item.key, "failed");
          const rejected = /reject|denied|cancel/i.test(e.shortMessage ?? e.message);
          toast.error(rejected ? "Batch stopped" : `Payment to walker #${item.userShortId} failed`, {
            description: rejected ? "You rejected a transfer in the wallet. The rest were not sent." : (e.shortMessage ?? e.message).slice(0, 160),
          });
          if (rejected) break;
        }
      }
    } finally {
      setRunning(false);
      await qc.invalidateQueries({ queryKey: ["admin"] });
    }
    if (paid > 0) {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.45 }, colors: ["#c4fb6d", "#b2f047", "#ffffff"] });
      toast.success(`${paid} ${paid === 1 ? "payment" : "payments"} confirmed onchain`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={!running}
      title="Pay everyone"
      subtitle="Each transfer is approved in your wallet, one after another. Onchain transfers cannot be reversed."
      className="sm:max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex list-end justify-between rounded-2xl border border-lime-400/30 bg-lime-400/[0.06] p-4">
          <div>
            <div className="label !text-[9.5px]">Total to send</div>
            {native ? (
              <>
                <div className="mt-1 font-display text-3xl font-bold text-lime-300">
                  {priceMissing ? "…" : `≈ ${fmtEth(formatEther(totalUnits))}`} <span className="text-base text-white/50">{symbol}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-white/60">
                  ${fmtAmount(total)}
                  {price !== null && ` at $${fmtAmount(price)}/${symbol}`}. Each ETH amount is priced when its transfer is prepared, and priced again if that was over ten minutes ago.
                </div>
              </>
            ) : (
              <div className="mt-1 font-display text-3xl font-bold text-lime-300">
                {fmtAmount(total)} <span className="text-base text-white/50">{symbol}</span>
              </div>
            )}
          </div>
          <div className="text-right text-[12.5px] text-white/50">
            {list.length} {list.length === 1 ? "walker" : "walkers"}
            {balance !== undefined && (
              <div className={cn("font-mono", insufficient && "text-red-300")}>
                wallet holds {native ? `${fmtEth(formatEther(balance))} ${symbol}` : fmtAmount(formatUnits(balance, decimals))}
              </div>
            )}
          </div>
        </div>

        <ul className="max-h-[38vh] space-y-1.5 overflow-auto">
          {list.map((i) => {
            const s = state[i.key] ?? "queued";
            return (
              <li key={i.key} className="flex list-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[13px]">
                <span className="w-12 shrink-0 font-mono text-white/45">#{i.userShortId}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-white/75" title={i.walletAddress}>
                  {i.walletAddress}
                </span>
                {native ? (
                  <span className="text-right font-mono text-lime-300">
                    ${fmtAmount(usdOf(i))}
                    {weiOf(i) !== null && (
                      <span className="block text-[11px] text-white/45">
                        ≈ {fmtEth(formatEther(weiOf(i)!))} {symbol}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="font-mono text-lime-300">{fmtAmount(usdOf(i))}</span>
                )}
                <span className="grid w-6 place-list-center">
                  {s === "signing" || s === "sent" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                  ) : s === "confirmed" ? (
                    <Check className="h-4 w-4 text-lime-300" />
                  ) : s === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-300" />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {!isConnected ? (
          <div className="flex justify-center">
            <ConnectWallet />
          </div>
        ) : !authorised ? (
          <p className="flex list-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-[13px] text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Connect one of the payout wallets to send.
          </p>
        ) : !onRightChain ? (
          <Button className="w-full" onClick={() => switchChainAsync({ chainId: PAYOUT_CHAIN_ID })} disabled={switching}>
            Switch to Robinhood Chain
          </Button>
        ) : priceMissing ? (
          <p className="flex list-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-[13px] text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Couldn&apos;t get the ETH price right now. Try again in a minute.
          </p>
        ) : insufficient ? (
          <p className="flex list-center gap-2 rounded-xl border border-red-400/30 bg-red-500/[0.06] p-3 text-[13px] text-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {native
              ? `The payout wallet needs about ${fmtEth(formatEther(required))} ${symbol}: the total plus a little ETH for gas on each transfer.`
              : `The payout wallet holds less ${symbol} than the total.`}
          </p>
        ) : null}

        {!done && (
          <label className="flex cursor-pointer list-start gap-3 text-[13px] text-white/70">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-lime-400" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={running} />
            I checked the wallets and amounts above.
          </label>
        )}

        {done ? (
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button className="w-full" onClick={run} disabled={!canSend} icon={running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}>
            {running
              ? "Sending… approve each transfer in your wallet"
              : native
                ? `Send $${fmtAmount(total)} in ${symbol} to ${list.length}`
                : `Send ${fmtAmount(total)} ${symbol} to ${list.length}`}
          </Button>
        )}
      </div>
    </Modal>
  );
}
