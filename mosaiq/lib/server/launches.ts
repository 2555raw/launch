import "server-only";
import { draftInputSchema, fieldErrors, type DraftInput } from "@/lib/schemas";
import { pads } from "@/lib/pads";
import type { Agent, Launch, PublicLaunch, Stats } from "@/lib/types";
import { canLaunchOnChain, shortAddress } from "@/lib/onchain";
import { VersionedTransaction } from "@solana/web3.js";
import { adapterFor } from "./adapters";
import { newId } from "./ids";
import { accountExists, buildCreateTx, checkCreate, isPublicKey, messageHash, PumpError, sendSigned, uploadMetadata } from "./pump";
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
  if (canLaunchOnChain(draft)) {
    return {
      ok: false as const,
      error: "Pump.fun launches are signed by a Solana wallet. Call prepare_launch with your wallet (creator) and a fresh mint public key, sign, send, then confirm_launch.",
    };
  }
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

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

const fail = (err: unknown): { ok: false; status: number; error: string } =>
  err instanceof PumpError ? { ok: false, status: err.status, error: err.message } : { ok: false, status: 500, error: "Something went wrong. Try again." };

/** Seconds a relayed transaction may stay unconfirmed before its blockhash is surely expired. */
const EXPIRY_MS = 120_000;

/**
 * Step 1 of an on-chain launch: upload metadata and return the unsigned
 * transaction for the creator wallet and the mint keypair to sign.
 */
export async function prepareOnChain(
  id: string,
  body: { creator?: unknown; mint?: unknown },
  origin: string,
): Promise<Result<{ transaction: string; mint: string }>> {
  try {
    const launch = await store().getLaunch(id);
    if (!launch) return { ok: false, status: 404, error: "No draft with that id." };
    if (!canLaunchOnChain(launch)) return { ok: false, status: 422, error: "Only Pump.fun launches paired with SOL go on-chain today." };
    if (launch.status === "live") return { ok: false, status: 409, error: "This token is already live." };
    if (launch.status === "queued" && launch.submittedAt && Date.now() - Date.parse(launch.submittedAt) < EXPIRY_MS) {
      return { ok: false, status: 409, error: "This launch is still confirming. Wait a moment." };
    }
    if (!isPublicKey(body.creator)) return { ok: false, status: 422, error: "creator must be a Solana wallet address." };
    if (!isPublicKey(body.mint) || body.mint === body.creator) return { ok: false, status: 422, error: "mint must be a fresh Solana public key." };

    if (await accountExists(body.mint)) return { ok: false, status: 422, error: "mint must be a fresh keypair; that account already exists." };

    const website = launch.website ?? `${origin}/explore?q=${encodeURIComponent(launch.ticker)}`;
    const metadataUri = launch.metadataUri ?? (await uploadMetadata(launch, website));
    const tx = await buildCreateTx({
      creator: body.creator,
      mint: body.mint,
      name: launch.name,
      symbol: launch.ticker,
      uri: metadataUri,
      buySol: launch.openingBuy ? Number(launch.openingBuy) : 0,
    });
    await store().updateLaunch(id, {
      status: "draft",
      statusNote: undefined,
      signature: undefined,
      creator: body.creator,
      mint: body.mint,
      metadataUri,
      preparedHash: messageHash(tx),
    });
    return { ok: true, transaction: Buffer.from(tx.serialize()).toString("base64"), mint: body.mint };
  } catch (err) {
    return fail(err);
  }
}

/** Step 2 (web): relay the transaction the wallet and mint signed. Only the prepared message is accepted. */
export async function relayOnChain(id: string, transaction: unknown): Promise<Result<{ signature: string }>> {
  try {
    const launch = await store().getLaunch(id);
    if (!launch?.preparedHash || !launch.creator || !launch.mint) return { ok: false, status: 409, error: "Prepare the launch first." };
    if (launch.status !== "draft") return { ok: false, status: 409, error: `This launch is already ${launch.status}.` };
    if (typeof transaction !== "string" || transaction.length > 4000) return { ok: false, status: 422, error: "transaction must be base64." };
    let tx: VersionedTransaction;
    try {
      tx = VersionedTransaction.deserialize(new Uint8Array(Buffer.from(transaction, "base64")));
    } catch {
      return { ok: false, status: 422, error: "That is not a Solana transaction." };
    }
    if (messageHash(tx) !== launch.preparedHash) return { ok: false, status: 422, error: "That transaction is not the one prepared for this draft." };
    if (tx.signatures.some((sig) => sig.every((b) => b === 0))) return { ok: false, status: 422, error: "The transaction is missing a signature." };

    const signature = await sendSigned(tx.serialize());
    await store().updateLaunch(id, {
      status: "queued",
      signature,
      statusNote: "Confirming on Solana",
      submittedAt: new Date().toISOString(),
    });
    return { ok: true, signature };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Step 3: check the signature on Solana and mark the launch live. Agents that
 * send the transaction themselves pass its signature here.
 */
export async function confirmOnChain(
  id: string,
  signature: unknown,
  agent: Agent | null,
): Promise<Result<{ launch: Launch; state: "pending" | "live" | "failed" }>> {
  try {
    const launch = await store().getLaunch(id);
    if (!launch?.creator || !launch.mint) return { ok: false, status: 409, error: "Prepare the launch first." };
    if (launch.status === "live") return { ok: true, launch, state: "live" };
    const sig = typeof signature === "string" && signature ? signature : launch.signature;
    if (!sig || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) return { ok: false, status: 422, error: "Pass the transaction signature." };

    const submittedAt = launch.signature === sig && launch.submittedAt ? launch.submittedAt : new Date().toISOString();
    const result = await checkCreate(sig, launch.creator, launch.mint);
    // Until a launch is relayed here or proven live, a signature only gets an answer:
    // nothing is written, so an unknown signature cannot put a draft on the ledger.
    if (launch.status === "draft" && result.state !== "live") return { ok: true, launch, state: result.state };
    let patch: Partial<Launch>;
    if (result.state === "live") {
      patch = {
        status: "live",
        address: launch.mint,
        statusNote: "Live on Pump.fun",
        agentId: agent?.id ?? launch.agentId,
        agentName: agent?.name ?? launch.agentName ?? shortAddress(launch.creator),
        marketCapUsd: await adapterFor(launch.pad).marketCap({ ...launch, address: launch.mint }),
      };
      if (agent) await store().updateAgent(agent.id, { launches: agent.launches + 1, lastSeenAt: new Date().toISOString() });
    } else if (result.state === "failed") {
      patch = { status: "failed", statusNote: result.reason };
    } else if (Date.now() - Date.parse(submittedAt) > EXPIRY_MS) {
      patch = { status: "failed", statusNote: "The transaction never landed on Solana. Launch again." };
    } else {
      patch = { status: "queued", statusNote: "Confirming on Solana" };
    }
    const updated = await store().updateLaunch(id, { ...patch, signature: sig, submittedAt });
    return { ok: true, launch: updated!, state: updated!.status === "live" ? "live" : updated!.status === "failed" ? "failed" : "pending" };
  } catch (err) {
    return fail(err);
  }
}

let lastRefresh = 0;

/** Refresh live market caps in the background, at most once a minute. */
function refreshMarketCaps(rows: Launch[]) {
  if (Date.now() - lastRefresh < 60_000) return;
  lastRefresh = Date.now();
  void Promise.all(
    rows
      .filter((l) => l.status === "live" && l.address)
      .map(async (l) => {
        const cap = await adapterFor(l.pad).marketCap(l).catch(() => null);
        if (cap !== null && cap !== l.marketCapUsd) await store().updateLaunch(l.id, { marketCapUsd: cap });
      }),
  );
}

/** Everything an agent has submitted. Drafts stay private. */
export async function ledger(): Promise<Launch[]> {
  const rows = (await store().listLaunches()).filter((l) => l.status !== "draft");
  refreshMarketCaps(rows);
  return rows;
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
