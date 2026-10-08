"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";

interface Row { rank: number; username: string; burnPower: number; sessionId: string }

export function Leaderboard({ me, myRank }: { me: string; myRank: number | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    const load = () => api<{ leaderboard: Row[] }>("/api/game/leaderboard").then((r) => setRows(r.leaderboard)).catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>Ranked by burn power contributed</span>
        {myRank && <span>You are #{myRank}</span>}
      </div>
      <ol className="divide-y divide-white/[0.05]">
        {rows.map((r) => (
          <li key={r.sessionId} className={`flex items-center gap-3 py-1.5 text-sm ${r.username === me ? "text-brand-soft" : "text-slate-300"}`}>
            <span className="num w-8 text-right text-slate-500">#{r.rank}</span>
            <span className="flex-1 truncate font-medium">{r.username}</span>
            <span className="num text-ember">{fmt(r.burnPower)}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No contributions yet. Be first.</li>}
      </ol>
    </div>
  );
}
