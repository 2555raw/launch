import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { getSettings, updateSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const history = await query(
    `select id, snapshot, changed_by as "changedBy", created_at as "createdAt" from settings_history order by id desc limit 20`,
  );
  return json({ settings: await getSettings(), history });
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  return json({ settings: await updateSettings(await readJson(req), admin.wallet_address) });
});
