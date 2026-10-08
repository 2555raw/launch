-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "fixedSupply" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "revokeFreeze" BOOLEAN NOT NULL DEFAULT true;
