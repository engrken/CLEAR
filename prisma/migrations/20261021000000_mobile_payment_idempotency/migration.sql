-- Additive schema preparation for mobile payment request deduplication.
-- This migration must be reviewed and tested in an isolated database before deployment.
CREATE TABLE "MobilePaymentIdempotency" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tenantUserId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "receiptId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobilePaymentIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobilePaymentIdempotency_organizationId_tenantUserId_requestKey_key"
  ON "MobilePaymentIdempotency"("organizationId", "tenantUserId", "requestKey");
CREATE INDEX "MobilePaymentIdempotency_organizationId_createdAt_idx"
  ON "MobilePaymentIdempotency"("organizationId", "createdAt");

ALTER TABLE "MobilePaymentIdempotency"
  ADD CONSTRAINT "MobilePaymentIdempotency_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePaymentIdempotency"
  ADD CONSTRAINT "MobilePaymentIdempotency_tenantUserId_fkey"
  FOREIGN KEY ("tenantUserId") REFERENCES "TenantUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
