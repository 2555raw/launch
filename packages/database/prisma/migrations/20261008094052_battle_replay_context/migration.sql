-- AlterTable
ALTER TABLE "Battle" ADD COLUMN     "attackerTownHall" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "attackerTroopLevels" JSONB NOT NULL DEFAULT '{}';
