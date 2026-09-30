import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { listDistributions } from "@/lib/services/rewards";
import { platformOverview } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const [overview, distributions] = await Promise.all([platformOverview(), listDistributions(10)]);
  return json({ ...overview, distributions });
});
