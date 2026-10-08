import { getCurrentProject } from "@/server/project";
import { getProjectData } from "@/server/projectData";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const p = await getCurrentProject();
  return json(await getProjectData(p.slug));
});
