"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";
import { WalletAuth } from "./WalletAuth";

export function AuthPanel({ onUser }: { onUser: (u: PublicUser) => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
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
      <div className="flex gap-1">
        {(["register", "login"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.15em] ${mode === m ? "bg-white/[0.07] text-slate-100" : "text-slate-500"}`}>
            {m === "register" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input className="input" placeholder="Player name" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={20} required />
        <input className="input" placeholder="Password (8+ characters)" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button className="btn-brand w-full" disabled={busy}>{busy ? "…" : mode === "register" ? "Start mining" : "Sign in"}</button>
      </form>
      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-slate-600">
        <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
      </div>
      <WalletAuth user={null} onUser={onUser} />
    </section>
  );
}
