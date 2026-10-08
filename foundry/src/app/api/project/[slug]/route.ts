import { getProjectData } from "@/server/projectData";
import { handler, json, fail } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: { slug: string } }) => {
  const data = await getProjectData(params.slug);
  if (!data) return fail(404, "Project not found");
  return json(data);
});
