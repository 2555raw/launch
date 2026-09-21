import { eq, and, desc, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { id } from "@/lib/ids";

/** In-app notifications. Email delivery is a provider (lib/providers/notifications.ts). */
export function notify(
  userId: string,
  input: { kind: "payment" | "security" | "account" | "merchant"; title: string; body: string; href?: string }
) {
  getDb()
    .insert(schema.notifications)
    .values({ id: id("ntf"), userId, ...input, createdAt: Date.now() })
    .run();
}

export function listNotifications(userId: string, limit = 50) {
  return getDb()
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit)
    .all();
}

export function unreadCount(userId: string): number {
  return getDb()
    .select()
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
    .all().length;
}

export function markAllRead(userId: string) {
  getDb()
    .update(schema.notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
    .run();
}
