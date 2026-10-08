import { getLeaderboard } from "@/server/global";
import { getCurrentProject } from "@/server/project";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const project = await getCurrentProject();
  return json({ leaderboard: await getLeaderboard(project.id, 25) });
});
