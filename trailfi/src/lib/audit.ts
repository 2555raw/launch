import "server-only";
import type { Queryable } from "@/lib/db";
import { query } from "@/lib/db";

export async function audit(
  actor: string,
  action: string,
  entity: string | null,
  entityId: string | null,
  details: Record<string, unknown> = {},
  q?: Queryable,
) {
  const run = q ? q.query.bind(q) : query;
  await run("insert into audit_log (actor, action, entity, entity_id, details) values ($1, $2, $3, $4, $5)", [
    actor,
    action,
    entity,
    entityId,
    JSON.stringify(details, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ]);
}
