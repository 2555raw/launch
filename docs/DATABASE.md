# Database

PostgreSQL 16 via Prisma 6. Schema: `packages/database/prisma/schema.prisma`. Migrations: `packages/database/prisma/migrations`.

| Model | Role |
| --- | --- |
| User, Wallet, RefreshSession | identity, linked wallets (unique per chain+address), rotating refresh tokens with family-level reuse detection |
| Player, Village, Building | persistent village; buildings carry state + timers + `lastCollectedAt` for lazy production accrual |
| PlayerTroop, ArmyUnit, TrainingJob, ResearchJob | unlock/levels, trained units (+ donated reinforcements), queues |
| Battle | matchmaking snapshot, seed, army, deployment log, result and deltas |
| ResourceLedger | append-only log of every gold/elixir/gem change, unique `(playerId, reason, refId)` → idempotent rewards |
| Clan, ClanMember, ClanInvite, ClanMessage, ClanTroopRequest, TroopDonation | clans with roles LEADER/CO_LEADER/ELDER/MEMBER |
| PlayerAchievement, RankingSnapshot | progression and seasonal rankings |
| Project, Token, Transaction | launchpad drafts, verified on-chain tokens (unique chain+network+address), recorded transactions |
| RobinhoodConnection | encrypted user API credentials |
| AuditLog, Report, GameConfigOverride, Notification | ops |

Indexes cover every list/sort the API performs (trophies desc, clan trophies, battle timelines, ledger per player, project status+publishedAt, transactions per user).

Commands: `npm run db:migrate:dev -- --name <change>` to create a migration, `npm run db:migrate` to apply, `npm run db:seed`, `npm run db:reset`.
