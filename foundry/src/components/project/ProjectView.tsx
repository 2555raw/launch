"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectData } from "@/lib/types";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { themeFor } from "@/lib/content/commodities";
import { fmt, fmtFull, fmtPct, shortAddress } from "@/lib/format";
import { TopBar } from "@/components/game/TopBar";
import { statusLabel } from "@/components/game/LaunchStrip";
import { ClaimPanel } from "./ClaimPanel";
import { BurnChart } from "./BurnChart";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

/** Public project page. Everything on-chain comes from the RPC; nothing is invented. */
export function ProjectView({ initial }: { initial: ProjectData }) {
  const [d, setD] = useState(initial);
  const { user, logout } = useAuth();
  const theme = themeFor(d.project.commodity);

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--brand", theme.brand);
    r.setProperty("--brand-soft", theme.brandSoft);
    r.setProperty("--brand-deep", theme.brandDeep);
  }, [theme]);

  // refresh while the launch is moving
  useEffect(() => {
    if (d.project.status === "LAUNCHED") return;
    const t = setInterval(() => api<ProjectData>(`/api/project/${d.project.slug}`).then(setD).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [d.project.slug, d.project.status]);

  const g = d.global;
  const tok = d.token;
  const launched = d.project.status === "LAUNCHED" && !!tok;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <TopBar user={user ?? null} onLogout={logout} symbol={d.project.symbol} slug={d.project.slug} />

      <section className="panel mt-2 grid gap-6 p-6 md:grid-cols-[160px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/coin/${d.project.commodity.toLowerCase()}.svg`} alt="" className="mx-auto h-36 w-36 drop-shadow-[0_0_30px_rgb(var(--brand)/0.4)]" />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl font-bold text-brand-soft">${d.project.symbol}</h1>
            <span className="chip">{statusLabel(d.project.status)}</span>
            <span className="chip">Solana {CLUSTER}</span>
          </div>
          <div className="mt-1 text-lg text-slate-300">{d.project.name} · {theme.label} commodity token</div>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            The supply of ${d.project.symbol} was not decided by a spreadsheet. {d.global.players.toLocaleString("en-US")} players clicked, built and automated a commodity empire;
            their combined burn power ({fmt(g.totalBurnPower)}) ran through the burn formula <span className="num text-slate-300">{d.formula}</span> and removed{" "}
            <span className="text-red-300">{fmtFull(g.burnedSupply)}</span> tokens from the {fmtFull(g.initialSupply)} initial supply.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!launched && <Link href="/" className="btn-brand">Play and raise the burn</Link>}
            {tok && <a href={tok.explorer} target="_blank" rel="noreferrer" className="btn-brand">View mint on Solana Explorer</a>}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Initial supply" value={fmtFull(g.initialSupply)} />
        <Card label="Burned" value={fmtFull(g.burnedSupply)} tone="text-red-300" sub={fmtPct(g.burnPercent)} />
        <Card label="Final supply" value={fmtFull(g.finalSupply)} tone="text-brand-soft" />
        <Card label="Max burn" value={`${d.project.maxBurnPercent}%`} sub={`${fmtFull(g.maxBurn)} cap`} />
      </section>
      <div className="mt-3 burn-bar">
        <div className="fill" style={{ width: `${Math.min(100, g.burnPercent)}%` }} />
        {d.project.maxBurnPercent < 100 && <div className="cap" style={{ left: `${d.project.maxBurnPercent}%` }} />}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* on-chain */}
        <section className="panel">
          <div className="panel-head">On-chain <span className="normal-case tracking-normal">{d.onchain ? `live from RPC · ${new Date(d.onchain.fetchedAt).toLocaleTimeString()}` : ""}</span></div>
          {!tok ? (
            <div className="p-5 text-sm text-slate-400">
              The token has not been created yet. Once the launch window closes and the final supply is locked, the mint is created on Solana {CLUSTER}, the full initial supply is minted, the burned amount is destroyed on-chain and the mint authority is revoked.
            </div>
          ) : (
            <dl className="divide-y divide-white/[0.05] text-sm">
              <KV k="Token name" v={tok.name} />
              <KV k="Symbol" v={`$${tok.symbol}`} />
              <KV k="Token address (mint)" v={<Addr a={tok.mintAddress} url={tok.explorer} />} />
              <KV k="Creator (launch authority)" v={<Addr a={tok.creator} url={tok.creatorUrl} />} />
              <KV k="Initial supply (recorded)" v={fmtFull(tok.initialSupply)} />
              <KV k="Burned (recorded)" v={<span className="text-red-300">{fmtFull(tok.burnedSupply)}</span>} />
              <KV k="Final supply (recorded)" v={fmtFull(tok.finalSupply)} />
              <KV k="Supply on-chain now" v={d.onchain ? <span className={Math.abs(d.onchain.supply - tok.finalSupply) < 1 ? "text-emerald-300" : "text-amber-300"}>{fmtFull(d.onchain.supply, 2)}</span> : <span className="text-slate-500">{d.onchainError ? `RPC error: ${d.onchainError}` : "unavailable"}</span>} />
              <KV k="Mint authority" v={d.onchain ? (d.onchain.mintAuthority ? <Addr a={d.onchain.mintAuthority} /> : <span className="text-emerald-300">revoked · supply is fixed</span>) : "—"} />
              <KV k="Holders (token accounts with balance)" v={d.onchain?.holders ?? "—"} />
              <KV k="Decimals" v={tok.decimals} />
              <KV k="Mint + supply transaction" v={tok.mintTxUrl ? <Addr a={tok.mintTx!} url={tok.mintTxUrl} /> : "—"} />
              <KV k="Burn transaction" v={tok.burnTxUrl ? <Addr a={tok.burnTx!} url={tok.burnTxUrl} /> : tok.burnedSupply === 0 ? "nothing to burn" : "pending"} />
              <KV k="Revoke authority transaction" v={tok.revokeTxUrl ? <Addr a={tok.revokeTx!} url={tok.revokeTxUrl} /> : "—"} />
              <KV k="Launch date" v={d.launch?.launchedAt ? new Date(d.launch.launchedAt).toUTCString() : "—"} />
              <KV k="Community claims paid" v={d.claims} />
            </dl>
          )}
        </section>

        {/* market + community */}
        <div className="space-y-4">
          <section className="panel">
            <div className="panel-head">Market</div>
            {d.market ? (
              <dl className="divide-y divide-white/[0.05] text-sm">
                <KV k="Price" v={d.market.priceUsd !== null ? `$${d.market.priceUsd}` : "—"} />
                <KV k="Liquidity" v={d.market.liquidityUsd !== null ? `$${fmtFull(d.market.liquidityUsd)}` : "—"} />
                <KV k="24h volume" v={d.market.volume24hUsd !== null ? `$${fmtFull(d.market.volume24hUsd)}` : "—"} />
                <KV k="Market cap (FDV)" v={d.market.marketCapUsd !== null ? `$${fmtFull(d.market.marketCapUsd)}` : "—"} />
                <KV k="Source" v={d.market.pairUrl ? <a className="underline" href={d.market.pairUrl} target="_blank" rel="noreferrer">{d.market.source}</a> : d.market.source} />
              </dl>
            ) : (
              <div className="p-5 text-sm text-slate-400">
                {CLUSTER === "mainnet-beta"
                  ? "No market data found for this mint yet. Price, liquidity and volume appear once a pool exists."
                  : `No market exists on Solana ${CLUSTER}. Price, liquidity and volume are shown only from real mainnet data; nothing here is simulated.`}
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-head">Community</div>
            <dl className="divide-y divide-white/[0.05] text-sm">
              <KV k="Players" v={g.players.toLocaleString("en-US")} />
              <KV k="Community clicks" v={fmtFull(g.totalClicks)} />
              <KV k="Community production (all-time)" v={fmt(g.totalProduced)} />
              <KV k="Total burn power" v={fmt(g.totalBurnPower)} />
              <KV k="Burn formula" v={<span className="num text-xs">{d.formula}</span>} />
              <KV k="Launch window" v={d.project.startedAt ? `${new Date(d.project.startedAt).toUTCString()} → ${d.project.endsAt ? new Date(d.project.endsAt).toUTCString() : "?"}` : "not started"} />
            </dl>
          </section>
          <ClaimPanel data={d} user={user ?? null} />
        </div>
      </div>

      <section className="panel mt-4">
        <div className="panel-head">Burn over time</div>
        <div className="p-4"><BurnChart points={d.burnHistory} initialSupply={g.initialSupply} maxBurn={g.maxBurn} /></div>
      </section>

      <section className="panel mt-4">
        <div className="panel-head">Blockchain transactions</div>
        {d.transactions.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No transactions yet. Gameplay is off-chain; only the launch is recorded here.</div>
        ) : (
          <ul className="divide-y divide-white/[0.05] text-sm">
            {d.transactions.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className={`chip ${t.status === "CONFIRMED" ? "text-emerald-300" : t.status === "FAILED" ? "text-red-300" : "text-amber-300"}`}>{t.status}</span>
                <span className="font-display font-semibold text-slate-200">{t.kind.replace(/_/g, " ")}</span>
                <span className="flex-1 truncate text-slate-400">{t.detail}{t.error ? ` — ${t.error}` : ""}</span>
                {t.amount !== null && <span className="num text-slate-300">{fmtFull(t.amount, 2)}</span>}
                {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="num text-xs text-brand-soft underline">{shortAddress(t.signature!, 6)}</a>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.onchain && d.onchain.largest.length > 0 && (
        <section className="panel mt-4">
          <div className="panel-head">Largest token accounts (on-chain)</div>
          <ul className="divide-y divide-white/[0.05] text-sm">
            {d.onchain.largest.map((l) => (
              <li key={l.address} className="flex items-center justify-between px-4 py-2">
                <Addr a={l.address} url={`https://explorer.solana.com/address/${l.address}${CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`}`} />
                <span className="num text-slate-300">{fmtFull(l.amount, 2)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Card({ label, value, sub, tone = "text-slate-100" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="label">{label}</div>
      <div className={`num font-display text-2xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="num text-right text-slate-200">{v}</dd>
    </div>
  );
}

function Addr({ a, url }: { a: string; url?: string }) {
  const inner = <span className="num" title={a}>{shortAddress(a, 6)}</span>;
  return url ? <a href={url} target="_blank" rel="noreferrer" className="text-brand-soft underline">{inner}</a> : inner;
}
