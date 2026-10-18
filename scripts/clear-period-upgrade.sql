-- RUN ONLY on an isolated backup/staging Neon branch after review.
-- Run this on the SAME database and schema as Prisma. Review transaction and backup first.
-- Existing financial and student rows are never updated by this script.
-- Creates additive records; never resets existing student/payment records.
BEGIN;
CREATE TABLE IF NOT EXISTS public."AcademicPeriodTransition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "sourceAY" TEXT NOT NULL,
  "sourceTerm" TEXT NOT NULL,
  "destinationAY" TEXT NOT NULL,
  "destinationTerm" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "transferId" TEXT,
  "feePolicy" TEXT NOT NULL DEFAULT 'manual',
  "copiedFeesJson" TEXT NOT NULL DEFAULT '[]',
  "reason" TEXT NOT NULL,
  "closedBy" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'Closed',
  "reopenedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicPeriodTransition_organizationId_sourceAY_sourceTerm_key"
  ON public."AcademicPeriodTransition" ("organizationId", "sourceAY", "sourceTerm");
CREATE INDEX IF NOT EXISTS "AcademicPeriodTransition_organizationId_destinationAY_destinationTerm_idx"
  ON public."AcademicPeriodTransition" ("organizationId", "destinationAY", "destinationTerm");
CREATE TABLE IF NOT EXISTS public."ArrearPaymentLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "obligationType" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "originAY" TEXT NOT NULL,
  "originTerm" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Verify tenant and receipt records at the database level.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademicPeriodTransition_organizationId_fkey') THEN
    ALTER TABLE public."AcademicPeriodTransition"
      ADD CONSTRAINT "AcademicPeriodTransition_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArrearPaymentLink_organizationId_fkey') THEN
    ALTER TABLE public."ArrearPaymentLink"
      ADD CONSTRAINT "ArrearPaymentLink_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArrearPaymentLink_receiptId_fkey') THEN
    ALTER TABLE public."ArrearPaymentLink"
      ADD CONSTRAINT "ArrearPaymentLink_receiptId_fkey"
      FOREIGN KEY ("receiptId") REFERENCES public."Collection"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "ArrearPaymentLink_receiptId_key"
  ON public."ArrearPaymentLink" ("receiptId");
CREATE INDEX IF NOT EXISTS "ArrearPaymentLink_organizationId_obligationType_obligationId_idx"
  ON public."ArrearPaymentLink" ("organizationId", "obligationType", "obligationId");
-- Existing-schema lookup acceleration; indexes are non-destructive.
CREATE INDEX IF NOT EXISTS "Penalty_org_student_history_idx"
  ON public."Penalty" ("organizationId", "studentId", "academicYear", "term");
CREATE INDEX IF NOT EXISTS "Collectible_org_period_history_idx"
  ON public."Collectible" ("organizationId", "academicYear", "term");
COMMIT;
