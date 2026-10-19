-- Catch-up migration (Phase 0, 2026-10-16).
-- The earlier migrations predate Signatory, CollectionSetup, CashierRemittance and
-- Organization.logo/type, which reached production via `prisma db push`.
-- Production already has these objects: mark this migration applied there with
--   npx prisma migrate resolve --applied 20261016000000_sync_schema_drift
-- instead of running it.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "logo" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Department';

-- CreateTable
CREATE TABLE "Signatory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Signatory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionSetup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "targetFund" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "isPackage" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierRemittance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "remittanceId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remittedBy" TEXT NOT NULL,
    "fundSource" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Deposit',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashierReceiptNo" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Remitted',
    "encodedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashierRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Signatory_organizationId_idx" ON "Signatory"("organizationId");

-- CreateIndex
CREATE INDEX "CollectionSetup_organizationId_academicYear_term_idx" ON "CollectionSetup"("organizationId", "academicYear", "term");

-- CreateIndex
CREATE UNIQUE INDEX "CashierRemittance_remittanceId_key" ON "CashierRemittance"("remittanceId");

-- CreateIndex
CREATE INDEX "Collection_organizationId_academicYear_term_idx" ON "Collection"("organizationId", "academicYear", "term");

-- CreateIndex
CREATE UNIQUE INDEX "Student_organizationId_studentId_key" ON "Student"("organizationId", "studentId");

-- AddForeignKey
ALTER TABLE "Signatory" ADD CONSTRAINT "Signatory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSetup" ADD CONSTRAINT "CollectionSetup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierRemittance" ADD CONSTRAINT "CashierRemittance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

