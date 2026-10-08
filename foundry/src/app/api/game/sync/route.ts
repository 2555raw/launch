import { z } from "zod";
import { requireUser } from "@/server/auth";
import { sync } from "@/server/engine";
import { getCurrentProject } from "@/server/project";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

const schema = z.object({ clicks: z.number().int().min(0).max(100_000) });

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  // A legitimate client syncs at most once a second.
  if (!(await rateLimit(`sync:${user.id}`, 3, 1))) return fail(429, "Sync too fast");
  const { clicks } = await parseBody(req, schema);
  const project = await getCurrentProject();
  const state = await sync(user, project, clicks);
  return json({ state });
});
