import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { getCurrentProject, invalidateProjectCache, publicProject } from "@/server/project";
import { createNewProject, executeLaunch, extendLaunch, finalizeProject, freezeProject, startLaunch } from "@/server/launch";
import { handler, json, parseBody, fail } from "@/server/http";
import { COMMODITY_IDS } from "@/lib/content/commodities";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), durationHours: z.number().positive().optional() }),
  z.object({ action: z.literal("extend"), hours: z.number().positive().max(24 * 365) }),
  z.object({ action: z.literal("freeze") }),
  z.object({ action: z.literal("unfreeze"), hours: z.number().positive().max(24 * 365) }),
  z.object({ action: z.literal("finalize") }),
  z.object({ action: z.literal("execute") }),
  z.object({
    action: z.literal("new_project"),
    slug: z.string().trim().min(2).max(32).regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(1).max(32),
    symbol: z.string().trim().min(1).max(10).regex(/^[A-Z0-9]+$/),
    commodity: z.enum(COMMODITY_IDS as [string, ...string[]]),
  }),
]);

export const POST = handler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, schema);
  const p = await getCurrentProject(true);
  switch (body.action) {
    case "start":
      return json({ project: publicProject(await startLaunch(p.id, body.durationHours)) });
    case "extend":
      return json({ project: publicProject(await extendLaunch(p.id, body.hours)) });
    case "freeze":
      return json({ project: publicProject(await freezeProject(p.id, "admin")) });
    case "unfreeze": {
      if (p.status !== "FROZEN") return fail(400, "Only a frozen (not finalized) launch can be reopened");
      const launch = await prisma.launch.findUnique({ where: { projectId: p.id } });
      if (launch) return fail(400, "Already finalized");
      const now = new Date();
      const u = await prisma.project.update({ where: { id: p.id }, data: { status: "ACTIVE", frozenAt: null, startedAt: p.startedAt ?? now, endsAt: new Date(now.getTime() + body.hours * 3600_000) } });
      invalidateProjectCache();
      return json({ project: publicProject(u) });
    }
    case "finalize":
      return json({ launch: await finalizeProject(p.id) });
    case "execute": {
      const token = await executeLaunch(p.id);
      return json({ token });
    }
    case "new_project": {
      if (p.status === "ACTIVE" || p.status === "MINTING") return fail(400, "Finish or freeze the current launch first");
      if (await prisma.project.findUnique({ where: { slug: body.slug } })) return fail(409, "Slug already used");
      const np = await createNewProject({ slug: body.slug, name: body.name, symbol: body.symbol, commodity: body.commodity });
      return json({ project: publicProject(np) });
    }
  }
});
