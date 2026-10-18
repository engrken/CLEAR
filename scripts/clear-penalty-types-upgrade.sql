-- CLEAR: Phase 3+4, Penalty Types & Settlement History
-- ADDITIVE schema-only upgrade; no existing balances, receipts or penalties are rewritten.
-- Run on a backed-up, isolated Neon STAGING branch first.
-- If a relation exists with a different structure, STOP and reconcile before applying.
BEGIN;

ALTER TABLE public."Penalty"
  ADD COLUMN IF NOT EXISTS "penaltyType" TEXT NOT NULL DEFAULT 'SERVICE_ELIGIBLE',
  ADD COLUMN IF NOT EXISTS "assessedAmount" DOUBLE PRECISION;

-- Existing penalties retain their original duration/rate. Their nullable assessedAmount
-- is deliberately left NULL so historical assessed values are derived from existing data.
-- New Late Fees are flat cash-only amounts with hoursLate=0, ratePerHour=0.
CREATE TABLE IF NOT EXISTS public."PenaltySettlementEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "penaltyRecordId" TEXT NOT NULL,
  "receiptId" TEXT,
  "method" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "minutesRendered" INTEGER NOT NULL DEFAULT 0,
  "accountingAY" TEXT NOT NULL,
  "accountingTerm" TEXT NOT NULL,
  "balanceBefore" DOUBLE PRECISION NOT NULL,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  "recordedBy" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PenaltySettlementEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PenaltySettlementEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PenaltySettlementEvent_penaltyRecordId_fkey"
    FOREIGN KEY ("penaltyRecordId") REFERENCES public."Penalty"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PenaltySettlementEvent_receiptId_fkey"
    FOREIGN KEY ("receiptId") REFERENCES public."Collection"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PSE_org_penalty_date_idx"
  ON public."PenaltySettlementEvent" ("organizationId", "penaltyRecordId", "createdAt");
CREATE INDEX IF NOT EXISTS "PSE_org_receipt_idx"
  ON public."PenaltySettlementEvent" ("organizationId", "receiptId");

COMMIT;
