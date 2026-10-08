import { z } from "zod";
import { requireUser } from "@/server/auth";
import { buyUpgrade } from "@/server/engine";
import { getCurrentProject } from "@/server/project";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  if (!(await rateLimit(`upgrade:${user.id}`, 10, 1))) return fail(429, "Too many requests");
  const { upgradeId } = await parseBody(req, z.object({ upgradeId: z.string().max(40) }));
  const project = await getCurrentProject();
  return json({ state: await buyUpgrade(user, project, upgradeId) });
});
