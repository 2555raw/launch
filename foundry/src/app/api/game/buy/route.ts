import { z } from "zod";
import { requireUser } from "@/server/auth";
import { buyGenerator } from "@/server/engine";
import { getCurrentProject } from "@/server/project";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

const schema = z.object({ generatorId: z.string().max(40), qty: z.union([z.literal("max"), z.number().int().min(1).max(100)]) });

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  if (!(await rateLimit(`buy:${user.id}`, 10, 1))) return fail(429, "Too many purchases per second");
  const { generatorId, qty } = await parseBody(req, schema);
  const project = await getCurrentProject();
  return json({ state: await buyGenerator(user, project, generatorId, qty) });
});
