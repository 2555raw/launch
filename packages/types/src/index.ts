/**
 * Shared, runtime-free types used across the API, the game server and the web app.
 * Game balance data lives in @launch/game-engine; blockchain helpers in @launch/solana and @launch/evm.
 */

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN' | 'DEVELOPER';
export type UserStatus = 'ACTIVE' | 'BANNED' | 'SUSPENDED';
export type Chain = 'SOLANA' | 'ROBINHOOD';
export type ResourceType = 'GOLD' | 'ELIXIR' | 'GEMS';
export type BuildingState = 'IDLE' | 'CONSTRUCTING' | 'UPGRADING';
export type ClanRole = 'LEADER' | 'CO_LEADER' | 'ELDER' | 'MEMBER';
export type ClanType = 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
export type BattleState = 'PENDING' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
export type ProjectStatus = 'DRAFT' | 'AWAITING_SIGNATURE' | 'VERIFYING' | 'PUBLISHED' | 'FAILED';
export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string;
  role: UserRole;
  status: UserStatus;
  playerId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  /** seconds */
  expiresIn: number;
}

export interface WalletDTO {
  id: string;
  chain: Chain;
  address: string;
  label: string | null;
  isPrimary: boolean;
  verifiedAt: string;
}

export interface ResourcesDTO {
  gold: number;
  elixir: number;
  gems: number;
  goldCapacity: number;
  elixirCapacity: number;
}

export interface BuildingDTO {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
  size: number;
  state: BuildingState;
  constructionStartedAt: string | null;
  constructionEndsAt: string | null;
  /** For resource collectors: resource accrued but not yet collected (server computed). */
  accrued?: number;
  accruedCapacity?: number;
  hp: number;
}

export interface VillageDTO {
  id: string;
  name: string;
  gridSize: number;
  townHallLevel: number;
  buildings: BuildingDTO[];
  resources: ResourcesDTO;
  builders: { total: number; busy: number };
  shieldUntil: string | null;
}

export interface PlayerSummaryDTO {
  id: string;
  name: string;
  level: number;
  xp: number;
  trophies: number;
  bestTrophies: number;
  townHallLevel: number;
  clan: { id: string; name: string; tag: string; role: ClanRole } | null;
  attacksWon: number;
  attacksLost: number;
  defensesWon: number;
  defensesLost: number;
}

export interface ArmyUnitDTO {
  troopType: string;
  count: number;
  level: number;
}

export interface TrainingJobDTO {
  id: string;
  troopType: string;
  count: number;
  startedAt: string;
  completesAt: string;
}

export interface ArmyDTO {
  units: ArmyUnitDTO[];
  housingUsed: number;
  housingCapacity: number;
  training: TrainingJobDTO[];
  troopLevels: Record<string, number>;
  research: { troopType: string; completesAt: string } | null;
}

/** Snapshot of a village used for battles (immutable while a battle runs). */
export interface BattleBuildingSnapshot {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
  size: number;
  hp: number;
  storedGold: number;
  storedElixir: number;
}

export interface BattleSnapshot {
  gridSize: number;
  townHallLevel: number;
  buildings: BattleBuildingSnapshot[];
}

export interface DeploymentRecord {
  t: number; // ms since battle start
  troopType: string;
  x: number;
  y: number;
}

export interface BattleResultDTO {
  stars: number;
  destructionPercent: number;
  lootGold: number;
  lootElixir: number;
  attackerTrophyDelta: number;
  defenderTrophyDelta: number;
  xpGained: number;
  durationMs: number;
  troopsUsed: Record<string, number>;
  victory: boolean;
}

export interface BattleEntityDTO {
  id: number;
  troopType: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  targetId: string | null;
}

export interface BattleStateDTO {
  battleId: string;
  elapsedMs: number;
  remainingMs: number;
  troops: BattleEntityDTO[];
  buildings: Array<{ id: string; hp: number; maxHp: number; destroyed: boolean }>;
  destructionPercent: number;
  stars: number;
  lootGold: number;
  lootElixir: number;
  remainingArmy: Record<string, number>;
}

// ──────────────────────────────────────────────────────────────────────────────
// WebSocket protocol (game-server)
// ──────────────────────────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping' }
  | { type: 'battle:join'; battleId: string }
  | { type: 'battle:deploy'; battleId: string; troopType: string; x: number; y: number }
  | { type: 'battle:end'; battleId: string }
  | { type: 'clan:message'; content: string }
  | { type: 'clan:subscribe' };

export type ServerMessage =
  | { type: 'auth:ok'; userId: string; playerId: string }
  | { type: 'auth:error'; message: string }
  | { type: 'pong' }
  | { type: 'error'; code: string; message: string }
  | { type: 'battle:ready'; battleId: string; snapshot: BattleSnapshot; army: Record<string, number>; durationMs: number; prepMs: number }
  | { type: 'battle:state'; state: BattleStateDTO }
  | { type: 'battle:event'; battleId: string; event: BattleEvent }
  | { type: 'battle:result'; battleId: string; result: BattleResultDTO }
  | { type: 'clan:message'; message: ClanMessageDTO }
  | { type: 'notification'; notification: NotificationDTO };

export type BattleEvent =
  | { kind: 'deploy'; troopType: string; x: number; y: number; entityId: number }
  | { kind: 'building_destroyed'; buildingId: string; buildingType: string }
  | { kind: 'troop_died'; entityId: number }
  | { kind: 'star'; stars: number }
  | { kind: 'rejected'; reason: string };

export interface ClanMessageDTO {
  id: string;
  clanId: string;
  playerId: string;
  playerName: string;
  content: string;
  createdAt: string;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Launchpad
// ──────────────────────────────────────────────────────────────────────────────

export interface ProjectDTO {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  description: string;
  logoUrl: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  chain: Chain;
  network: string;
  totalSupply: string;
  decimals: number;
  status: ProjectStatus;
  creator: { id: string; username: string };
  token: TokenDTO | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface TokenMetricsDTO {
  /** 'dexscreener' when live market data exists; 'onchain' when only chain state is known. */
  source: 'dexscreener' | 'onchain' | 'unavailable';
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  txns24h: number | null;
  holders: number | null;
  pairAddress: string | null;
  dexId: string | null;
  dexUrl: string | null;
  fetchedAt: string;
}

export interface TokenDTO {
  id: string;
  chain: Chain;
  network: string;
  address: string;
  creatorWallet: string;
  createTxSignature: string;
  decimals: number;
  supply: string;
  tokenProgram: string | null;
  metadataUri: string | null;
  mintAuthorityRevoked: boolean;
  explorerUrl: string;
  txExplorerUrl: string;
  verifiedAt: string;
  metrics: TokenMetricsDTO | null;
}

export interface TransactionDTO {
  id: string;
  chain: Chain;
  network: string;
  signature: string;
  kind: string;
  status: TransactionStatus;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string | null;
  asset: string | null;
  explorerUrl: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}
