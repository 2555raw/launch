"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGame } from "@/hooks/useGame";
import { useGlobal } from "@/hooks/useGlobal";
import { themeFor } from "@/lib/content/commodities";
import { fmt, fmtFull } from "@/lib/format";
import type { PublicUser } from "@/lib/types";
import { AchievementsPanel } from "./AchievementsPanel";
import { AuthPanel, SecureAccount } from "./AuthPanel";
import { api } from "@/lib/api";
import { Deposit } from "./Deposit";
import { LaunchStrip } from "./LaunchStrip";
import { Leaderboard } from "./Leaderboard";
import { NewsTicker } from "./NewsTicker";
import { StatsBar } from "./StatsBar";
import { Store } from "./Store";
import { SupplyPanel } from "./SupplyPanel";
import { Toasts } from "./Toasts";
import { TopBar } from "./TopBar";
import { WalletAuth } from "./WalletAuth";
import { World } from "./World";

type CenterView = "world" | "options" | "stats" | "info";

/** Apply the commodity palette to the document so every component re-skins. */
function useTheme(commodity: string | undefined) {
  useEffect(() => {
    const t = themeFor(commodity ?? "GOLD");
    const r = document.documentElement.style;
    r.setProperty("--brand", t.brand);
    r.setProperty("--brand-soft", t.brandSoft);
    r.setProperty("--brand-deep", t.brandDeep);
  }, [commodity]);
}

export function Game() {
  const { user, setUser, logout, loading } = useAuth();
  const onAuthLost = useCallback(() => setUser(null), [setUser]);
  const game = useGame(!!user, onAuthLost);
  const { global: live, connected, serverNow } = useGlobal(game.initialGlobal);
  const global = live ?? game.initialGlobal;
  const [view, setView] = useState<CenterView>("world");
  const [statsTab, setStatsTab] = useState<"numbers" | "achievements" | "leaderboard">("numbers");
  useTheme(global?.commodity);

  // Walk straight in: no account yet -> create a guest foundry and start playing.
  const guestTried = useRef(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  useEffect(() => {
    if (user !== null || guestTried.current) return;
    guestTried.current = true;
    api<{ user: PublicUser }>("/api/auth/guest", { method: "POST" })
      .then((r) => setUser(r.user))
      .catch((e) => setGuestError((e as Error).message));
  }, [user, setUser]);

  useEffect(() => {
    if (!global) return;
    const closed = !(global.status === "DRAFT" || global.status === "ACTIVE") || (global.status === "ACTIVE" && global.endsAt !== null && serverNow() >= global.endsAt);
    if (closed) game.setFrozen(true);
    else if (game.frozen && (global.status === "DRAFT" || global.status === "ACTIVE")) game.setFrozen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [global?.status, global?.endsAt, global?.frozenAt]);

  const theme = themeFor(global?.commodity ?? "GOLD");
  const symbol = global?.symbol ?? "…";
  const onUser = useCallback((u: PublicUser) => setUser(u), [setUser]);

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;

  if (!user) {
    return (
      <div>
        <TopBar user={null} symbol={global?.symbol} />
        <div className="grid min-h-[60vh] place-items-center text-slate-400">
          {guestError ? (
            <div className="panel max-w-md p-5 text-center">
              <div className="font-display text-lg font-bold text-red-300">Could not open a foundry</div>
              <p className="mt-1 text-sm">{guestError}</p>
              <div className="mt-4"><AuthPanel onUser={onUser} loginOnly /></div>
            </div>
          ) : (
            "Preparing your foundry…"
          )}
        </div>
      </div>
    );
  }

  const s = game.server;
  const disabled = game.frozen;
  const MetalBtn = ({ v, children }: { v: CenterView; children: React.ReactNode }) => (
    <button className={`metal-btn ${view === v ? "active" : ""}`} onClick={() => setView(view === v && v !== "world" ? "world" : v)}>
      {children}
    </button>
  );

  return (
    <div>
      <TopBar user={user} onLogout={logout} symbol={global?.symbol} slug={game.project?.slug} />
      <div className="game-shell">
        {/* LEFT: your foundry + the deposit */}
        <aside className="col-left">
          <div className="bakery-title">{user.username}&apos;s foundry</div>
          <div className="mt-3 text-center">
            <div className="cc-count">{s ? fmt(game.local.balance) : "…"} {theme.unitShort} {symbol}</div>
            <div className="cc-sub mt-1">per second: {s ? fmt(s.productionPerSec) : "0"} · burn: {s ? fmt(s.burnPerSec) : "0"}/s</div>
          </div>
          <div className="grid flex-1 place-items-center px-3 py-3">
            {s && <Deposit theme={theme} symbol={symbol} clickPower={s.clickPower} onClick={game.click} disabled={disabled} />}
          </div>
          {s && (
            <div className="grid grid-cols-2 gap-2 px-3 text-center">
              <div className="rounded-md bg-black/40 px-2 py-1.5">
                <div className="label">per click</div>
                <div className="num font-display text-lg font-bold text-brand-soft">+{fmt(s.clickPower)}</div>
              </div>
              <div className="rounded-md bg-black/40 px-2 py-1.5">
                <div className="label">burn / click</div>
                <div className="num font-display text-lg font-bold text-ember">+{fmt(s.clickBurn)}</div>
              </div>
            </div>
          )}
          <div className="space-y-2 px-3 pb-2 pt-3">
            <SupplyPanel global={global} />
            <div className="panel px-4 py-3">
              <div className="label text-ember">The community has burned</div>
              <div className="num font-display text-2xl font-bold text-red-300">{global ? fmtFull(global.burnedSupply) : "…"} <span className="text-base text-slate-400">${symbol}</span></div>
              {s && global && <div className="text-xs text-slate-500">your share {global.totalBurnPower > 0 ? Math.min(100, (game.local.burnPower / global.totalBurnPower) * 100).toFixed(3) : "0.000"}% · rank {s.rank ? `#${s.rank}` : "—"}</div>}
            </div>
          </div>
          <div className="serif px-3 pb-2 text-sm font-bold text-white/80 drop-shadow">v. 0.1</div>
        </aside>

        {/* CENTER */}
        <main className="col-center">
          <div className="metal-bar">
            <div className="flex">
              <MetalBtn v="options">Options</MetalBtn>
              <MetalBtn v="stats">Stats</MetalBtn>
            </div>
            <NewsBox global={global} />
            <div className="flex">
              <MetalBtn v="info">Info</MetalBtn>
              <Link href={game.project ? `/project/${game.project.slug}` : "/project"} className="metal-btn">Project</Link>
            </div>
          </div>
          <div className="cc-ledge" />
          <div className="launch-wrap">
            <LaunchStrip global={global} serverNow={serverNow} connected={connected} />
          </div>
          {disabled && global && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#0b0f15] bg-ember/10 px-4 py-2">
              <div className="text-sm text-slate-200">
                <span className="font-display font-bold text-ember">The launch window is closed.</span>{" "}
                {global.status === "LAUNCHED" ? "The token is live on Solana." : "The supply is being finalized and minted. Your contribution is locked in."}
              </div>
              <Link href={game.project ? `/project/${game.project.slug}` : "/project"} className="btn-brand !py-1">Open the ${symbol} page</Link>
            </div>
          )}
          <div className="world-stripes">
            {game.loadError && <div className="m-3 rounded border border-burn/40 bg-ink-900 p-3 text-sm text-red-200">{game.loadError}</div>}
            {!s ? (
              <div className="grid h-full place-items-center text-slate-500">Loading your empire…</div>
            ) : view === "world" ? (
              <World server={s} onLevelUp={game.levelUp} canAfford={(n) => game.local.balance >= n} frozen={disabled} />
            ) : view === "options" ? (
              <div className="mx-auto max-w-md space-y-3 p-4">
                <h2 className="font-display text-2xl font-bold text-slate-100">Options</h2>
                <div className="panel p-4">
                  <div className="label mb-2">Wallet</div>
                  <WalletAuth user={user} onUser={onUser} />
                  <p className="mt-2 text-[11px] text-slate-500">Link a wallet to claim your share of the community allocation after launch. No seed phrases, no private keys.</p>
                </div>
                <div className="panel p-4">
                  <div className="label mb-2">Account</div>
                  <div className="mb-2 text-sm text-slate-300">Playing as <b>{user.username}</b>{!user.hasPassword && user.wallets.length === 0 && <span className="text-slate-500"> (guest)</span>}</div>
                  {!user.hasPassword ? <SecureAccount user={user} onUser={onUser} /> : <button className="btn" onClick={logout}>Sign out</button>}
                </div>
                <AuthPanel onUser={onUser} loginOnly />
                <div className="panel p-4 text-sm text-slate-400">
                  Your progress is saved on the server every few seconds. Generators keep producing while you are away, up to the offline cap set by the project.
                </div>
              </div>
            ) : view === "stats" ? (
              <div className="p-3">
                <div className="mb-2 flex gap-1">
                  {(["numbers", "achievements", "leaderboard"] as const).map((t) => (
                    <button key={t} onClick={() => setStatsTab(t)} className={`rounded px-2.5 py-1 font-display text-xs font-bold uppercase tracking-widest ${statsTab === t ? "bg-white/[0.08] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>{t}</button>
                  ))}
                </div>
                {statsTab === "numbers" && (
                  <div className="space-y-3">
                    <StatsBar server={s} local={game.local} unit={theme.unitShort} />
                    <div className="panel p-4 text-sm text-slate-300">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <Row k="Total produced" v={fmt(game.local.totalProduced)} />
                        <Row k="Burn efficiency" v={`${fmt(s.burnMultiplier, 1)}×`} />
                        <Row k="Global multiplier" v={`${fmt(s.globalMultiplier, 2)}×`} />
                        <Row k="Auto clicks" v={`${s.autoClicksPerSec}/s`} />
                        <Row k="Buildings" v={s.generators.reduce((a, g) => a + g.count, 0).toLocaleString("en-US")} />
                        <Row k="Upgrades" v={String(s.upgrades.length)} />
                        <Row k="Achievements" v={String(s.achievements.length)} />
                        <Row k="Clicks rejected by anti-cheat" v={Math.round(s.rejectedClicks).toLocaleString("en-US")} />
                      </div>
                    </div>
                  </div>
                )}
                {statsTab === "achievements" && <div className="panel"><AchievementsPanel unlocked={s.achievements} /></div>}
                {statsTab === "leaderboard" && <div className="panel"><Leaderboard me={user.username} myRank={s.rank} /></div>}
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-3 p-4 text-sm text-slate-300">
                <h2 className="font-display text-2xl font-bold text-slate-100">How the burn works</h2>
                <p>Your production × burn weight × burn efficiency = burn power. Community burn power feeds the burn formula:</p>
                <pre className="panel overflow-x-auto p-3 font-mono text-xs text-brand-soft">
                  {game.project?.burnFormula === "asymptotic"
                    ? `burned = maxBurn × (1 − 2^(−power / ${fmt(game.project.burnHalfLife)}))`
                    : `burned = min(maxBurn, ${game.project?.burnRate ?? "?"} × power)`}
                  {"\n"}maxBurn = {global ? fmtFull(global.initialSupply) : "?"} × {global?.maxBurnPercent}% = {global ? fmtFull(global.maxBurn) : "?"}
                </pre>
                <p>The result is the amount of ${symbol} permanently removed from the initial supply when the launch window closes. The final supply is then minted on Solana, the burned amount is destroyed on-chain and the mint authority is revoked.</p>
                <p>A share of the final supply ({game.project?.communityAllocationPercent}%) is reserved for players pro rata to their burn power. Link a wallet in Options to claim it after launch.</p>
                <p className="text-slate-500">Everything you do is validated by the server: clicks over the per-second cap are dropped, purchases are re-priced server-side, and nothing is credited after the freeze instant. <Link href="/docs" className="underline">Full docs</Link>.</p>
              </div>
            )}
          </div>
          {s && (
            <div className="hidden items-center gap-5 bg-[#0b0f15] px-4 py-1.5 text-xs text-slate-400 lg:flex">
              <span>produced <span className="num text-slate-200">{fmt(game.local.totalProduced)}</span></span>
              <span>clicks <span className="num text-slate-200">{Math.floor(game.local.totalClicks).toLocaleString("en-US")}</span></span>
              <span>your burn power <span className="num text-ember">{fmt(game.local.burnPower)}</span></span>
              <span className="ml-auto">{connected ? "live" : "polling"}</span>
            </div>
          )}
        </main>

        {/* RIGHT: store */}
        <aside className="col-right">
          {s ? <Store server={s} balance={game.local.balance} frozen={disabled} busy={game.busy} onBuy={game.buy} onUpgrade={game.upgrade} /> : <div className="store-head">STORE</div>}
        </aside>
      </div>
      <Toasts toasts={game.toasts} onDismiss={game.dismiss} />
    </div>
  );
}

function NewsBox({ global }: { global: Parameters<typeof NewsTicker>[0]["global"] }) {
  return (
    <div className="news-box">
      <NewsTicker global={global} bare />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.04] py-1"><span className="text-slate-500">{k}</span><span className="num text-slate-200">{v}</span></div>
  );
}
