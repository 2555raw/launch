import { getDb, schema } from "@/lib/db";
import { id } from "@/lib/ids";

export type Actor = { type: "user" | "merchant" | "system" | "api_key"; id: string };

/** Append-only. Nothing in the app updates or deletes an audit row. */
export function audit(
  actor: Actor,
  action: string,
  target?: { type: string; id: string },
  extra?: { ip?: string; metadata?: Record<string, unknown> }
) {
  getDb()
    .insert(schema.auditLogs)
    .values({
      id: id("aud"),
      actorType: actor.type,
      actorId: actor.id,
      action,
      targetType: target?.type,
      targetId: target?.id,
      ip: extra?.ip,
      metadata: extra?.metadata ? JSON.stringify(extra.metadata) : undefined,
      createdAt: Date.now(),
    })
    .run();
}
