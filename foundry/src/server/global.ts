/**
 * Community-wide counters. Redis holds the live values (INCRBYFLOAT is atomic,
 * so thousands of players can add to them concurrently); GlobalStats in
 * Postgres is flushed from here and becomes the value of record on freeze.
 */
import type { Project } from "@prisma/client";
import { prisma } from "./db";
import { redis } from "./redis";
import { burnSummary } from "@/lib/economy";

const ACTIVE_WINDOW_MS = 120_000;

export const gkey = (projectId: string) => `global:${projectId}`;
export const activeKey = (projectId: string) => `active:${projectId}`;
export const rateKey = (projectId: string) => `gsrate:${projectId}`;
export const lbKey = (projectId: string) => `lb:${projectId}`;
export const lbNameKey = (projectId: string) => `lbname:${projectId}`;

export interface GlobalTotals {
  totalClicks: number;
  totalProduced: number;
  totalBurnPower: number;
  players: number;
}

export async function ensureGlobalLoaded(projectId: string) {
  const exists = await redis.exists(gkey(projectId));
  if (exists) return;
  const row = await prisma.globalStats.findUnique({ where: { projectId } });
  const players = await prisma.gameSession.count({ where: { projectId } });
  await redis.hset(gkey(projectId), {
    totalClicks: row?.totalClicks ?? 0,
    totalProduced: row?.totalProduced ?? 0,
    totalBurnPower: row?.totalBurnPower ?? 0,
    players,
  });
}

export async function addGlobal(projectId: string, delta: { clicks?: number; produced?: number; burnPower?: number }) {
  const m = redis.multi();
  if (delta.clicks) m.hincrbyfloat(gkey(projectId), "totalClicks", delta.clicks);
  if (delta.produced) m.hincrbyfloat(gkey(projectId), "totalProduced", delta.produced);
  if (delta.burnPower) m.hincrbyfloat(gkey(projectId), "totalBurnPower", delta.burnPower);
  await m.exec();
}

export async function addPlayer(projectId: string) {
  await redis.hincrby(gkey(projectId), "players", 1);
}

export async function getGlobalTotals(projectId: string): Promise<GlobalTotals> {
  await ensureGlobalLoaded(projectId);
  const h = await redis.hgetall(gkey(projectId));
  return {
    totalClicks: Number(h.totalClicks ?? 0),
    totalProduced: Number(h.totalProduced ?? 0),
    totalBurnPower: Number(h.totalBurnPower ?? 0),
    players: Number(h.players ?? 0),
  };
}

/** Sum of production/sec of players seen in the last two minutes. */
export async function getActiveProduction(projectId: string): Promise<{ activePlayers: number; productionPerSec: number }> {
  const now = Date.now();
  await redis.zremrangebyscore(activeKey(projectId), 0, now - ACTIVE_WINDOW_MS * 10);
  const ids = await redis.zrangebyscore(activeKey(projectId), now - ACTIVE_WINDOW_MS, now);
  if (ids.length === 0) return { activePlayers: 0, productionPerSec: 0 };
  const rates = await redis.hmget(rateKey(projectId), ...ids);
  let sum = 0;
  for (const r of rates) sum += Number(r ?? 0);
  return { activePlayers: ids.length, productionPerSec: sum };
}

export async function touchActive(projectId: string, sessionId: string, productionPerSec: number) {
  await redis.multi().zadd(activeKey(projectId), Date.now(), sessionId).hset(rateKey(projectId), sessionId, productionPerSec).exec();
}

export async function updateLeaderboard(projectId: string, sessionId: string, username: string, burnPower: number) {
  await redis.multi().zadd(lbKey(projectId), burnPower, sessionId).hset(lbNameKey(projectId), sessionId, username).exec();
}

export async function getLeaderboard(projectId: string, n = 20) {
  const raw = await redis.zrevrange(lbKey(projectId), 0, n - 1, "WITHSCORES");
  const ids: string[] = [];
  const scores: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    ids.push(raw[i]);
    scores.push(Number(raw[i + 1]));
  }
  if (ids.length === 0) return [];
  const names = await redis.hmget(lbNameKey(projectId), ...ids);
  return ids.map((id, i) => ({ sessionId: id, username: names[i] ?? "anonymous", burnPower: scores[i], rank: i + 1 }));
}

export async function getRank(projectId: string, sessionId: string): Promise<number | null> {
  const r = await redis.zrevrank(lbKey(projectId), sessionId);
  return r === null ? null : r + 1;
}

export interface GlobalSnapshot {
  projectId: string;
  symbol: string;
  name: string;
  commodity: string;
  status: Project["status"];
  serverTime: number;
  startedAt: number | null;
  endsAt: number | null;
  frozenAt: number | null;
  totalClicks: number;
  totalProduced: number;
  totalBurnPower: number;
  productionPerSec: number;
  players: number;
  activePlayers: number;
  initialSupply: number;
  burnedSupply: number;
  finalSupply: number;
  burnPercent: number;
  maxBurn: number;
  maxBurnPercent: number;
  launchProgress: number;
}

export async function getGlobalSnapshot(project: Project): Promise<GlobalSnapshot> {
  const totals = await getGlobalTotals(project.id);
  const frozen = !(project.status === "DRAFT" || project.status === "ACTIVE");
  const active = frozen ? { activePlayers: 0, productionPerSec: 0 } : await getActiveProduction(project.id);
  // Once a launch is finalized, the frozen Launch row is the source of truth.
  let summary = burnSummary(project, totals.totalBurnPower);
  if (frozen) {
    const launch = await prisma.launch.findUnique({ where: { projectId: project.id } });
    if (launch) {
      summary = { initialSupply: launch.initialSupply, burnedSupply: launch.burnedSupply, finalSupply: launch.finalSupply, burnPercent: launch.burnPercent, maxBurn: summary.maxBurn };
    }
  }
  const now = Date.now();
  const startedAt = project.startedAt?.getTime() ?? null;
  const endsAt = project.endsAt?.getTime() ?? null;
  const launchProgress = startedAt && endsAt ? Math.min(100, Math.max(0, ((now - startedAt) / (endsAt - startedAt)) * 100)) : 0;
  return {
    projectId: project.id,
    symbol: project.symbol,
    name: project.name,
    commodity: project.commodity,
    status: project.status,
    serverTime: now,
    startedAt,
    endsAt,
    frozenAt: project.frozenAt?.getTime() ?? null,
    ...totals,
    productionPerSec: active.productionPerSec,
    activePlayers: active.activePlayers,
    initialSupply: summary.initialSupply,
    burnedSupply: summary.burnedSupply,
    finalSupply: summary.finalSupply,
    burnPercent: summary.burnPercent,
    maxBurn: summary.maxBurn,
    maxBurnPercent: project.maxBurnPercent,
    launchProgress,
  };
}

/** Write the Redis totals to Postgres. Called by the scheduler and before freezing. */
export async function flushGlobal(project: Project) {
  const totals = await getGlobalTotals(project.id);
  const active = await getActiveProduction(project.id);
  const summary = burnSummary(project, totals.totalBurnPower);
  await prisma.globalStats.upsert({
    where: { projectId: project.id },
    create: { projectId: project.id, ...totals, productionPerSec: active.productionPerSec, burnedSupply: summary.burnedSupply },
    update: { ...totals, productionPerSec: active.productionPerSec, burnedSupply: summary.burnedSupply },
  });
  return { totals, summary };
}
