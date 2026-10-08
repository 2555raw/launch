/**
 * Seeds reference data and (optionally) the first admin account.
 * Safe to re-run: every write is an upsert.
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { ACHIEVEMENT_DEFINITIONS, BUILDING_DEFINITIONS, STARTER_RESOURCES, STARTER_VILLAGE, TROOP_DEFINITIONS } from '@launch/game-engine';

const prisma = new PrismaClient();

async function main() {
  // Game configuration overrides table starts with the engine defaults so admins can tune them.
  await prisma.gameConfigOverride.upsert({
    where: { key: 'economy' },
    update: {},
    create: { key: 'economy', value: { starterResources: STARTER_RESOURCES, lootPercent: 0.2, battleDurationMs: 180000, shieldAfterDefeatMs: 8 * 3600 * 1000 } },
  });
  await prisma.gameConfigOverride.upsert({
    where: { key: 'catalog' },
    update: { value: { buildings: Object.keys(BUILDING_DEFINITIONS), troops: Object.keys(TROOP_DEFINITIONS), achievements: ACHIEVEMENT_DEFINITIONS.map((a) => a.key) } },
    create: { key: 'catalog', value: { buildings: Object.keys(BUILDING_DEFINITIONS), troops: Object.keys(TROOP_DEFINITIONS), achievements: ACHIEVEMENT_DEFINITIONS.map((a) => a.key) } },
  });

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: { email, username: 'admin', passwordHash, role: 'ADMIN', emailVerified: new Date() },
    });
    const existing = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.player.create({
        data: {
          userId: user.id,
          name: 'Admin',
          gold: STARTER_RESOURCES.gold,
          elixir: STARTER_RESOURCES.elixir,
          gems: STARTER_RESOURCES.gems,
          village: { create: { name: "Admin's Hold", buildings: { create: STARTER_VILLAGE.map((b) => ({ type: b.type, level: b.level, x: b.x, y: b.y })) } } },
          troops: { create: [{ troopType: 'grunt', level: 1 }] },
        },
      });
    }
    console.log(`✓ admin user ${email} ready (role ADMIN)`);
  } else {
    console.log('• ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin account');
  }
  console.log('✓ seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
