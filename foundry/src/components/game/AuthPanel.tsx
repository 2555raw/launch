"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";
import { WalletAuth } from "./WalletAuth";

/** Sign in to an existing account (and, outside the game, create one). */
export function AuthPanel({ onUser, loginOnly = false }: { onUser: (u: PublicUser) => void; loginOnly?: boolean }) {
  const [mode, setMode] = useState<"register" | "login">(loginOnly ? "login" : "register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: PublicUser }>(`/api/auth/${mode}`, { json: { username, password } });
      onUser(r.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-5">
      {!loginOnly && (
        <div className="flex gap-1">
          {(["register", "login"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.15em] ${mode === m ? "bg-white/[0.07] text-slate-100" : "text-slate-500"}`}>
              {m === "register" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>
      )}
      {loginOnly && <div className="label mb-1">Sign in to an existing account</div>}
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input className="input" placeholder="Player name" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} required />
        <input className="input" placeholder="Password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button className="btn-brand w-full" disabled={busy}>{busy ? "…" : mode === "register" ? "Start mining" : "Sign in"}</button>
      </form>
      {!loginOnly && (
        <>
          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-slate-600">
            <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
          </div>
          <WalletAuth user={null} onUser={onUser} />
        </>
      )}
    </section>
  );
}

/** Give a guest foundry a permanent name and password; progress is kept. */
export function SecureAccount({ user, onUser }: { user: PublicUser; onUser: (u: PublicUser) => void }) {
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: PublicUser }>("/api/auth/secure", { json: { username, password } });
      onUser(r.user);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="text-sm text-emerald-300">Account secured. You can sign in from any device as {username}.</p>;
  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-xs text-slate-500">You are playing as a guest. Set a name and password to keep this foundry on other devices.</p>
      <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} required placeholder="Foundry name" />
      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder="Password (8+ characters)" autoComplete="new-password" />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button className="btn-brand w-full" disabled={busy}>{busy ? "…" : "Secure this account"}</button>
    </form>
  );
}
