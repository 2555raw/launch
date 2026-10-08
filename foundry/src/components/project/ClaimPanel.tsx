"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import type { ProjectData, PublicUser } from "@/lib/types";
import { fmt, fmtFull } from "@/lib/format";
import { WalletAuth } from "@/components/game/WalletAuth";
import Link from "next/link";

interface ClaimInfo {
  launched: boolean;
  pool: number;
  share: number;
  amount: number;
  burnPower: number;
  claimed: { signature: string | null; status: string; url: string | null } | null;
  token: { mint: string; symbol: string; decimals: number } | null;
}

/** Community allocation claim: real SPL transfer from the treasury to the player's linked wallet. */
export function ClaimPanel({ data, user: initialUser }: { data: ProjectData; user: PublicUser | null }) {
  const [user, setUser] = useState(initialUser);
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { publicKey } = useWallet();
  useEffect(() => setUser(initialUser), [initialUser]);
  useEffect(() => {
    if (!user || data.project.status !== "LAUNCHED") return;
    api<ClaimInfo>("/api/claim").then(setInfo).catch(() => {});
  }, [user, data.project.status, data.project.slug]);

  const pct = data.project.communityAllocationPercent;
  const address = publicKey?.toBase58() ?? null;
  const linked = !!address && !!user?.wallets.includes(address);

  const claim = async () => {
    if (!address) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ signature: string; url: string; amount: number }>("/api/claim", { json: { address } });
      setMsg(`Sent ${fmtFull(r.amount, 2)} $${data.project.symbol}.`);
      setInfo(await api<ClaimInfo>("/api/claim"));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">Community allocation</div>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-slate-400">
          {pct}% of the final supply{data.launch ? ` (${fmtFull(data.launch.communityAllocation)} $${data.project.symbol})` : ""} is reserved for players, split pro rata to the burn power each contributed. Claims are paid on-chain from the treasury.
        </p>
        {!user ? (
          <Link href="/" className="btn-brand">Sign in to check your share</Link>
        ) : data.project.status !== "LAUNCHED" ? (
          <p className="text-slate-500">Claims open once the token is launched.</p>
        ) : !info ? (
          <p className="text-slate-500">Loading your share…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Mini label="Your burn power" value={fmt(info.burnPower)} />
              <Mini label="Your share" value={`${(info.share * 100).toFixed(4)}%`} />
              <Mini label="Claimable" value={fmtFull(info.amount, 2)} />
            </div>
            {info.claimed ? (
              <p className="text-emerald-300">
                Claimed · {info.claimed.url ? <a className="underline" href={info.claimed.url} target="_blank" rel="noreferrer">view transaction</a> : info.claimed.status}
              </p>
            ) : info.amount <= 0 ? (
              <p className="text-slate-500">No allocation for this account.</p>
            ) : (
              <>
                <WalletAuth user={user} onUser={setUser} compact />
                {linked && (
                  <button className="btn-brand w-full" disabled={busy} onClick={claim}>
                    {busy ? "Sending…" : `Claim ${fmtFull(info.amount, 2)} $${data.project.symbol}`}
                  </button>
                )}
                {address && !linked && <p className="text-xs text-slate-500">Link this wallet to your account to claim to it.</p>}
              </>
            )}
            {msg && <p className="text-xs text-slate-300">{msg}</p>}
          </>
        )}
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.03] px-3 py-2">
      <div className="label">{label}</div>
      <div className="num font-display text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}
