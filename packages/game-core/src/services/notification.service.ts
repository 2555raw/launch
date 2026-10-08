import type { NotificationDTO } from '@launch/types';
import type { DbOrTx, GameContext } from '../context.js';

export const NOTIFY_CHANNEL = 'launch:notify';

export async function createNotification(tx: DbOrTx, userId: string, type: string, title: string, body: string, data: Record<string, unknown> | null = null): Promise<NotificationDTO> {
  const n = await tx.notification.create({ data: { userId, type, title, body, data: data === null ? undefined : (data as object) } });
  return toDTO(n);
}

export async function publishNotification(ctx: GameContext, userId: string, notification: NotificationDTO): Promise<void> {
  await ctx.redis.publish(NOTIFY_CHANNEL, JSON.stringify({ userId, notification })).catch(() => undefined);
}

export async function notify(ctx: GameContext, tx: DbOrTx, userId: string, type: string, title: string, body: string, data: Record<string, unknown> | null = null): Promise<void> {
  const n = await createNotification(tx, userId, type, title, body, data);
  await publishNotification(ctx, userId, n);
}

export function toDTO(n: { id: string; type: string; title: string; body: string; data: unknown; readAt: Date | null; createdAt: Date }): NotificationDTO {
  return { id: n.id, type: n.type, title: n.title, body: n.body, data: (n.data as Record<string, unknown>) ?? null, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() };
}
