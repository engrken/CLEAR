-- Execute ONLY on isolated Neon staging branch after DB backup.
-- Additive, create-only DDL. No financial records are updated.
BEGIN;
CREATE TABLE IF NOT EXISTS public."DigitalReceiptDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "referenceNo" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientRole" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DRD_organization_fk" FOREIGN KEY ("organizationId")
    REFERENCES public."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DRD_unique_delivery"
  ON public."DigitalReceiptDelivery" ("organizationId", "eventKey", "recipientEmail");
CREATE INDEX IF NOT EXISTS "DRD_retry_queue_idx"
  ON public."DigitalReceiptDelivery" ("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "DRD_org_created_idx"
  ON public."DigitalReceiptDelivery" ("organizationId", "createdAt");
COMMIT;
