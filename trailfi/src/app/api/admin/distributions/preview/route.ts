import { json, readJson, route, serialize } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { previewDistribution } from "@/lib/services/rewards";

export const dynamic = "force-dynamic";

/** Dry run of the reward engine — nothing is written. */
export const POST = route(async (req) => {
  await requireAdmin();
  return json(serialize({ preview: await previewDistribution(await readJson(req)) }));
});
