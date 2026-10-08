import { requireUser } from "@/server/auth";
import { getState } from "@/server/engine";
import { getCurrentProject, publicProject } from "@/server/project";
import { getGlobalSnapshot } from "@/server/global";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const project = await getCurrentProject();
  const [state, global] = await Promise.all([getState(user, project), getGlobalSnapshot(project)]);
  return json({ state, global, project: publicProject(project) });
});
