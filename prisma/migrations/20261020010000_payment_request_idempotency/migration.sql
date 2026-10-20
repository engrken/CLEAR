CREATE TABLE "PaymentRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "orNumber" TEXT NOT NULL,
  "outcomeJson" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentRequest_organizationId_requestId_key" ON "PaymentRequest"("organizationId", "requestId");
CREATE INDEX "PaymentRequest_organizationId_orNumber_idx" ON "PaymentRequest"("organizationId", "orNumber");
