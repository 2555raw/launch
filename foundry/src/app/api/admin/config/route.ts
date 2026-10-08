import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { getCurrentProject, invalidateProjectCache, publicProject } from "@/server/project";
import { handler, json, parseBody, fail } from "@/server/http";
import { COMMODITY_IDS } from "@/lib/content/commodities";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(32).optional(),
  symbol: z.string().trim().min(1).max(10).regex(/^[A-Z0-9]+$/, "A-Z and digits").optional(),
  commodity: z.enum(COMMODITY_IDS as [string, ...string[]]).optional(),
  initialSupply: z.number().positive().max(1e18).optional(),
  maxBurnPercent: z.number().min(0).max(100).optional(),
  burnFormula: z.enum(["linear", "asymptotic"]).optional(),
  burnRate: z.number().min(0).optional(),
  burnHalfLife: z.number().positive().optional(),
  communityAllocationPercent: z.number().min(0).max(100).optional(),
  decimals: z.number().int().min(0).max(9).optional(),
  revokeMintAuthority: z.boolean().optional(),
  clickMultiplier: z.number().positive().max(1000).optional(),
  cursorMultiplier: z.number().positive().max(1000).optional(),
  generatorMultiplier: z.number().positive().max(1000).optional(),
  maxClicksPerSecond: z.number().min(1).max(100).optional(),
  offlineCapHours: z.number().min(0).max(720).optional(),
  launchDurationHours: z.number().positive().max(24 * 365).optional(),
});

export const GET = handler(async (req) => {
  await requireAdmin(req);
  const p = await getCurrentProject(true);
  return json({ project: { ...publicProject(p), revokeMintAuthority: p.revokeMintAuthority } });
});

export const PUT = handler(async (req) => {
  await requireAdmin(req);
  const data = await parseBody(req, schema);
  const p = await getCurrentProject(true);
  const locked = !(p.status === "DRAFT" || p.status === "ACTIVE");
  if (locked) {
    // tokenomics are frozen with the game; only cosmetic fields may change
    const allowed = new Set(["name", "commodity"]);
    for (const k of Object.keys(data)) if (!allowed.has(k)) return fail(400, `"${k}" is locked once the launch is frozen`);
  }
  if (data.decimals !== undefined || data.initialSupply !== undefined) {
    const supply = data.initialSupply ?? p.initialSupply;
    const dec = data.decimals ?? p.decimals;
    if (supply * 10 ** dec > 1.8e19) return fail(400, "initialSupply × 10^decimals exceeds the SPL token u64 limit");
  }
  const updated = await prisma.project.update({ where: { id: p.id }, data });
  invalidateProjectCache();
  return json({ project: { ...publicProject(updated), revokeMintAuthority: updated.revokeMintAuthority } });
});
