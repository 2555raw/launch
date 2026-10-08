import type { UserRole } from '@launch/types';

/** Mirrors apps/api admin.routes role checks so the UI hides what the API would refuse. */
export const STAFF_ROLES: UserRole[] = ['ADMIN', 'MODERATOR', 'DEVELOPER'];
const MODS: UserRole[] = ['ADMIN', 'MODERATOR'];

export type AdminAction = 'ban' | 'changeRole' | 'grant' | 'deleteClan' | 'unpublish' | 'resolveReport' | 'editConfig';

const RULES: Record<AdminAction, UserRole[]> = {
  ban: MODS,
  changeRole: ['ADMIN'],
  grant: ['ADMIN'],
  deleteClan: ['ADMIN'],
  unpublish: MODS,
  resolveReport: MODS,
  editConfig: ['ADMIN', 'DEVELOPER'],
};

export function can(role: UserRole | null | undefined, action: AdminAction): boolean {
  return !!role && RULES[action].includes(role);
}
