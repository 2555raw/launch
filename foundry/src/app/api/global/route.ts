import { getGlobalSnapshot } from "@/server/global";
import { getCurrentProject, publicProject } from "@/server/project";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const project = await getCurrentProject();
  return json({ global: await getGlobalSnapshot(project), project: publicProject(project) });
});
