import type { ClanRole } from '@launch/types';

export const ROLE_RANK: Record<ClanRole, number> = { MEMBER: 0, ELDER: 1, CO_LEADER: 2, LEADER: 3 };
export const ROLE_LABEL: Record<ClanRole, string> = { MEMBER: 'Member', ELDER: 'Elder', CO_LEADER: 'Co-leader', LEADER: 'Leader' };

export function atLeast(role: ClanRole | null | undefined, min: ClanRole): boolean {
  return !!role && ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Mirrors the server rules in clan.service: ELDER+ can kick lower ranks. */
export function canKick(actor: ClanRole, target: ClanRole, isSelf: boolean): boolean {
  return !isSelf && atLeast(actor, 'ELDER') && ROLE_RANK[target] < ROLE_RANK[actor];
}

/** Roles the actor may assign to the target (CO_LEADER+ only, strictly below their own rank; leader may hand over leadership). */
export function assignableRoles(actor: ClanRole, target: ClanRole, isSelf: boolean): ClanRole[] {
  if (isSelf || !atLeast(actor, 'CO_LEADER') || ROLE_RANK[target] >= ROLE_RANK[actor]) return [];
  const out: ClanRole[] = (['MEMBER', 'ELDER', 'CO_LEADER'] as ClanRole[]).filter((r) => r !== target && ROLE_RANK[r] < ROLE_RANK[actor]);
  if (actor === 'LEADER') out.push('LEADER');
  return out;
}
