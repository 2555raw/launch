"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { GlobalSnapshot, PublicProject, PublicUser } from "@/lib/types";
import { COMMODITY_IDS } from "@/lib/content/commodities";
import { burnSummary } from "@/lib/economy";
import { fmt, fmtFull, shortAddress } from "@/lib/format";
import { TopBar } from "@/components/game/TopBar";
import { AuthPanel } from "@/components/game/AuthPanel";

type Cfg = PublicProject & { revokeMintAuthority: boolean };

interface Overview {
  project: Cfg;
  formula: string;
  global: GlobalSnapshot;
  launch: { step: string; error: string | null; burnedSupply: number; finalSupply: number; initialSupply: number; burnPercent: number; communityAllocation: number; finalBurnPower: number } | null;
  token: { mintAddress: string; mintTx: string | null; burnTx: string | null; revokeTx: string | null } | null;
  transactions: { id: string; kind: string; status: string; signature: string | null; amount: number | null; detail: string | null; error: string | null; createdAt: string; url: string | null }[];
  users: number;
  sessions: number;
  wsClients: number;
  suspicious: { username: string; suspicion: number; rejectedClicks: number; totalClicks: number }[];
  projects: { slug: string; symbol: string; name: string; status: string; isCurrent: boolean; createdAt: string }[];
  solana: { cluster: string; authority: string; authorityUrl: string; authorityBalance: number | null; rpcError: string | null };
}

const STEPS = ["DRAFT", "ACTIVE", "FROZEN", "FINALIZED", "MINTING", "LAUNCHED"] as const;

export function AdminPanel() {
  const { user, setUser, logout, loading } = useAuth();
  const [ov, setOv] = useState<Overview | null>(null);
  const [form, setForm] = useState<Partial<Cfg>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pw, setPw] = useState("");

  const load = useCallback(async () => {
    const o = await api<Overview>("/api/admin/overview");
    setOv(o);
    setForm(o.project);
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    load().catch((e) => setMsg((e as Error).message));
    const t = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [user, load]);

  const elevate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api<{ user: PublicUser }>("/api/admin/login", { json: { password: pw } });
      setUser(r.user);
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");
    setMsg(null);
    try {
      const keys: (keyof Cfg)[] = ["name", "symbol", "commodity", "initialSupply", "maxBurnPercent", "burnFormula", "burnRate", "burnHalfLife", "communityAllocationPercent", "decimals", "revokeMintAuthority", "clickMultiplier", "cursorMultiplier", "generatorMultiplier", "maxClicksPerSecond", "offlineCapHours", "launchDurationHours"];
      const body: Record<string, unknown> = {};
      for (const k of keys) if (form[k] !== undefined && form[k] !== ov?.project[k]) body[k] = form[k];
      await api("/api/admin/config", { method: "PUT", json: body });
      setMsg("Saved.");
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const action = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(String(body.action));
    setMsg(null);
    try {
      const r = await api<Record<string, unknown>>("/api/admin/action", { json: body });
      setMsg(`${body.action}: ok${r.token ? ` · mint ${(r.token as { mintAddress: string }).mintAddress}` : ""}`);
      await load();
    } catch (err) {
      setMsg(`${body.action}: ${(err as Error).message}`);
      await load().catch(() => {});
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4">
        <TopBar user={null} />
        <p className="mb-4 text-sm text-slate-400">Sign in first, then enter the admin password.</p>
        <AuthPanel onUser={setUser} />
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md px-4">
        <TopBar user={user} onLogout={logout} />
        <form onSubmit={elevate} className="panel space-y-3 p-5">
          <div className="label">Admin password</div>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="ADMIN_PASSWORD from the server environment" />
          {msg && <p className="text-xs text-red-300">{msg}</p>}
          <button className="btn-brand w-full">Unlock admin panel</button>
        </form>
      </div>
    );
  }

  const p = ov?.project;
  const preview = p ? burnSummary({ ...p, ...form } as Cfg, ov!.global.totalBurnPower) : null;
  const stepIdx = p ? STEPS.indexOf(p.status as (typeof STEPS)[number]) : -1;
  const num = (k: keyof Cfg) => ({
    type: "number", step: "any", className: "input", value: (form[k] as number | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value === "" ? undefined : Number(e.target.value) })),
  }) as const;
  const locked = !!p && !(p.status === "DRAFT" || p.status === "ACTIVE");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <TopBar user={user} onLogout={logout} symbol={p?.symbol} slug={p?.slug} />
      {msg && <div className="panel mb-3 px-4 py-2 text-sm text-slate-200">{msg}</div>}
      {!ov ? (
        <div className="text-slate-500">Loading overview…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {/* lifecycle */}
            <section className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-slate-100">Launch · ${p!.symbol}</h2>
                <Link href={`/project/${p!.slug}`} className="text-sm text-brand-soft underline">public page</Link>
              </div>
              <ol className="mt-3 flex flex-wrap gap-1">
                {STEPS.map((s, i) => (
                  <li key={s} className={`rounded px-2.5 py-1 font-display text-xs font-semibold tracking-wider ${i < stepIdx ? "bg-emerald-500/15 text-emerald-300" : i === stepIdx ? "bg-brand/25 text-brand-soft" : "bg-white/[0.04] text-slate-500"}`}>
                    {s}
                  </li>
                ))}
                {p!.status === "FAILED" && <li className="rounded bg-burn/20 px-2.5 py-1 font-display text-xs font-semibold tracking-wider text-red-300">FAILED</li>}
              </ol>
              {ov.launch?.error && <p className="mt-2 text-sm text-red-300">Last error: {ov.launch.error}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {p!.status === "DRAFT" && <button className="btn-brand" disabled={!!busy} onClick={() => action({ action: "start" }, `Start the ${p!.launchDurationHours}h countdown now?`)}>Start countdown ({p!.launchDurationHours}h)</button>}
                {p!.status === "ACTIVE" && <button className="btn" disabled={!!busy} onClick={() => action({ action: "extend", hours: 24 })}>Extend +24h</button>}
                {(p!.status === "DRAFT" || p!.status === "ACTIVE") && <button className="btn-burn" disabled={!!busy} onClick={() => action({ action: "freeze" }, "Freeze the game now? No more gameplay will count.")}>Freeze now</button>}
                {p!.status === "FROZEN" && !ov.launch && <button className="btn" disabled={!!busy} onClick={() => action({ action: "unfreeze", hours: 24 })}>Reopen for 24h</button>}
                {p!.status === "FROZEN" && <button className="btn-brand" disabled={!!busy} onClick={() => action({ action: "finalize" }, "Lock the final supply from the current totals?")}>Finalize supply</button>}
                {(p!.status === "FINALIZED" || p!.status === "FAILED") && (
                  <button className="btn-brand" disabled={!!busy} onClick={() => action({ action: "execute" }, `Create the ${p!.symbol} token on Solana ${ov.solana.cluster}, mint ${fmtFull(ov.launch?.initialSupply ?? 0)}, burn ${fmtFull(ov.launch?.burnedSupply ?? 0)}${p!.revokeMintAuthority ? " and revoke the mint authority" : ""}?`)}>
                    {busy === "execute" ? "Executing on-chain…" : p!.status === "FAILED" ? "Retry on-chain steps" : "Create token + burn on Solana"}
                  </button>
                )}
              </div>
              {ov.launch && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Mini label="Final burn power" value={fmt(ov.launch.finalBurnPower)} />
                  <Mini label="Burned" value={fmtFull(ov.launch.burnedSupply)} tone="text-red-300" />
                  <Mini label="Final supply" value={fmtFull(ov.launch.finalSupply)} tone="text-brand-soft" />
                  <Mini label="Community pool" value={fmtFull(ov.launch.communityAllocation)} />
                </div>
              )}
              {ov.token && (
                <div className="mt-3 text-sm text-slate-300">
                  Mint <span className="num">{ov.token.mintAddress}</span>
                  {ov.token.burnTx && <> · burn tx <span className="num">{shortAddress(ov.token.burnTx, 8)}</span></>}
                  {ov.token.revokeTx && <> · authority revoked</>}
                </div>
              )}
            </section>

            {/* config */}
            <form onSubmit={saveConfig} className="panel p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-slate-100">Configuration</h2>
                {locked && <span className="chip text-amber-300">tokenomics locked (launch frozen)</span>}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Token name"><input className="input" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={32} /></Field>
                <Field label="Symbol"><input className="input" value={form.symbol ?? ""} onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))} maxLength={10} disabled={locked} /></Field>
                <Field label="Commodity">
                  <select className="input" value={form.commodity ?? "GOLD"} onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))}>
                    {COMMODITY_IDS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Initial supply"><input {...num("initialSupply")} disabled={locked} /></Field>
                <Field label="Max burn %"><input {...num("maxBurnPercent")} disabled={locked} /></Field>
                <Field label="Decimals (0–9)"><input {...num("decimals")} disabled={locked} /></Field>
                <Field label="Burn formula">
                  <select className="input" value={form.burnFormula ?? "linear"} onChange={(e) => setForm((f) => ({ ...f, burnFormula: e.target.value }))} disabled={locked}>
                    <option value="linear">linear · burned = burnRate × power</option>
                    <option value="asymptotic">asymptotic · maxBurn × (1 − 2^(−power/halfLife))</option>
                  </select>
                </Field>
                <Field label="Burn rate (tokens per unit of burn power)"><input {...num("burnRate")} disabled={locked} /></Field>
                <Field label="Burn half-life (asymptotic)"><input {...num("burnHalfLife")} disabled={locked} /></Field>
                <Field label="Community allocation % of final supply"><input {...num("communityAllocationPercent")} disabled={locked} /></Field>
                <Field label="Launch duration (hours)"><input {...num("launchDurationHours")} disabled={locked} /></Field>
                <Field label="Revoke mint authority after burn">
                  <label className="flex h-[38px] items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.revokeMintAuthority ?? true} onChange={(e) => setForm((f) => ({ ...f, revokeMintAuthority: e.target.checked }))} disabled={locked} /> fixed supply</label>
                </Field>
                <Field label="Click multiplier"><input {...num("clickMultiplier")} disabled={locked} /></Field>
                <Field label="Cursor multiplier"><input {...num("cursorMultiplier")} disabled={locked} /></Field>
                <Field label="Generator multiplier"><input {...num("generatorMultiplier")} disabled={locked} /></Field>
                <Field label="Max clicks per second (anti-cheat)"><input {...num("maxClicksPerSecond")} disabled={locked} /></Field>
                <Field label="Offline production cap (hours)"><input {...num("offlineCapHours")} disabled={locked} /></Field>
              </div>
              {preview && (
                <div className="mt-3 rounded-md bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                  With the current community burn power ({fmt(ov.global.totalBurnPower)}) these settings burn <span className="text-red-300">{fmtFull(preview.burnedSupply)}</span> ({preview.burnPercent.toFixed(2)}%), final supply <span className="text-brand-soft">{fmtFull(preview.finalSupply)}</span>, cap {fmtFull(preview.maxBurn)}.
                </div>
              )}
              <div className="mt-3"><button className="btn-brand" disabled={busy === "save"}>Save configuration</button></div>
            </form>

            {/* transactions */}
            <section className="panel">
              <div className="panel-head">Blockchain transactions</div>
              <ul className="divide-y divide-white/[0.05] text-sm">
                {ov.transactions.length === 0 && <li className="px-4 py-3 text-slate-500">None yet.</li>}
                {ov.transactions.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    <span className={`chip ${t.status === "CONFIRMED" ? "text-emerald-300" : t.status === "FAILED" ? "text-red-300" : "text-amber-300"}`}>{t.status}</span>
                    <span className="font-display font-semibold">{t.kind}</span>
                    <span className="flex-1 truncate text-slate-400">{t.detail}{t.error ? ` — ${t.error}` : ""}</span>
                    {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="num text-xs text-brand-soft underline">{shortAddress(t.signature!, 6)}</a>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="panel p-4">
              <h3 className="label mb-2">Live</h3>
              <div className="grid grid-cols-2 gap-2">
                <Mini label="Players" value={String(ov.sessions)} />
                <Mini label="Accounts" value={String(ov.users)} />
                <Mini label="Online" value={String(ov.global.activePlayers)} />
                <Mini label="WS clients" value={String(ov.wsClients)} />
                <Mini label="Clicks" value={fmt(ov.global.totalClicks, 1)} />
                <Mini label="Burn power" value={fmt(ov.global.totalBurnPower)} />
                <Mini label="Burned" value={fmtFull(ov.global.burnedSupply)} tone="text-red-300" />
                <Mini label="Burn %" value={`${ov.global.burnPercent.toFixed(3)}%`} />
              </div>
              <p className="mt-2 text-xs text-slate-500">formula: <span className="num">{ov.formula}</span></p>
            </section>
            <section className="panel p-4">
              <h3 className="label mb-2">Solana {ov.solana.cluster}</h3>
              <div className="text-sm">
                <div className="text-slate-500">Launch authority</div>
                <a href={ov.solana.authorityUrl} target="_blank" rel="noreferrer" className="num break-all text-brand-soft underline">{ov.solana.authority}</a>
                <div className="mt-2 text-slate-500">Balance</div>
                <div className="num text-slate-100">{ov.solana.authorityBalance !== null ? `${ov.solana.authorityBalance.toFixed(4)} SOL` : `unavailable (${ov.solana.rpcError})`}</div>
                {ov.solana.cluster !== "mainnet-beta" && <p className="mt-2 text-xs text-slate-500">On devnet the server requests an airdrop automatically before executing. If the faucet is rate-limited, fund this address at faucet.solana.com.</p>}
              </div>
            </section>
            <section className="panel p-4">
              <h3 className="label mb-2">Anti-cheat flags</h3>
              {ov.suspicious.length === 0 ? <p className="text-sm text-slate-500">No flagged players.</p> : (
                <ul className="space-y-1 text-sm">
                  {ov.suspicious.map((s) => (
                    <li key={s.username} className="flex justify-between"><span>{s.username}</span><span className="num text-amber-300">{s.suspicion} strikes · {Math.round(s.rejectedClicks)} rejected</span></li>
                  ))}
                </ul>
              )}
            </section>
            <NewProject busy={!!busy} onCreate={(b) => action({ action: "new_project", ...b })} projects={ov.projects} />
          </aside>
        </div>
      )}
    </div>
  );
}

function NewProject({ busy, onCreate, projects }: { busy: boolean; onCreate: (b: { slug: string; name: string; symbol: string; commodity: string }) => void; projects: Overview["projects"] }) {
  const [b, setB] = useState({ slug: "", name: "", symbol: "", commodity: "OIL" });
  return (
    <section className="panel p-4">
      <h3 className="label mb-2">Projects</h3>
      <ul className="mb-3 space-y-1 text-sm">
        {projects.map((p) => (
          <li key={p.slug} className="flex justify-between">
            <Link href={`/project/${p.slug}`} className={p.isCurrent ? "text-brand-soft" : "text-slate-300"}>${p.symbol} · {p.name}</Link>
            <span className="chip">{p.status}</span>
          </li>
        ))}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(b);
        }}
      >
        <div className="label">Next launch</div>
        <input className="input" placeholder="slug (e.g. oil)" value={b.slug} onChange={(e) => setB({ ...b, slug: e.target.value.toLowerCase() })} required />
        <input className="input" placeholder="Token name" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} required />
        <input className="input" placeholder="SYMBOL" value={b.symbol} onChange={(e) => setB({ ...b, symbol: e.target.value.toUpperCase() })} required />
        <select className="input" value={b.commodity} onChange={(e) => setB({ ...b, commodity: e.target.value })}>{COMMODITY_IDS.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn w-full" disabled={busy}>Create as current project</button>
        <p className="text-[11px] text-slate-500">The previous project stays public at its page. Only one project accepts gameplay at a time.</p>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, value, tone = "text-slate-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md bg-white/[0.03] px-3 py-2">
      <div className="label truncate">{label}</div>
      <div className={`num font-display text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}
