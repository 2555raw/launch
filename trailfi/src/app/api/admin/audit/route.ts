import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const entries = await query(
    `select id::text as id, actor, action, entity, entity_id as "entityId", details, created_at as "createdAt"
       from audit_log order by audit_log.id desc limit 200`,
  );
  return json({ entries });
});
