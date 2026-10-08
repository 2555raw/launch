import type { Db } from '@launch/database';

export async function audit(db: Db, input: { actorUserId?: string | null; action: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown>; ip?: string }): Promise<void> {
  await db.auditLog.create({ data: { actorUserId: input.actorUserId ?? null, action: input.action, targetType: input.targetType, targetId: input.targetId, metadata: input.metadata as object | undefined, ip: input.ip } }).catch(() => undefined);
}
