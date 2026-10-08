"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGame } from "@/hooks/useGame";
import { useGlobal } from "@/hooks/useGlobal";
import { themeFor } from "@/lib/content/commodities";
import { fmt, fmtFull } from "@/lib/format";
import type { PublicUser } from "@/lib/types";
import { AchievementsPanel } from "./AchievementsPanel";
import { AuthPanel } from "./AuthPanel";
import { Coin } from "./Coin";
import { LaunchStrip } from "./LaunchStrip";
import { Leaderboard } from "./Leaderboard";
import { NewsTicker } from "./NewsTicker";
import { Shop } from "./Shop";
import { StatsBar } from "./StatsBar";
import { SupplyPanel } from "./SupplyPanel";
import { Toasts } from "./Toasts";
import { TopBar } from "./TopBar";
import { WalletAuth } from "./WalletAuth";
import Link from "next/link";

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
  const [centerTab, setCenterTab] = useState<"world" | "leaderboard" | "achievements">("world");
  useTheme(global?.commodity);

  // The server pushes status changes; freeze the client the moment the window closes.
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
      <div className="mx-auto max-w-6xl px-4 pb-10">
        <TopBar user={null} symbol={global?.symbol} />
        <LaunchStrip global={global} serverNow={serverNow} connected={connected} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <div>
              <div className="label text-ember">Community token launch</div>
              <h1 className="mt-2 font-display text-5xl font-bold leading-[0.95] text-slate-50 md:text-6xl">
                Every click helps shape <span className="text-brand-soft">${symbol}</span>.
              </h1>
              <p className="mt-4 max-w-xl text-lg text-slate-400">
                Click the deposit, hire cursors, build mines, rigs and refineries. All production becomes <span className="text-ember">burn power</span>, and burn power permanently removes tokens from the launch supply.
                When the countdown ends the game freezes, the final supply is computed and the token is minted on Solana with the burn executed on-chain.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Hero label="Initial supply" value={global ? fmtFull(global.initialSupply) : "…"} />
              <Hero label="Burned so far" value={global ? fmtFull(global.burnedSupply) : "…"} tone="text-red-300" />
              <Hero label="Current supply" value={global ? fmtFull(global.finalSupply) : "…"} tone="text-brand-soft" />
            </div>
            <ol className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
              {["Click to mine", "Earn & buy cursors", "Automate with buildings", "Unlock upgrades", "Raise your burn power", "Launch the token"].map((s, i) => (
                <li key={s} className="flex items-center gap-3 rounded-md border border-white/[0.05] bg-ink-900/60 px-3 py-2">
                  <span className="num grid h-6 w-6 place-items-center rounded bg-white/[0.06] text-xs text-slate-300">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="hidden lg:block">
              <div className="label mb-2">The deposit</div>
              <div className="pointer-events-none max-w-[240px] opacity-80">
                <Coin theme={theme} symbol={symbol} clickPower={1} onClick={() => {}} disabled />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <AuthPanel onUser={onUser} />
            <p className="text-center text-xs text-slate-500">
              Gameplay is off-chain and validated server-side. Only the launch goes on Solana. <Link href="/project" className="underline">See the project page</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const s = game.server;
  const disabled = game.frozen;

  return (
    <div className="mx-auto max-w-[1600px] px-3 pb-10 md:px-4">
      <TopBar user={user} onLogout={logout} symbol={global?.symbol} slug={game.project?.slug} />
      <LaunchStrip global={global} serverNow={serverNow} connected={connected} />

      {game.loadError && <div className="panel mt-3 border-burn/40 p-4 text-sm text-red-200">{game.loadError}</div>}

      {disabled && global && (
        <div className="panel mt-3 flex flex-wrap items-center justify-between gap-3 border-ember/40 p-4">
          <div>
            <div className="font-display text-lg font-semibold text-ember">The launch window is closed.</div>
            <div className="text-sm text-slate-400">
              {global.status === "LAUNCHED" ? "The token is live on Solana." : "The supply is being finalized and minted. Your contribution is locked in."}
            </div>
          </div>
          <Link href={game.project ? `/project/${game.project.slug}` : "/project"} className="btn-brand">Open the ${symbol} project page</Link>
        </div>
      )}

      {!s ? (
        <div className="mt-3 grid h-64 place-items-center text-slate-500">Loading your empire…</div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          {/* LEFT: supply + coin */}
          <aside className="space-y-3">
            <SupplyPanel global={global} />
            <section className="panel p-4 text-center">
              <div className="label">Click to {theme.verb.toLowerCase()}</div>
              <div className="mt-3">
                <Coin theme={theme} symbol={symbol} clickPower={s.clickPower} onClick={game.click} disabled={disabled} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-md bg-white/[0.03] px-3 py-2">
                  <div className="label">per click</div>
                  <div className="num font-display text-xl font-bold text-brand-soft">+{fmt(s.clickPower)} {theme.unitShort}</div>
                </div>
                <div className="rounded-md bg-white/[0.03] px-3 py-2">
                  <div className="label">burn / click</div>
                  <div className="num font-display text-xl font-bold text-ember">+{fmt(s.clickBurn)}</div>
                </div>
              </div>
              {s.autoClicksPerSec > 0 && <div className="mt-2 text-[11px] text-slate-500">auto-clicking {s.autoClicksPerSec}×/sec</div>}
            </section>
            <section className="panel p-4">
              <div className="label text-ember">The community has burned</div>
              <div className="num font-display text-3xl font-bold text-red-300">{global ? fmtFull(global.burnedSupply) : "…"}</div>
              <div className="text-xs text-slate-500">${symbol} · your share {global && global.totalBurnPower > 0 ? ((game.local.burnPower / global.totalBurnPower) * 100).toFixed(3) : "0.000"}%</div>
            </section>
            <section className="panel p-4">
              <div className="label mb-2">Wallet</div>
              <WalletAuth user={user} onUser={onUser} />
              <p className="mt-2 text-[11px] text-slate-500">Link a wallet to claim your share of the community allocation after launch.</p>
            </section>
          </aside>

          {/* CENTER: stats + world */}
          <main className="space-y-3 min-w-0">
            <NewsTicker global={global} />
            <StatsBar server={s} local={game.local} unit={theme.unitShort} />
            <section className="panel">
              <div className="panel-head">
                <div className="flex gap-1">
                  {(["world", "leaderboard", "achievements"] as const).map((t) => (
                    <button key={t} onClick={() => setCenterTab(t)} className={`rounded px-2.5 py-1 ${centerTab === t ? "bg-white/[0.07] text-slate-100" : "hover:text-slate-300"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <span className="normal-case tracking-normal text-slate-500">
                  {s.rank ? `rank #${s.rank}` : ""} · {fmt(s.burnMultiplier, 1)}× burn efficiency · {fmt(s.globalMultiplier, 2)}× global
                </span>
              </div>
              {centerTab === "world" && <World server={s} onLevelUp={game.levelUp} canAfford={(n) => game.local.balance >= n} frozen={disabled} />}
              {centerTab === "leaderboard" && <Leaderboard me={user.username} myRank={s.rank} />}
              {centerTab === "achievements" && <AchievementsPanel unlocked={s.achievements} />}
            </section>
            <section className="panel px-4 py-3 text-xs text-slate-500">
              <span className="label mr-2">How the burn works</span>
              Your production × burn weight × burn efficiency = burn power. Community burn power feeds the burn formula
              {game.project && (
                <> (<span className="num text-slate-400">{game.project.burnFormula === "asymptotic" ? `maxBurn × (1 − 2^(−power / ${fmt(game.project.burnHalfLife)}))` : `min(maxBurn, ${game.project.burnRate} × power)`}</span>)</>
              )}
              . The result is the amount of ${symbol} permanently removed from the {global ? fmtFull(global.initialSupply) : ""} initial supply, capped at {global?.maxBurnPercent}%.
              {s.suspicion > 0 && <span className="ml-2 text-amber-400">Anti-cheat rejected {Math.round(s.rejectedClicks)} of your clicks (over the per-second cap).</span>}
            </section>
          </main>

          {/* RIGHT: shop */}
          <aside className="min-h-[480px] lg:max-h-[calc(100vh-180px)] lg:sticky lg:top-3">
            <Shop server={s} balance={game.local.balance} frozen={disabled} busy={game.busy} onBuy={game.buy} onUpgrade={game.upgrade} />
          </aside>
        </div>
      )}
      <Toasts toasts={game.toasts} onDismiss={game.dismiss} />
    </div>
  );
}

function Hero({ label, value, tone = "text-slate-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel px-3 py-3">
      <div className="label">{label}</div>
      <div className={`num font-display text-xl font-bold md:text-2xl ${tone}`}>{value}</div>
    </div>
  );
}

import { World } from "./World";
