# Game engine (`packages/game-engine`)

Pure, deterministic TypeScript. No I/O, no Prisma.

* **Buildings** (`definitions/buildings.ts`): 16 types (Town Hall, Gold Mine, Elixir Collector, Gold Vault, Elixir Reservoir, Barracks, Army Camp, Laboratory, Builder's Hut, Clan Hall, Crystal Mine, Arrow Tower, Cannon, Mortar, Mage Tower, Wall). Each level has cost, build time, hp, Town Hall requirement, xp and role-specific stats. `maxCountByTownHall` and `requiredTownHall` gate progression. New villages start with a walled core (52 wall segments, two cannons, storages, collectors, barracks, camp and a builder's hut); walls are available from Town Hall 1. Adding a building = adding an entry (+ an art routine in `apps/web/components/game/sprites.ts`).
* **Troops** (`definitions/troops.ts`): Grunt, Ranger, Brute, Breacher, Sky Scout, Pyromancer, with hp/damage/attack speed/move speed/range/target preference/housing/cost/train time/levels and research cost/time/lab level.
* **Economy** (`resources.ts`): lazy accrual from `lastCollectedAt`, storage capacity, builders, housing.
* **Placement** (`placement.ts`): bounds + overlap validation; deployment exclusion mask (footprints + 1 tile).
* **Progression** (`progression.ts`, `definitions/achievements.ts`): XP curve, 9 tiered achievements, battle timing constants, gem skip pricing.
* **Battle** (`battle/`): `BattleSimulation` — 100 ms ticks, Dijkstra pathfinding where walls are passable at a health-weighted cost (troops bash through when the detour is longer), target preference (any/defense/resource/wall), ranged units, flying units ignoring walls/ground-only defenses, splash damage, suicide units, defenses with range/min-range/targets, stars (50 %, Town Hall, 100 %), loot released by destroying the building that holds it, Elo-style trophies, XP. `replayBattle` reproduces any battle from its seed + deployment log.

Tests: `npm run test -w @launch/game-engine` (balance monotonicity, placement, accrual, determinism, replay, pathing through walls, loot distribution).
