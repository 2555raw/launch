import "server-only";
import { draftInputSchema, fieldErrors, type DraftInput } from "@/lib/schemas";
import { pads } from "@/lib/pads";
import type { Agent, CreatorRank, Launch, PublicLaunch, Stats } from "@/lib/types";
import { adapterFor } from "./adapters";
import { newId } from "./ids";
import { store } from "./store";

export type Sort = "newest" | "oldest" | "marketcap";

export function toPublic({ agentId: _agentId, ...rest }: Launch): PublicLaunch {
  return rest;
}

export async function createDraft(input: unknown): Promise<{ ok: true; launch: Launch } | { ok: false; errors: Record<string, string> }> {
  const parsed = draftInputSchema.safeParse(input as DraftInput);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const launch: Launch = {
    id: newId("drf"),
    mode: d.mode,
    status: "draft",
    name: d.name,
    ticker: d.ticker,
    description: d.description,
    image: d.image,
    chain: d.chain as Launch["chain"],
    pad: d.pad,
    pair: d.pair,
    x: d.x,
    website: d.websiteMode === "custom" ? d.website : undefined,
    openingBuy: d.mode === "create" ? d.openingBuy : undefined,
    address: d.mode === "import" ? d.address : undefined,
    marketCapUsd: null,
    createdAt: new Date().toISOString(),
  };
  await store().insertLaunch(launch);
  return { ok: true, launch };
}

export async function submitDraft(draftId: string, agent: Agent) {
  const draft = await store().getLaunch(draftId);
  if (!draft) return { ok: false as const, error: "No draft with that id." };
  if (draft.status !== "draft") return { ok: false as const, error: `This draft was already submitted (${draft.status}).` };
  const result = await adapterFor(draft.pad).submit(draft);
  const updated = await store().updateLaunch(draft.id, {
    status: result.status,
    address: result.address ?? draft.address,
    statusNote: result.note,
    agentId: agent.id,
    agentName: agent.name,
    submittedAt: new Date().toISOString(),
  });
  await store().updateAgent(agent.id, { launches: agent.launches + 1, lastSeenAt: new Date().toISOString() });
  return { ok: true as const, launch: updated! };
}

/** Everything an agent has submitted. Drafts stay private. */
export async function ledger(): Promise<Launch[]> {
  return (await store().listLaunches()).filter((l) => l.status !== "draft");
}

export async function queryLaunches(opts: { q?: string; chain?: string; pad?: string; sort?: Sort; limit?: number }) {
  const q = opts.q?.trim().toLowerCase();
  let rows = await ledger();
  if (opts.chain) rows = rows.filter((l) => l.chain === opts.chain);
  if (opts.pad) rows = rows.filter((l) => l.pad === opts.pad);
  if (q) {
    rows = rows.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.ticker.toLowerCase().includes(q) ||
        l.address?.toLowerCase() === q ||
        l.agentName?.toLowerCase().includes(q),
    );
  }
  const time = (l: Launch) => new Date(l.submittedAt ?? l.createdAt).getTime();
  rows.sort((a, b) =>
    opts.sort === "oldest"
      ? time(a) - time(b)
      : opts.sort === "marketcap"
        ? (b.marketCapUsd ?? -1) - (a.marketCapUsd ?? -1) || time(b) - time(a)
        : time(b) - time(a),
  );
  return rows.slice(0, opts.limit ?? 200).map(toPublic);
}

export async function stats(days: number | "all" = 30): Promise<Stats> {
  const rows = await ledger();
  const now = Date.now();
  const dayMs = 86_400_000;
  const byPad: Record<string, number> = Object.fromEntries(pads.map((p) => [p.id, 0]));
  for (const l of rows) byPad[l.pad] = (byPad[l.pad] ?? 0) + 1;

  const firstDay = rows.reduce((min, l) => Math.min(min, new Date(l.submittedAt ?? l.createdAt).getTime()), now);
  const span = days === "all" ? Math.max(7, Math.ceil((now - firstDay) / dayMs) + 1) : days;
  const start = new Date(now - (span - 1) * dayMs);
  start.setUTCHours(0, 0, 0, 0);
  const series = Array.from({ length: span }, (_, i) => ({
    date: new Date(start.getTime() + i * dayMs).toISOString().slice(0, 10),
    count: 0,
  }));
  for (const l of rows) {
    const idx = Math.floor((new Date(l.submittedAt ?? l.createdAt).getTime() - start.getTime()) / dayMs);
    if (idx >= 0 && idx < series.length) series[idx].count += 1;
  }

  return {
    marketCapUsd: rows.reduce((s, l) => s + (l.marketCapUsd ?? 0), 0),
    totalLaunches: rows.length,
    launches24h: rows.filter((l) => now - new Date(l.submittedAt ?? l.createdAt).getTime() < dayMs).length,
    byPad,
    series,
  };
}

export async function topCreators(limit = 5): Promise<CreatorRank[]> {
  const counts = new Map<string, number>();
  for (const l of await ledger()) if (l.agentName) counts.set(l.agentName, (counts.get(l.agentName) ?? 0) + 1);
  return [...counts]
    .map(([name, launches]) => ({ name, launches }))
    .sort((a, b) => b.launches - a.launches)
    .slice(0, limit);
}
