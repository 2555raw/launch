import { json, readJson, route, serialize } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { createDistribution, listDistributions } from "@/lib/services/rewards";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return json({ distributions: await listDistributions(60) });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const result = await createDistribution(await readJson(req), admin.wallet_address);
  return json(serialize({ distribution: result }), 201);
});
