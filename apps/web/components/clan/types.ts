import type { ClanMessageDTO, ClanRole, ClanType } from '@launch/types';

/** Shapes returned by the clan routes (see packages/game-core clan.service getClanDetail and apps/api clan.routes). */

export interface ClanMember {
  playerId: string;
  name: string;
  level: number;
  trophies: number;
  role: ClanRole;
  donated: number;
  received: number;
  joinedAt: string;
  lastSeenAt: string;
}

export interface ClanTroopRequest {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  capacity: number;
  filled: number;
  createdAt: string;
}

export interface ClanDetail {
  id: string;
  name: string;
  tag: string;
  description: string;
  badge: string;
  type: ClanType;
  requiredTrophies: number;
  trophies: number;
  memberCount: number;
  createdAt: string;
  members: ClanMember[];
  requests: ClanTroopRequest[];
}

export interface ClanInvite {
  id: string;
  clan: { id: string; name: string; tag: string; badge: string };
  createdAt: string;
}

export interface ClanListItem {
  id: string;
  name: string;
  tag: string;
  badge: string;
  description: string;
  type: ClanType;
  requiredTrophies: number;
  trophies: number;
  members: number;
}

export interface MyClanResponse {
  clan: ClanDetail | null;
  role: ClanRole | null;
  invites: ClanInvite[];
  messages?: ClanMessageDTO[];
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  level: number;
  trophies: number;
  clan: { name: string; tag: string } | null;
}

export const CLAN_TYPE_LABEL: Record<ClanType, string> = { OPEN: 'Open', INVITE_ONLY: 'Invite only', CLOSED: 'Closed' };
