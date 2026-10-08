/**
 * The current project (the token being launched) and the catalog sync.
 */
import type { Project } from "@prisma/client";
import { prisma } from "./db";
import { GENERATORS } from "@/lib/content/generators";
import { UPGRADES } from "@/lib/content/upgrades";
import { ACHIEVEMENTS } from "@/lib/content/achievements";

let cache: { project: Project; at: number } | null = null;
const TTL = 2000;

export async function getCurrentProject(fresh = false): Promise<Project> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.project;
  let project = await prisma.project.findFirst({ where: { isCurrent: true } });
  if (!project) project = await createDefaultProject();
  cache = { project, at: Date.now() };
  return project;
}

export function invalidateProjectCache() {
  cache = null;
}

export async function createDefaultProject(): Promise<Project> {
  return prisma.project.create({
    data: {
      slug: "gold",
      name: "Foundry Gold",
      symbol: "GOLD",
      commodity: "GOLD",
      isCurrent: true,
      globalStats: { create: {} },
    },
  });
}

/** Mirror the code catalogs into the database so rows can be joined/queried. */
export async function syncCatalog() {
  for (const [i, g] of GENERATORS.entries()) {
    await prisma.generator.upsert({
      where: { id: g.id },
      create: { id: g.id, name: g.name, category: g.category, baseCost: g.baseCost, baseProduction: g.baseProduction, burnWeight: g.burnWeight, unlockAt: g.unlockAt, sortOrder: i },
      update: { name: g.name, category: g.category, baseCost: g.baseCost, baseProduction: g.baseProduction, burnWeight: g.burnWeight, unlockAt: g.unlockAt, sortOrder: i },
    });
  }
  for (const [i, u] of UPGRADES.entries()) {
    const effect = JSON.stringify(u.effect);
    await prisma.upgrade.upsert({
      where: { id: u.id },
      create: { id: u.id, name: u.name, description: u.description, cost: u.cost, effect, sortOrder: i },
      update: { name: u.name, description: u.description, cost: u.cost, effect, sortOrder: i },
    });
  }
  for (const [i, a] of ACHIEVEMENTS.entries()) {
    await prisma.achievement.upsert({
      where: { id: a.id },
      create: { id: a.id, name: a.name, description: a.description, kind: a.kind, threshold: a.threshold, sortOrder: i },
      update: { name: a.name, description: a.description, kind: a.kind, threshold: a.threshold, sortOrder: i },
    });
  }
}

export function isPlayable(p: Project): boolean {
  return p.status === "DRAFT" || p.status === "ACTIVE";
}

/** The instant after which no gameplay counts. */
export function playableUntil(p: Project): number | null {
  if (p.frozenAt) return p.frozenAt.getTime();
  if (p.status === "ACTIVE" && p.endsAt) return p.endsAt.getTime();
  if (!isPlayable(p)) return p.updatedAt.getTime();
  return null;
}

export function publicProject(p: Project) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    symbol: p.symbol,
    commodity: p.commodity,
    status: p.status,
    initialSupply: p.initialSupply,
    maxBurnPercent: p.maxBurnPercent,
    burnFormula: p.burnFormula,
    burnRate: p.burnRate,
    burnHalfLife: p.burnHalfLife,
    communityAllocationPercent: p.communityAllocationPercent,
    decimals: p.decimals,
    launchDurationHours: p.launchDurationHours,
    startedAt: p.startedAt?.toISOString() ?? null,
    endsAt: p.endsAt?.toISOString() ?? null,
    frozenAt: p.frozenAt?.toISOString() ?? null,
    clickMultiplier: p.clickMultiplier,
    cursorMultiplier: p.cursorMultiplier,
    generatorMultiplier: p.generatorMultiplier,
    maxClicksPerSecond: p.maxClicksPerSecond,
    offlineCapHours: p.offlineCapHours,
    createdAt: p.createdAt.toISOString(),
  };
}
export type PublicProject = ReturnType<typeof publicProject>;
