-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('SOLANA', 'ROBINHOOD');

-- CreateEnum
CREATE TYPE "BuildingState" AS ENUM ('IDLE', 'CONSTRUCTING', 'UPGRADING');

-- CreateEnum
CREATE TYPE "BattleState" AS ENUM ('PENDING', 'ACTIVE', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('GOLD', 'ELIXIR', 'GEMS');

-- CreateEnum
CREATE TYPE "ClanRole" AS ENUM ('LEADER', 'CO_LEADER', 'ELDER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ClanType" AS ENUM ('OPEN', 'INVITE_ONLY', 'CLOSED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RankingScope" AS ENUM ('PLAYER', 'CLAN');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'AWAITING_SIGNATURE', 'VERIFYING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "username" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "banReason" TEXT,
    "bannedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "trophies" INTEGER NOT NULL DEFAULT 0,
    "bestTrophies" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "elixir" INTEGER NOT NULL DEFAULT 0,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "attacksWon" INTEGER NOT NULL DEFAULT 0,
    "attacksLost" INTEGER NOT NULL DEFAULT 0,
    "defensesWon" INTEGER NOT NULL DEFAULT 0,
    "defensesLost" INTEGER NOT NULL DEFAULT 0,
    "shieldUntil" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Village" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gridSize" INTEGER NOT NULL DEFAULT 44,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "state" "BuildingState" NOT NULL DEFAULT 'IDLE',
    "constructionStartedAt" TIMESTAMP(3),
    "constructionEndsAt" TIMESTAMP(3),
    "lastCollectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTroop" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "troopType" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayerTroop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArmyUnit" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "troopType" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "donated" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArmyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingJob" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "troopType" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchJob" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "troopType" TEXT NOT NULL,
    "toLevel" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completesAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "state" "BattleState" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER NOT NULL,
    "defenderSnapshot" JSONB NOT NULL,
    "attackerArmy" JSONB NOT NULL,
    "deployments" JSONB NOT NULL DEFAULT '[]',
    "result" JSONB,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "destructionPercent" INTEGER NOT NULL DEFAULT 0,
    "lootGold" INTEGER NOT NULL DEFAULT 0,
    "lootElixir" INTEGER NOT NULL DEFAULT 0,
    "attackerTrophyDelta" INTEGER NOT NULL DEFAULT 0,
    "defenderTrophyDelta" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceLedger" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "resource" "ResourceType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "badge" TEXT NOT NULL DEFAULT 'shield-1',
    "type" "ClanType" NOT NULL DEFAULT 'OPEN',
    "requiredTrophies" INTEGER NOT NULL DEFAULT 0,
    "trophies" INTEGER NOT NULL DEFAULT 0,
    "warsWon" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanMember" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'MEMBER',
    "donated" INTEGER NOT NULL DEFAULT 0,
    "received" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanInvite" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanMessage" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanTroopRequest" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER NOT NULL,
    "filled" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanTroopRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TroopDonation" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromPlayerId" TEXT NOT NULL,
    "toPlayerId" TEXT NOT NULL,
    "troopType" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TroopDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "scope" "RankingScope" NOT NULL,
    "rank" INTEGER NOT NULL,
    "trophies" INTEGER NOT NULL,
    "playerId" TEXT,
    "clanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "discord" TEXT,
    "telegram" TEXT,
    "chain" "Chain" NOT NULL,
    "network" TEXT NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "failureReason" TEXT,
    "metadataUri" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "createTxSignature" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "supply" TEXT NOT NULL,
    "tokenProgram" TEXT,
    "metadataUri" TEXT,
    "mintAuthorityRevoked" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB,
    "metricsFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "chain" "Chain" NOT NULL,
    "network" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "amount" TEXT,
    "asset" TEXT,
    "blockRef" TEXT,
    "raw" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobinhoodConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "privateKeyEnc" TEXT NOT NULL,
    "publicKeyBase64" TEXT NOT NULL,
    "label" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobinhoodConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfigOverride" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfigOverride_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_chain_address_key" ON "Wallet"("chain", "address");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");

-- CreateIndex
CREATE INDEX "RefreshSession_family_idx" ON "RefreshSession"("family");

-- CreateIndex
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE INDEX "Player_trophies_idx" ON "Player"("trophies" DESC);

-- CreateIndex
CREATE INDEX "Player_level_idx" ON "Player"("level");

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Village_playerId_key" ON "Village"("playerId");

-- CreateIndex
CREATE INDEX "Building_villageId_idx" ON "Building"("villageId");

-- CreateIndex
CREATE INDEX "Building_villageId_type_idx" ON "Building"("villageId", "type");

-- CreateIndex
CREATE INDEX "Building_constructionEndsAt_idx" ON "Building"("constructionEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTroop_playerId_troopType_key" ON "PlayerTroop"("playerId", "troopType");

-- CreateIndex
CREATE UNIQUE INDEX "ArmyUnit_playerId_troopType_key" ON "ArmyUnit"("playerId", "troopType");

-- CreateIndex
CREATE INDEX "TrainingJob_playerId_completesAt_idx" ON "TrainingJob"("playerId", "completesAt");

-- CreateIndex
CREATE INDEX "ResearchJob_playerId_completesAt_idx" ON "ResearchJob"("playerId", "completesAt");

-- CreateIndex
CREATE INDEX "Battle_attackerId_createdAt_idx" ON "Battle"("attackerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Battle_defenderId_createdAt_idx" ON "Battle"("defenderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Battle_state_idx" ON "Battle"("state");

-- CreateIndex
CREATE INDEX "Battle_createdAt_idx" ON "Battle"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResourceLedger_playerId_createdAt_idx" ON "ResourceLedger"("playerId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceLedger_playerId_reason_refId_key" ON "ResourceLedger"("playerId", "reason", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_name_key" ON "Clan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_tag_key" ON "Clan"("tag");

-- CreateIndex
CREATE INDEX "Clan_trophies_idx" ON "Clan"("trophies" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ClanMember_playerId_key" ON "ClanMember"("playerId");

-- CreateIndex
CREATE INDEX "ClanMember_clanId_idx" ON "ClanMember"("clanId");

-- CreateIndex
CREATE INDEX "ClanInvite_playerId_status_idx" ON "ClanInvite"("playerId", "status");

-- CreateIndex
CREATE INDEX "ClanInvite_clanId_status_idx" ON "ClanInvite"("clanId", "status");

-- CreateIndex
CREATE INDEX "ClanMessage_clanId_createdAt_idx" ON "ClanMessage"("clanId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ClanTroopRequest_clanId_createdAt_idx" ON "ClanTroopRequest"("clanId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TroopDonation_requestId_idx" ON "TroopDonation"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAchievement_playerId_key_key" ON "PlayerAchievement"("playerId", "key");

-- CreateIndex
CREATE INDEX "RankingSnapshot_season_scope_rank_idx" ON "RankingSnapshot"("season", "scope", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_creatorUserId_idx" ON "Project"("creatorUserId");

-- CreateIndex
CREATE INDEX "Project_status_publishedAt_idx" ON "Project"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Project_chain_network_idx" ON "Project"("chain", "network");

-- CreateIndex
CREATE UNIQUE INDEX "Token_projectId_key" ON "Token"("projectId");

-- CreateIndex
CREATE INDEX "Token_createdAt_idx" ON "Token"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Token_chain_network_address_key" ON "Token"("chain", "network", "address");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_kind_idx" ON "Transaction"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_chain_network_signature_key" ON "Transaction"("chain", "network", "signature");

-- CreateIndex
CREATE UNIQUE INDEX "RobinhoodConnection_userId_key" ON "RobinhoodConnection"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Village" ADD CONSTRAINT "Village_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTroop" ADD CONSTRAINT "PlayerTroop_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArmyUnit" ADD CONSTRAINT "ArmyUnit_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingJob" ADD CONSTRAINT "TrainingJob_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceLedger" ADD CONSTRAINT "ResourceLedger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMember" ADD CONSTRAINT "ClanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMember" ADD CONSTRAINT "ClanMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanInvite" ADD CONSTRAINT "ClanInvite_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanInvite" ADD CONSTRAINT "ClanInvite_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMessage" ADD CONSTRAINT "ClanMessage_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanMessage" ADD CONSTRAINT "ClanMessage_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanTroopRequest" ADD CONSTRAINT "ClanTroopRequest_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanTroopRequest" ADD CONSTRAINT "ClanTroopRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TroopDonation" ADD CONSTRAINT "TroopDonation_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TroopDonation" ADD CONSTRAINT "TroopDonation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClanTroopRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TroopDonation" ADD CONSTRAINT "TroopDonation_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TroopDonation" ADD CONSTRAINT "TroopDonation_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobinhoodConnection" ADD CONSTRAINT "RobinhoodConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
