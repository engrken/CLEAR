-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "activeAy" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
ADD COLUMN     "activeTerm" TEXT NOT NULL DEFAULT '1st Sem';
