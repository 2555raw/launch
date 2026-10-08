"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";
import { shortAddress } from "@/lib/format";

/**
 * Sign-in / link with a Solana wallet. The wallet signs a server-issued nonce;
 * nothing is sent on-chain and no key ever leaves the wallet.
 */
export function WalletAuth({ user, onUser, compact = false }: { user: PublicUser | null; onUser: (u: PublicUser) => void; compact?: boolean }) {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = publicKey?.toBase58() ?? null;
  const linked = !!address && !!user?.wallets.includes(address);

  const sign = useCallback(async () => {
    if (!address || !signMessage) return setError("This wallet cannot sign messages");
    setBusy(true);
    setError(null);
    try {
      const { nonce, message } = await api<{ nonce: string; message: string }>("/api/auth/wallet/nonce", { json: { address } });
      const sig = await signMessage(new TextEncoder().encode(message));
      const r = await api<{ user: PublicUser; action: string }>("/api/auth/wallet/verify", { json: { address, nonce, signature: bs58.encode(sig) } });
      onUser(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [address, onUser, signMessage]);

  const unlink = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    try {
      const r = await api<{ user: PublicUser }>("/api/auth/wallet/unlink", { json: { address } });
      onUser(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [address, onUser]);

  if (!connected || !address) {
    return (
      <div className={compact ? "" : "space-y-2"}>
        <button className="btn-brand w-full" onClick={() => setVisible(true)}>Connect wallet</button>
        {!compact && <p className="text-[11px] text-slate-500">Phantom, Solflare and any Wallet Standard wallet. We never ask for seed phrases or private keys.</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="chip" title={address}>{shortAddress(address, 5)}</span>
        {linked ? <span className="text-emerald-300">linked to {user?.username}</span> : <span className="text-slate-500">connected, not linked</span>}
      </div>
      {!linked && (
        <button className="btn-brand w-full" disabled={busy} onClick={sign}>
          {busy ? "Waiting for signature…" : user ? "Sign to link wallet" : "Sign in with wallet"}
        </button>
      )}
      <div className="flex gap-2">
        {linked && user && <button className="btn flex-1 !text-xs" disabled={busy} onClick={unlink}>Unlink</button>}
        <button className="btn flex-1 !text-xs" onClick={() => disconnect()}>Disconnect</button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
