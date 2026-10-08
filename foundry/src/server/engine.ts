/**
 * Server-authoritative game engine.
 *
 * Every number the client shows is derived here. The client only tells the
 * server *what it did* (how many times it clicked, what it wants to buy); the
 * server decides what that is worth, applies anti-cheat limits and keeps the
 * state in Redis, flushing it to Postgres every few seconds.
 */
import type { Project, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { redis, withLock } from "./redis";
import { addGlobal, addPlayer, getGlobalTotals, touchActive, updateLeaderboard, getRank } from "./global";
import { playableUntil } from "./project";
import { HttpError } from "./auth";
import { ACHIEVEMENTS } from "@/lib/content/achievements";
import { GENERATORS, GENERATOR_BY_ID } from "@/lib/content/generators";
import { UPGRADE_BY_ID } from "@/lib/content/upgrades";
import { availableUpgrades, burnSummary, computeRates, generatorBulkCost, generatorCost, levelUpCost, maxAffordable, requirementMet, type OwnedGenerator, type Rates } from "@/lib/economy";

export interface SessionState {
  id: string;
  userId: string;
  username: string;
  projectId: string;
  balance: number;
  totalProduced: number;
  totalClicks: number;
  rejectedClicks: number;
  burnPower: number;
  suspicion: number;
  lastSyncAt: number; // ms, server clock
  lastClickWindowAt: number; // ms, start of the current click window
  generators: OwnedGenerator[];
  upgrades: string[];
  achievements: string[];
  // deltas since last flush
  dClicksReported: number;
  dClicksAccepted: number;
  dWindowStart: number;
  dClicks: number;
  dProduced: number;
  dBurn: number;
  structureDirty: boolean;
}

const skey = (id: string) => `gs:${id}`;
const sidKey = (userId: string, projectId: string) => `gsid:${userId}:${projectId}`;
const DIRTY = "gs:dirty";
const MAX_CLICK_WINDOW_SEC = 30;
const CLICK_GRACE = 5;

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

async function sessionIdFor(userId: string, projectId: string, username: string): Promise<string> {
  const cached = await redis.get(sidKey(userId, projectId));
  if (cached) return cached;
  let row = await prisma.gameSession.findUnique({ where: { userId_projectId: { userId, projectId } }, select: { id: true } });
  if (!row) {
    row = await prisma.gameSession.create({ data: { userId, projectId }, select: { id: true } });
    await addPlayer(projectId);
    await prisma.playerStats.upsert({ where: { userId }, create: { userId, launchesJoined: 1 }, update: { launchesJoined: { increment: 1 } } });
    await updateLeaderboard(projectId, row.id, username, 0);
  }
  await redis.set(sidKey(userId, projectId), row.id, "EX", 3600);
  return row.id;
}

async function loadFromDb(sessionId: string): Promise<SessionState | null> {
  const row = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { generators: true, upgrades: true, user: { select: { username: true, achievements: { select: { achievementId: true } } } } },
  });
  if (!row) return null;
  const now = Date.now();
  return {
    id: row.id,
    userId: row.userId,
    username: row.user.username,
    projectId: row.projectId,
    balance: row.balance,
    totalProduced: row.totalProduced,
    totalClicks: row.totalClicks,
    rejectedClicks: row.rejectedClicks,
    burnPower: row.burnPower,
    suspicion: row.suspicion,
    lastSyncAt: row.lastSyncAt.getTime(),
    lastClickWindowAt: now,
    generators: row.generators.map((g) => ({ id: g.generatorId, count: g.count, level: g.level })),
    upgrades: row.upgrades.map((u) => u.upgradeId),
    achievements: row.user.achievements.map((a) => a.achievementId),
    dClicksReported: 0,
    dClicksAccepted: 0,
    dWindowStart: now,
    dClicks: 0,
    dProduced: 0,
    dBurn: 0,
    structureDirty: false,
  };
}

function toHash(s: SessionState): Record<string, string> {
  return {
    id: s.id, userId: s.userId, username: s.username, projectId: s.projectId,
    balance: String(s.balance), totalProduced: String(s.totalProduced), totalClicks: String(s.totalClicks),
    rejectedClicks: String(s.rejectedClicks), burnPower: String(s.burnPower), suspicion: String(s.suspicion),
    lastSyncAt: String(s.lastSyncAt), lastClickWindowAt: String(s.lastClickWindowAt),
    generators: JSON.stringify(s.generators), upgrades: JSON.stringify(s.upgrades), achievements: JSON.stringify(s.achievements),
    dClicksReported: String(s.dClicksReported), dClicksAccepted: String(s.dClicksAccepted), dWindowStart: String(s.dWindowStart),
    dClicks: String(s.dClicks), dProduced: String(s.dProduced), dBurn: String(s.dBurn), structureDirty: s.structureDirty ? "1" : "0",
  };
}

function fromHash(h: Record<string, string>): SessionState {
  return {
    id: h.id, userId: h.userId, username: h.username, projectId: h.projectId,
    balance: Number(h.balance), totalProduced: Number(h.totalProduced), totalClicks: Number(h.totalClicks),
    rejectedClicks: Number(h.rejectedClicks), burnPower: Number(h.burnPower), suspicion: Number(h.suspicion),
    lastSyncAt: Number(h.lastSyncAt), lastClickWindowAt: Number(h.lastClickWindowAt),
    generators: JSON.parse(h.generators), upgrades: JSON.parse(h.upgrades), achievements: JSON.parse(h.achievements),
    dClicksReported: Number(h.dClicksReported), dClicksAccepted: Number(h.dClicksAccepted), dWindowStart: Number(h.dWindowStart),
    dClicks: Number(h.dClicks), dProduced: Number(h.dProduced), dBurn: Number(h.dBurn), structureDirty: h.structureDirty === "1",
  };
}

async function loadState(sessionId: string): Promise<SessionState> {
  const h = await redis.hgetall(skey(sessionId));
  if (h && h.id) return fromHash(h);
  const s = await loadFromDb(sessionId);
  if (!s) throw new HttpError(404, "Game session not found");
  await redis.hset(skey(sessionId), toHash(s));
  return s;
}

async function saveState(s: SessionState) {
  await redis.multi().hset(skey(s.id), toHash(s)).sadd(DIRTY, s.id).exec();
}

// ---------------------------------------------------------------------------
// Core mechanics
// ---------------------------------------------------------------------------

function rates(s: SessionState, project: Project): Rates {
  return computeRates(s.generators, s.upgrades, project);
}

/** Credit passive production for the time elapsed since the last sync. */
function settle(s: SessionState, project: Project, now: number): { gained: number; burnGain: number } {
  const until = playableUntil(project);
  const effectiveNow = until !== null ? Math.min(now, until) : now;
  const capMs = Math.max(0, project.offlineCapHours) * 3600_000;
  const elapsedMs = Math.max(0, Math.min(effectiveNow - s.lastSyncAt, capMs));
  s.lastSyncAt = Math.max(s.lastSyncAt, effectiveNow);
  if (elapsedMs <= 0) return { gained: 0, burnGain: 0 };
  const r = rates(s, project);
  const sec = elapsedMs / 1000;
  const gained = r.productionPerSec * sec;
  const burnGain = r.burnPerSec * sec;
  s.balance += gained;
  s.totalProduced += gained;
  s.burnPower += burnGain;
  s.dProduced += gained;
  s.dBurn += burnGain;
  return { gained, burnGain };
}

function assertPlayable(project: Project) {
  const until = playableUntil(project);
  if (until !== null && Date.now() >= until) throw new HttpError(423, "The launch window has closed. The supply is being finalized.");
}

/** Validate a batch of clicks against the server clock and the configured cap. */
function applyClicks(s: SessionState, project: Project, reported: number, now: number): { accepted: number; rejected: number; produced: number; burn: number } {
  const windowSec = Math.min(MAX_CLICK_WINDOW_SEC, Math.max(0, (now - s.lastClickWindowAt) / 1000));
  s.lastClickWindowAt = now;
  const allowed = Math.floor(project.maxClicksPerSecond * windowSec) + CLICK_GRACE;
  const accepted = Math.max(0, Math.min(reported, allowed));
  const rejected = reported - accepted;
  if (rejected > allowed * 0.5 + 5) s.suspicion += 1;
  if (accepted === 0) return { accepted, rejected, produced: 0, burn: 0 };
  const r = rates(s, project);
  const produced = accepted * r.clickPower;
  const burn = accepted * r.clickBurn;
  s.balance += produced;
  s.totalProduced += produced;
  s.totalClicks += accepted;
  s.rejectedClicks += rejected;
  s.burnPower += burn;
  s.dClicks += accepted;
  s.dProduced += produced;
  s.dBurn += burn;
  s.dClicksReported += reported;
  s.dClicksAccepted += accepted;
  return { accepted, rejected, produced, burn };
}

function metrics(s: SessionState, r: Rates, globalBurned: number) {
  const cursors = s.generators.filter((g) => GENERATOR_BY_ID[g.id]?.category === "cursor").reduce((a, g) => a + g.count, 0);
  const buildings = s.generators.reduce((a, g) => a + g.count, 0);
  return {
    clicks: s.totalClicks,
    cursors,
    produced: s.totalProduced,
    burn_power: s.burnPower,
    buildings,
    generator_types: s.generators.filter((g) => g.count > 0).length,
    upgrades: s.upgrades.length,
    per_sec: r.productionPerSec,
    global_burned: globalBurned,
  } as const;
}

async function checkAchievements(s: SessionState, r: Rates, project: Project): Promise<string[]> {
  const totals = await getGlobalTotals(project.id);
  const burned = burnSummary(project, totals.totalBurnPower).burnedSupply;
  const m = metrics(s, r, burned);
  const have = new Set(s.achievements);
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    if (m[a.kind] >= a.threshold) fresh.push(a.id);
  }
  if (fresh.length) {
    await prisma.playerAchievement.createMany({ data: fresh.map((id) => ({ userId: s.userId, achievementId: id })), skipDuplicates: true });
    s.achievements.push(...fresh);
  }
  return fresh;
}

async function afterChange(s: SessionState, project: Project, r: Rates, delta: { clicks?: number; produced?: number; burnPower?: number }) {
  await Promise.all([
    addGlobal(project.id, delta),
    touchActive(project.id, s.id, r.productionPerSec),
    updateLeaderboard(project.id, s.id, s.username, s.burnPower),
  ]);
}

// ---------------------------------------------------------------------------
// Public view
// ---------------------------------------------------------------------------

export function view(s: SessionState, project: Project, r: Rates, extra: Record<string, unknown> = {}) {
  const ctx = { totalClicks: s.totalClicks, totalProduced: s.totalProduced, burnPower: s.burnPower, owned: s.generators };
  const owned = new Map(s.generators.map((g) => [g.id, g]));
  return {
    sessionId: s.id,
    serverTime: Date.now(),
    balance: s.balance,
    totalProduced: s.totalProduced,
    totalClicks: s.totalClicks,
    rejectedClicks: s.rejectedClicks,
    burnPower: s.burnPower,
    suspicion: s.suspicion,
    productionPerSec: r.productionPerSec,
    burnPerSec: r.burnPerSec,
    clickPower: r.clickPower,
    clickBurn: r.clickBurn,
    burnMultiplier: r.burnMultiplier,
    autoClicksPerSec: r.autoClicksPerSec,
    globalMultiplier: r.globalMultiplier,
    generators: GENERATORS.map((def) => {
      const o = owned.get(def.id);
      const count = o?.count ?? 0;
      const level = o?.level ?? 1;
      const rate = r.generators.find((g) => g.id === def.id)!;
      return {
        id: def.id,
        count,
        level,
        cost: generatorCost(def, count),
        cost10: generatorBulkCost(def, count, 10),
        levelCost: levelUpCost(def, level),
        perSec: rate.perSec,
        eachPerSec: rate.eachPerSec,
        burnPerSec: rate.burnPerSec,
        unlocked: s.totalProduced >= def.unlockAt || count > 0,
      };
    }),
    upgrades: s.upgrades,
    availableUpgrades: availableUpgrades(s.upgrades, ctx).map((u) => u.id),
    achievements: s.achievements,
    rank: null as number | null,
    newAchievements: [] as string[],
    offlineGain: 0,
    ...extra,
  };
}
export type GameView = ReturnType<typeof view>;

// ---------------------------------------------------------------------------
// Operations (each runs under the session lock)
// ---------------------------------------------------------------------------

async function withSession<T>(user: { id: string; username: string }, project: Project, fn: (s: SessionState) => Promise<T>): Promise<T> {
  const sid = await sessionIdFor(user.id, project.id, user.username);
  return withLock(`gs:${sid}`, async () => {
    const s = await loadState(sid);
    s.username = user.username;
    const out = await fn(s);
    await saveState(s);
    return out;
  });
}

export async function getState(user: { id: string; username: string }, project: Project) {
  return withSession(user, project, async (s) => {
    const now = Date.now();
    const { gained, burnGain } = settle(s, project, now);
    const r = rates(s, project);
    const fresh = await checkAchievements(s, r, project);
    await afterChange(s, project, r, { produced: gained, burnPower: burnGain });
    const rank = await getRank(project.id, s.id);
    return view(s, project, r, { newAchievements: fresh, rank, offlineGain: gained });
  });
}

/** Periodic client sync: settle production and apply the reported click batch. */
export async function sync(user: { id: string; username: string }, project: Project, clicks: number) {
  return withSession(user, project, async (s) => {
    assertPlayable(project);
    const now = Date.now();
    const settled = settle(s, project, now);
    const c = applyClicks(s, project, clicks, now);
    const r = rates(s, project);
    const fresh = await checkAchievements(s, r, project);
    await afterChange(s, project, r, { clicks: c.accepted, produced: settled.gained + c.produced, burnPower: settled.burnGain + c.burn });
    const rank = await getRank(project.id, s.id);
    return view(s, project, r, { newAchievements: fresh, rank, acceptedClicks: c.accepted, rejectedClicks: c.rejected });
  });
}

export async function buyGenerator(user: { id: string; username: string }, project: Project, generatorId: string, qty: number | "max") {
  const def = GENERATOR_BY_ID[generatorId];
  if (!def) throw new HttpError(400, "Unknown generator");
  return withSession(user, project, async (s) => {
    assertPlayable(project);
    const now = Date.now();
    const settled = settle(s, project, now);
    const owned = s.generators.find((g) => g.id === def.id);
    const count = owned?.count ?? 0;
    if (!(s.totalProduced >= def.unlockAt || count > 0)) throw new HttpError(400, `${def.name} is not unlocked yet`);
    const n = qty === "max" ? maxAffordable(def, count, s.balance) : qty;
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new HttpError(400, "Nothing affordable" );
    const cost = generatorBulkCost(def, count, n);
    if (cost > s.balance) throw new HttpError(400, "Not enough balance");
    const before = rates(s, project);
    s.balance -= cost;
    if (owned) owned.count += n;
    else s.generators.push({ id: def.id, count: n, level: 1 });
    s.structureDirty = true;
    const r = rates(s, project);
    const fresh = await checkAchievements(s, r, project);
    await afterChange(s, project, r, { produced: settled.gained, burnPower: settled.burnGain });
    const rank = await getRank(project.id, s.id);
    return view(s, project, r, { newAchievements: fresh, rank, bought: { generatorId: def.id, qty: n, cost }, rateDelta: r.productionPerSec - before.productionPerSec });
  });
}

export async function levelUpGenerator(user: { id: string; username: string }, project: Project, generatorId: string) {
  const def = GENERATOR_BY_ID[generatorId];
  if (!def) throw new HttpError(400, "Unknown generator");
  return withSession(user, project, async (s) => {
    assertPlayable(project);
    const settled = settle(s, project, Date.now());
    const owned = s.generators.find((g) => g.id === def.id);
    if (!owned || owned.count < 1) throw new HttpError(400, `Own at least one ${def.name} first`);
    if (owned.level >= 50) throw new HttpError(400, "Max level reached");
    const cost = levelUpCost(def, owned.level);
    if (cost > s.balance) throw new HttpError(400, "Not enough balance");
    s.balance -= cost;
    owned.level += 1;
    s.structureDirty = true;
    const r = rates(s, project);
    const fresh = await checkAchievements(s, r, project);
    await afterChange(s, project, r, { produced: settled.gained, burnPower: settled.burnGain });
    const rank = await getRank(project.id, s.id);
    return view(s, project, r, { newAchievements: fresh, rank, leveled: { generatorId: def.id, level: owned.level, cost } });
  });
}

export async function buyUpgrade(user: { id: string; username: string }, project: Project, upgradeId: string) {
  const def = UPGRADE_BY_ID[upgradeId];
  if (!def) throw new HttpError(400, "Unknown upgrade");
  return withSession(user, project, async (s) => {
    assertPlayable(project);
    const settled = settle(s, project, Date.now());
    if (s.upgrades.includes(def.id)) throw new HttpError(400, "Already owned");
    const ctx = { totalClicks: s.totalClicks, totalProduced: s.totalProduced, burnPower: s.burnPower, owned: s.generators };
    if (!requirementMet(def.requires, ctx)) throw new HttpError(400, "Requirement not met");
    if (def.cost > s.balance) throw new HttpError(400, "Not enough balance");
    s.balance -= def.cost;
    s.upgrades.push(def.id);
    s.structureDirty = true;
    const r = rates(s, project);
    const fresh = await checkAchievements(s, r, project);
    await afterChange(s, project, r, { produced: settled.gained, burnPower: settled.burnGain });
    const rank = await getRank(project.id, s.id);
    return view(s, project, r, { newAchievements: fresh, rank, upgraded: def.id });
  });
}

// ---------------------------------------------------------------------------
// Flush Redis -> Postgres
// ---------------------------------------------------------------------------

export async function flushDirtySessions(max = 500): Promise<number> {
  const ids = await redis.spop(DIRTY, max);
  if (!ids || ids.length === 0) return 0;
  let n = 0;
  for (const id of ids) {
    try {
      await withLock(`gs:${id}`, async () => {
        const h = await redis.hgetall(skey(id));
        if (!h || !h.id) return;
        const s = fromHash(h);
        await persist(s);
        s.dClicksReported = 0; s.dClicksAccepted = 0; s.dWindowStart = Date.now();
        s.dClicks = 0; s.dProduced = 0; s.dBurn = 0; s.structureDirty = false;
        await redis.hset(skey(id), toHash(s));
      }, 3000, 5);
      n++;
    } catch (e) {
      // keep it dirty for the next round
      await redis.sadd(DIRTY, id);
      console.error("[flush]", id, (e as Error).message);
    }
  }
  return n;
}

async function persist(s: SessionState) {
  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.gameSession.update({
      where: { id: s.id },
      data: {
        balance: s.balance, totalProduced: s.totalProduced, totalClicks: s.totalClicks, rejectedClicks: s.rejectedClicks,
        burnPower: s.burnPower, suspicion: s.suspicion, lastSyncAt: new Date(s.lastSyncAt),
      },
    }),
  ];
  if (s.dClicks || s.dProduced || s.dBurn) {
    ops.push(
      prisma.playerStats.upsert({
        where: { userId: s.userId },
        create: { userId: s.userId, lifetimeClicks: s.dClicks, lifetimeProduced: s.dProduced, lifetimeBurnPower: s.dBurn, launchesJoined: 1 },
        update: { lifetimeClicks: { increment: s.dClicks }, lifetimeProduced: { increment: s.dProduced }, lifetimeBurnPower: { increment: s.dBurn } },
      }),
    );
  }
  if (s.dClicksReported > 0) {
    ops.push(prisma.clickBatch.create({ data: { sessionId: s.id, reported: Math.round(s.dClicksReported), accepted: Math.round(s.dClicksAccepted), windowStart: new Date(s.dWindowStart), windowEnd: now } }));
  }
  if (s.structureDirty) {
    for (const g of s.generators) {
      ops.push(prisma.playerGenerator.upsert({ where: { sessionId_generatorId: { sessionId: s.id, generatorId: g.id } }, create: { sessionId: s.id, generatorId: g.id, count: g.count, level: g.level }, update: { count: g.count, level: g.level } }));
    }
    if (s.upgrades.length) {
      ops.push(prisma.playerUpgrade.createMany({ data: s.upgrades.map((u) => ({ sessionId: s.id, upgradeId: u })), skipDuplicates: true }));
    }
  }
  await prisma.$transaction(ops);
}

/**
 * Credit every session's passive production up to the freeze instant, so
 * players who were offline when the countdown ended are not short-changed.
 * Runs once per launch, at freeze time.
 */
export async function settleAllSessions(project: Project): Promise<number> {
  const ids = await prisma.gameSession.findMany({ where: { projectId: project.id }, select: { id: true } });
  let n = 0;
  for (const { id } of ids) {
    try {
      await withLock(`gs:${id}`, async () => {
        const s = await loadState(id);
        const { gained, burnGain } = settle(s, project, Date.now());
        if (gained > 0 || burnGain > 0) {
          const r = rates(s, project);
          await afterChange(s, project, r, { produced: gained, burnPower: burnGain });
        }
        await saveState(s);
      }, 5000, 10);
      n++;
    } catch (e) {
      console.error("[settleAll]", id, (e as Error).message);
    }
  }
  return n;
}

export async function flushAll(): Promise<number> {
  let total = 0;
  for (;;) {
    const n = await flushDirtySessions(500);
    total += n;
    if (n < 500) break;
  }
  return total;
}
